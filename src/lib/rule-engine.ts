/**
 * 规则引擎核心 - 根据 ParseRule 解析文件数据为 OrderRecord[]
 */
import { ParseRule, OrderRecord, ParseResult, AggregationRule, FieldMapping, MetadataExtraction } from '@/types'

type RawRow = (string | number | null | undefined)[]
type RawSheet = { name: string; rows: RawRow[] }

export class RuleEngine {
  private rule: ParseRule

  constructor(rule: ParseRule) {
    this.rule = rule
  }

  /**
   * 主入口：执行解析
   */
  execute(sheets: RawSheet[]): ParseResult {
    try {
      // 1. 选择要处理的Sheet
      const targetSheets = this.selectSheets(sheets)

      // 2. 对每个Sheet执行解析
      let allRecords: OrderRecord[] = []

      for (const sheet of targetSheets) {
        const records = this.parseSheet(sheet)
        allRecords = allRecords.concat(records)
      }

      return {
        success: true,
        data: allRecords,
        totalRows: allRecords.length,
        parsedRows: allRecords.length,
      }
    } catch (error) {
      return {
        success: false,
        data: [],
        errors: [error instanceof Error ? error.message : String(error)],
        totalRows: 0,
        parsedRows: 0,
      }
    }
  }

  private selectSheets(sheets: RawSheet[]): RawSheet[] {
    const sel = this.rule.sheetSelection || 'first'
    switch (sel) {
      case 'all':
        return sheets
      case 'by_name':
        return sheets.filter(s => s.name === this.rule.sheetName)
      case 'by_index':
        return this.rule.sheetIndex !== undefined ? [sheets[this.rule.sheetIndex]] : [sheets[0]]
      case 'first':
      default:
        return [sheets[0]]
    }
  }

  private parseSheet(sheet: RawSheet): OrderRecord[] {
    const { rows } = sheet
    const { dataRegion, aggregation, metadataExtraction } = this.rule

    // 提取元数据（头部/尾部信息，如收货人）
    const metadata = metadataExtraction ? this.extractMetadata(rows, metadataExtraction) : {}

    // 根据聚合类型选择不同的解析策略
    if (aggregation) {
      return this.parseWithAggregation(rows, aggregation, metadata, sheet.name)
    }

    // 标准表格解析
    return this.parseStandardTable(rows, dataRegion, metadata)
  }

  private parseStandardTable(
    rows: RawRow[],
    dataRegion: typeof this.rule.dataRegion,
    metadata: Record<string, string>
  ): OrderRecord[] {
    const { headerRow, dataStartRow, dataEndRow, skipRows, skipCondition } = dataRegion
    const headers = headerRow >= 0 ? rows[headerRow]?.map(c => String(c ?? '').trim()) : []
    const endRow = dataEndRow === -1 ? rows.length : Math.min(dataEndRow, rows.length)
    const records: OrderRecord[] = []

    for (let i = dataStartRow; i < endRow; i++) {
      if (skipRows?.includes(i)) continue
      const row = rows[i]
      if (!row || row.every(c => c === null || c === undefined || c === '')) continue

      if (skipCondition) {
        const colIdx = typeof skipCondition.column === 'string'
          ? headers.indexOf(skipCondition.column)
          : skipCondition.column
        const cellVal = String(row[colIdx] ?? '')
        if (skipCondition.isEmpty && cellVal === '') continue
        if (skipCondition.contains && cellVal.includes(skipCondition.contains)) continue
      }

      const record = this.mapRowToRecord(row, headers, metadata)
      if (record) records.push(record)
    }

    return records
  }

  private parseWithAggregation(
    rows: RawRow[],
    aggregation: AggregationRule,
    metadata: Record<string, string>,
    sheetName: string
  ): OrderRecord[] {
    switch (aggregation.type) {
      case 'group_by':
        return this.parseGroupBy(rows, aggregation, metadata)
      case 'matrix_transpose':
        return this.parseMatrixTranspose(rows, aggregation, metadata)
      case 'card_split':
        return this.parseCardSplit(rows, aggregation)
      case 'multi_order_split':
        return this.parseMultiOrderSplit(rows, aggregation)
      case 'week_matrix':
        return this.parseWeekMatrix(rows, aggregation, metadata)
      case 'text_split':
        return this.parseTextSplit(rows, aggregation)
      default:
        return this.parseStandardTable(rows, this.rule.dataRegion, metadata)
    }
  }

  /** 按字段分组聚合（如湖南仓：同配送单号多行SKU共享收货人） */
  private parseGroupBy(rows: RawRow[], aggregation: AggregationRule, metadata: Record<string, string>): OrderRecord[] {
    const { dataRegion } = this.rule
    const headers = dataRegion.headerRow >= 0 ? rows[dataRegion.headerRow]?.map(c => String(c ?? '').trim()) : []
    const endRow = dataRegion.dataEndRow === -1 ? rows.length : dataRegion.dataEndRow
    const records: OrderRecord[] = []

    for (let i = dataRegion.dataStartRow; i < endRow; i++) {
      if (dataRegion.skipRows?.includes(i)) continue
      const row = rows[i]
      if (!row || row.every(c => c === null || c === undefined || c === '')) continue
      const record = this.mapRowToRecord(row, headers, metadata)
      if (record) records.push(record)
    }

    return records
  }

  /** 矩阵转置（如欢乐牧场：SKU行×门店列） */
  private parseMatrixTranspose(rows: RawRow[], aggregation: AggregationRule, metadata: Record<string, string>): OrderRecord[] {
    const { dataRegion } = this.rule
    const startCol = aggregation.dynamicColumnsStart || 0
    const headerRowIdx = dataRegion.headerRow >= 0 ? dataRegion.headerRow : 0
    const headers = rows[headerRowIdx]?.map(c => String(c ?? '').trim()) || []
    const storeNames = headers.slice(startCol)
    const endRow = dataRegion.dataEndRow === -1 ? rows.length : dataRegion.dataEndRow
    const records: OrderRecord[] = []

    for (let i = dataRegion.dataStartRow; i < endRow; i++) {
      const row = rows[i]
      if (!row || row.every(c => c === null || c === undefined || c === '')) continue

      // 获取SKU信息（前面的固定列）
      const skuInfo = this.mapRowToRecord(row, headers, metadata)
      if (!skuInfo) continue

      // 对每个门店列生成一条记录
      for (let j = 0; j < storeNames.length; j++) {
        const qty = row[startCol + j]
        if (qty === null || qty === undefined || qty === '' || qty === 0) continue
        records.push({
          ...skuInfo,
          storeName: storeNames[j] || skuInfo.storeName,
          skuQuantity: Number(qty) || 0,
        })
      }
    }

    return records
  }

  /** 卡片式拆分 */
  private parseCardSplit(rows: RawRow[], aggregation: AggregationRule): OrderRecord[] {
    const separator = aggregation.cardSeparator || '▶'
    const cards: { startRow: number; endRow: number }[] = []
    
    // 找到所有卡片边界
    for (let i = 0; i < rows.length; i++) {
      const firstCell = String(rows[i]?.[0] ?? '')
      if (firstCell.includes(separator)) {
        if (cards.length > 0) cards[cards.length - 1].endRow = i
        cards.push({ startRow: i, endRow: rows.length })
      }
    }

    const records: OrderRecord[] = []
    for (const card of cards) {
      const cardRows = rows.slice(card.startRow, card.endRow)
      // 每个卡片内提取元数据和数据
      const meta = this.rule.metadataExtraction 
        ? this.extractMetadata(cardRows, this.rule.metadataExtraction)
        : {}
      const subRecords = this.parseStandardTable(
        cardRows,
        { ...this.rule.dataRegion, dataStartRow: this.rule.dataRegion.dataStartRow, dataEndRow: -1 },
        meta
      )
      records.push(...subRecords)
    }

    return records
  }

  /** 多订单拆分（PDF多单） */
  private parseMultiOrderSplit(rows: RawRow[], aggregation: AggregationRule): OrderRecord[] {
    // Similar to card split but with different separator logic
    return this.parseCardSplit(rows, { ...aggregation, cardSeparator: aggregation.orderSeparator || '---' })
  }

  /** 周配送计划矩阵（日期×门店，复合单元格） */
  private parseWeekMatrix(rows: RawRow[], aggregation: AggregationRule, metadata: Record<string, string>): OrderRecord[] {
    const { dataRegion } = this.rule
    const headerRowIdx = dataRegion.headerRow >= 0 ? dataRegion.headerRow : 0
    const headers = rows[headerRowIdx]?.map(c => String(c ?? '').trim()) || []
    const startCol = aggregation.dynamicColumnsStart || 1
    const dateColumns = headers.slice(startCol)
    const endRow = dataRegion.dataEndRow === -1 ? rows.length : dataRegion.dataEndRow
    const records: OrderRecord[] = []
    const pattern = aggregation.valueExtractPattern || '(.+?)x(\\d+)'
    const regex = new RegExp(pattern, 'g')

    for (let i = dataRegion.dataStartRow; i < endRow; i++) {
      const row = rows[i]
      if (!row) continue
      const storeName = String(row[0] ?? '').trim()
      if (!storeName) continue

      for (let j = 0; j < dateColumns.length; j++) {
        const cellValue = String(row[startCol + j] ?? '').trim()
        if (!cellValue) continue

        // 拆分复合单元格
        const lines = cellValue.split(/[\n\r]+/)
        for (const line of lines) {
          regex.lastIndex = 0
          const match = regex.exec(line.trim())
          if (match) {
            records.push({
              storeName,
              skuCode: '',
              skuName: match[1].trim(),
              skuQuantity: parseInt(match[2]) || 0,
              remark: dateColumns[j],
              ...metadata,
            })
          }
        }
      }
    }

    return records
  }

  /** 纯文本分隔解析（Word文档） */
  private parseTextSplit(rows: RawRow[], aggregation: AggregationRule): OrderRecord[] {
    const separator = aggregation.textSeparator || '━'
    const fullText = rows.map(r => r?.map(c => String(c ?? '')).join(' ')).join('\n')
    const blocks = fullText.split(new RegExp(`[${separator}]{3,}`))
    const records: OrderRecord[] = []

    for (const block of blocks) {
      if (!block.trim()) continue
      const meta = this.extractTextFields(block)
      if (meta.skuName || meta.skuCode) {
        records.push({
          skuCode: meta.skuCode || '',
          skuName: meta.skuName || '',
          skuQuantity: parseInt(meta.skuQuantity) || 0,
          skuSpec: meta.skuSpec || '',
          storeName: meta.storeName || '',
          recipientName: meta.recipientName || '',
          recipientPhone: meta.recipientPhone || '',
          recipientAddress: meta.recipientAddress || '',
          externalCode: meta.externalCode || '',
          remark: meta.remark || '',
        })
      }
    }

    return records
  }

  /** 从纯文本块中提取字段 */
  private extractTextFields(text: string): Record<string, string> {
    const result: Record<string, string> = {}
    const { metadataExtraction } = this.rule
    if (metadataExtraction?.textPatterns) {
      for (const tp of metadataExtraction.textPatterns) {
        const regex = new RegExp(tp.pattern)
        const match = regex.exec(text)
        if (match) {
          result[tp.field] = match[tp.group || 1] || ''
        }
      }
    }
    return result
  }

  /** 提取元数据（头部/尾部信息） */
  private extractMetadata(rows: RawRow[], extraction: MetadataExtraction): Record<string, string> {
    const result: Record<string, string> = {}

    if (extraction.region === 'text_block' && extraction.textPatterns) {
      const fullText = rows.map(r => r?.map(c => String(c ?? '')).join(' ')).join('\n')
      for (const tp of extraction.textPatterns) {
        const regex = new RegExp(tp.pattern)
        const match = regex.exec(fullText)
        if (match) {
          result[tp.field] = match[tp.group || 1] || ''
        }
      }
      return result
    }

    // 按行范围提取
    const startRow = extraction.rowRange?.start ?? 0
    const endRow = extraction.rowRange?.end ?? rows.length

    for (const fm of extraction.fields) {
      const value = this.extractFieldValue(rows, fm, startRow, endRow)
      if (value) result[fm.targetField] = value
    }

    return result
  }

  private extractFieldValue(rows: RawRow[], fm: FieldMapping, startRow: number, endRow: number): string {
    switch (fm.sourceType) {
      case 'position': {
        if (!fm.position) return ''
        let rowIdx = 0
        if (fm.position.row === 'last') rowIdx = rows.length - 1
        else if (typeof fm.position.row === 'string') {
          // 搜索包含该文字的行
          rowIdx = rows.findIndex(r => r?.some(c => String(c ?? '').includes(fm.position!.row as string)))
        } else {
          rowIdx = fm.position.row
        }
        const colIdx = typeof fm.position.col === 'string'
          ? rows[rowIdx]?.findIndex(c => String(c ?? '').includes(fm.position!.col as string)) ?? 0
          : fm.position.col
        // 取该位置右边一格（通常标签在左，值在右）
        return String(rows[rowIdx]?.[colIdx + 1] ?? rows[rowIdx]?.[colIdx] ?? '')
      }
      case 'regex': {
        const text = rows.slice(startRow, endRow).map(r => r?.map(c => String(c ?? '')).join(' ')).join('\n')
        const regex = new RegExp(fm.regex || '')
        const match = regex.exec(text)
        return match?.[fm.regexGroup || 1] || ''
      }
      case 'static':
        return fm.staticValue || ''
      default:
        return ''
    }
  }

  /** 将单行映射为 OrderRecord */
  private mapRowToRecord(row: RawRow, headers: string[], metadata: Record<string, string>): OrderRecord | null {
    const record: Record<string, unknown> = { ...metadata }

    for (const fm of this.rule.fieldMappings) {
      let value: string = ''

      switch (fm.sourceType) {
        case 'column': {
          const colIdx = typeof fm.sourceColumn === 'string'
            ? headers.indexOf(fm.sourceColumn)
            : (fm.sourceColumn ?? -1)
          if (colIdx >= 0) value = String(row[colIdx] ?? '')
          break
        }
        case 'static':
          value = fm.staticValue || ''
          break
        case 'regex': {
          const colIdx = typeof fm.sourceColumn === 'string'
            ? headers.indexOf(fm.sourceColumn)
            : (fm.sourceColumn ?? 0)
          const cellText = String(row[colIdx] ?? '')
          const regex = new RegExp(fm.regex || '')
          const match = regex.exec(cellText)
          value = match?.[fm.regexGroup || 1] || ''
          break
        }
        case 'composite': {
          value = fm.compositeTemplate || ''
          // Replace {colName} or {colIndex} with actual values
          value = value.replace(/\{(\w+)\}/g, (_, key) => {
            const idx = headers.indexOf(key)
            if (idx >= 0) return String(row[idx] ?? '')
            const numIdx = parseInt(key)
            if (!isNaN(numIdx)) return String(row[numIdx] ?? '')
            return ''
          })
          break
        }
        default:
          break
      }

      if (!value && fm.defaultValue) value = fm.defaultValue
      record[fm.targetField] = value
    }

    // Map to OrderRecord fields
    return {
      externalCode: String(record.externalCode ?? record['外部编码'] ?? ''),
      storeName: String(record.storeName ?? record['收货门店'] ?? ''),
      recipientName: String(record.recipientName ?? record['收件人姓名'] ?? ''),
      recipientPhone: String(record.recipientPhone ?? record['收件人电话'] ?? ''),
      recipientAddress: String(record.recipientAddress ?? record['收件人地址'] ?? ''),
      skuCode: String(record.skuCode ?? record['SKU物品编码'] ?? ''),
      skuName: String(record.skuName ?? record['SKU物品名称'] ?? ''),
      skuQuantity: Number(record.skuQuantity ?? record['SKU发货数量'] ?? 0),
      skuSpec: String(record.skuSpec ?? record['SKU规格型号'] ?? ''),
      remark: String(record.remark ?? record['备注'] ?? ''),
    }
  }
}
