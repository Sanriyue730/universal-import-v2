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

  execute(sheets: RawSheet[]): ParseResult {
    try {
      const targetSheets = this.selectSheets(sheets)
      let allRecords: OrderRecord[] = []

      for (const sheet of targetSheets) {
        const records = this.parseSheet(sheet)
        allRecords = allRecords.concat(records)
      }

      return { success: true, data: allRecords, totalRows: allRecords.length, parsedRows: allRecords.length }
    } catch (error) {
      return { success: false, data: [], errors: [error instanceof Error ? error.message : String(error)], totalRows: 0, parsedRows: 0 }
    }
  }

  private selectSheets(sheets: RawSheet[]): RawSheet[] {
    const sel = this.rule.sheetSelection || 'first'
    switch (sel) {
      case 'all': return sheets
      case 'by_name': return sheets.filter(s => s.name === this.rule.sheetName)
      case 'by_index': return this.rule.sheetIndex !== undefined ? [sheets[this.rule.sheetIndex]] : [sheets[0]]
      default: return [sheets[0]]
    }
  }

  private parseSheet(sheet: RawSheet): OrderRecord[] {
    const { rows } = sheet
    const { aggregation, metadataExtraction } = this.rule

    // 提取全局元数据（头部/尾部收货人等）
    const metadata = metadataExtraction ? this.extractMetadata(rows, metadataExtraction) : {}
    // 如果是多Sheet模式，从Sheet标题或首行提取门店名
    if (this.rule.sheetSelection === 'all' && !metadata.storeName) {
      metadata.storeName = sheet.name
    }

    if (aggregation) {
      return this.parseWithAggregation(rows, aggregation, metadata)
    }
    return this.parseStandardTable(rows, metadata)
  }

  private parseStandardTable(rows: RawRow[], metadata: Record<string, string>): OrderRecord[] {
    const { dataRegion } = this.rule
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
          ? headers.indexOf(skipCondition.column) : skipCondition.column
        const cellVal = String(row[colIdx] ?? '')
        if (skipCondition.isEmpty && cellVal === '') continue
        if (skipCondition.contains && cellVal.includes(skipCondition.contains)) continue
      }

      const record = this.mapRowToRecord(row, headers, metadata)
      if (record && (record.skuName || record.skuCode)) records.push(record)
    }
    return records
  }

  private parseWithAggregation(rows: RawRow[], aggregation: AggregationRule, metadata: Record<string, string>): OrderRecord[] {
    switch (aggregation.type) {
      case 'group_by': return this.parseStandardTable(rows, metadata)
      case 'matrix_transpose': return this.parseMatrixTranspose(rows, aggregation, metadata)
      case 'card_split': return this.parseCardSplit(rows, aggregation)
      case 'multi_sheet': return this.parseStandardTable(rows, metadata)
      case 'text_split': return this.parseTextSplit(rows, aggregation)
      case 'multi_order_split': return this.parseMultiOrderSplit(rows, aggregation)
      case 'week_matrix': return this.parseWeekMatrix(rows, aggregation, metadata)
      default: return this.parseStandardTable(rows, metadata)
    }
  }

  /** 矩阵转置（如欢乐牧场：SKU行×门店列） */
  private parseMatrixTranspose(rows: RawRow[], agg: AggregationRule, metadata: Record<string, string>): OrderRecord[] {
    const { dataRegion } = this.rule
    const startCol = agg.dynamicColumnsStart || 0
    const headerRowIdx = dataRegion.headerRow >= 0 ? dataRegion.headerRow : 0
    const headers = rows[headerRowIdx]?.map(c => String(c ?? '').trim()) || []
    const storeNames = headers.slice(startCol).filter(h => h)
    const endRow = dataRegion.dataEndRow === -1 ? rows.length : dataRegion.dataEndRow
    const records: OrderRecord[] = []

    for (let i = dataRegion.dataStartRow; i < endRow; i++) {
      const row = rows[i]
      if (!row || row.every(c => c === null || c === undefined || c === '')) continue

      // 基础SKU信息从固定列获取
      const baseRecord = this.mapRowToRecord(row, headers, metadata)
      if (!baseRecord) continue

      // 对每个门店列，如果有数量则生成一条记录
      for (let j = 0; j < storeNames.length; j++) {
        const qty = row[startCol + j]
        if (qty === null || qty === undefined || qty === '' || Number(qty) === 0) continue
        records.push({
          ...baseRecord,
          storeName: storeNames[j],
          skuQuantity: Number(qty) || 0,
        })
      }
    }
    return records
  }

  /** 卡片式拆分（如门店调拨单） */
  private parseCardSplit(rows: RawRow[], agg: AggregationRule): OrderRecord[] {
    const separator = agg.cardSeparator || '▶'
    const records: OrderRecord[] = []

    // 找所有卡片边界
    const cardStarts: number[] = []
    for (let i = 0; i < rows.length; i++) {
      const firstCell = String(rows[i]?.[0] ?? '')
      if (firstCell.includes(separator)) {
        cardStarts.push(i)
      }
    }

    for (let c = 0; c < cardStarts.length; c++) {
      const start = cardStarts[c]
      const end = c + 1 < cardStarts.length ? cardStarts[c + 1] : rows.length
      const cardRows = rows.slice(start, end)

      // 从卡片中提取元数据（收货人信息）
      const meta: Record<string, string> = {}
      // 通常卡片结构: 分隔行 → 收货信息行 → 地址行 → 小表头 → 数据
      if (this.rule.metadataExtraction) {
        const extracted = this.extractMetadata(cardRows, this.rule.metadataExtraction)
        Object.assign(meta, extracted)
      } else {
        // 默认卡片元数据提取逻辑
        for (let r = 0; r < Math.min(4, cardRows.length); r++) {
          const row = cardRows[r]
          if (!row) continue
          for (let col = 0; col < row.length - 1; col += 2) {
            const key = String(row[col] ?? '').trim()
            const val = String(row[col + 1] ?? '').trim()
            if (key.includes('门店') || key.includes('调入')) meta.storeName = val
            if (key.includes('收货人') || key.includes('联系人')) meta.recipientName = val
            if (key.includes('电话')) meta.recipientPhone = val
            if (key.includes('地址')) meta.recipientAddress = val
          }
        }
      }

      // 找到卡片内的数据表头和数据
      let dataStart = -1
      let cardHeaders: string[] = []
      for (let r = 1; r < cardRows.length; r++) {
        const row = cardRows[r]
        if (!row) continue
        const firstCell = String(row[0] ?? '').trim()
        if (firstCell.includes('物品编码') || firstCell.includes('编码') || firstCell === '序号') {
          cardHeaders = row.map(c => String(c ?? '').trim())
          dataStart = r + 1
          break
        }
      }

      if (dataStart > 0) {
        for (let r = dataStart; r < cardRows.length; r++) {
          const row = cardRows[r]
          if (!row || row.every(c => c === null || c === undefined || c === '')) continue
          // 跳过合计行
          if (String(row[0] ?? '').includes('合计')) continue
          const record = this.mapRowToRecord(row, cardHeaders, meta)
          if (record && (record.skuName || record.skuCode)) records.push(record)
        }
      }
    }
    return records
  }

  /** 多订单PDF拆分 */
  private parseMultiOrderSplit(rows: RawRow[], agg: AggregationRule): OrderRecord[] {
    return this.parseCardSplit(rows, { ...agg, cardSeparator: agg.orderSeparator || '---' })
  }

  /** 周配送计划矩阵 */
  private parseWeekMatrix(rows: RawRow[], agg: AggregationRule, metadata: Record<string, string>): OrderRecord[] {
    const { dataRegion } = this.rule
    const headerRowIdx = dataRegion.headerRow >= 0 ? dataRegion.headerRow : 0
    const headers = rows[headerRowIdx]?.map(c => String(c ?? '').trim()) || []
    const startCol = agg.dynamicColumnsStart || 1
    const dateColumns = headers.slice(startCol)
    const endRow = dataRegion.dataEndRow === -1 ? rows.length : dataRegion.dataEndRow
    const records: OrderRecord[] = []
    const pattern = agg.valueExtractPattern || '(.+?)[xX×](\\d+)'
    const regex = new RegExp(pattern)

    for (let i = dataRegion.dataStartRow; i < endRow; i++) {
      const row = rows[i]
      if (!row) continue
      const storeName = String(row[0] ?? '').trim()
      if (!storeName) continue

      for (let j = 0; j < dateColumns.length; j++) {
        const cellValue = String(row[startCol + j] ?? '').trim()
        if (!cellValue) continue
        const lines = cellValue.split(/[\n\r]+/)
        for (const line of lines) {
          const match = regex.exec(line.trim())
          if (match) {
            records.push({
              storeName, skuCode: '', skuName: match[1].trim(),
              skuQuantity: parseInt(match[2]) || 0, remark: dateColumns[j], ...metadata,
            })
          }
        }
      }
    }
    return records
  }

  /** 纯文本分隔解析 */
  private parseTextSplit(rows: RawRow[], agg: AggregationRule): OrderRecord[] {
    const separator = agg.textSeparator || '━'
    const fullText = rows.map(r => (r || []).map(c => String(c ?? '')).join(' ')).join('\n')
    const blocks = fullText.split(new RegExp(`[${separator}]{3,}`))
    const records: OrderRecord[] = []
    const { metadataExtraction } = this.rule

    for (const block of blocks) {
      if (!block.trim()) continue
      const fields: Record<string, string> = {}
      if (metadataExtraction?.textPatterns) {
        for (const tp of metadataExtraction.textPatterns) {
          const r = new RegExp(tp.pattern)
          const m = r.exec(block)
          if (m) fields[tp.field] = m[tp.group || 1] || ''
        }
      }
      if (fields.skuName || fields.skuCode) {
        records.push({
          externalCode: fields.externalCode || '', storeName: fields.storeName || '',
          recipientName: fields.recipientName || '', recipientPhone: fields.recipientPhone || '',
          recipientAddress: fields.recipientAddress || '', skuCode: fields.skuCode || '',
          skuName: fields.skuName || '', skuQuantity: parseInt(fields.skuQuantity) || 0,
          skuSpec: fields.skuSpec || '', remark: fields.remark || '',
        })
      }
    }
    return records
  }

  /** 提取元数据 */
  private extractMetadata(rows: RawRow[], extraction: MetadataExtraction): Record<string, string> {
    const result: Record<string, string> = {}

    if (extraction.region === 'text_block' && extraction.textPatterns) {
      const fullText = rows.map(r => (r || []).map(c => String(c ?? '')).join(' ')).join('\n')
      for (const tp of extraction.textPatterns) {
        const r = new RegExp(tp.pattern)
        const m = r.exec(fullText)
        if (m) result[tp.field] = m[tp.group || 1] || ''
      }
      return result
    }

    // 按行提取 key-value pairs
    if (extraction.region === 'footer' || extraction.region === 'specific_row') {
      const startRow = extraction.rowRange?.start ?? 0
      const endRow = extraction.rowRange?.end ?? rows.length
      for (let i = startRow; i < Math.min(endRow, rows.length); i++) {
        const row = rows[i]
        if (!row) continue
        for (let col = 0; col < row.length - 1; col++) {
          const key = String(row[col] ?? '').trim()
          const val = String(row[col + 1] ?? '').trim()
          if (!key || !val) continue
          // 自动识别常见字段
          if (key.includes('收货人') || key.includes('联系人')) result.recipientName = val
          if (key.includes('电话') || key.includes('联系电话')) result.recipientPhone = val
          if (key.includes('地址') || key.includes('收货地址')) result.recipientAddress = val
          if (key.includes('门店') || key.includes('收货门店')) result.storeName = val
        }
      }
    }

    // 也处理显式的字段映射
    for (const fm of extraction.fields || []) {
      const value = this.extractSingleField(rows, fm, extraction.rowRange?.start ?? 0, extraction.rowRange?.end ?? rows.length)
      if (value) result[fm.targetField] = value
    }

    return result
  }

  private extractSingleField(rows: RawRow[], fm: FieldMapping, startRow: number, endRow: number): string {
    switch (fm.sourceType) {
      case 'position': {
        if (!fm.position) return ''
        let rowIdx = typeof fm.position.row === 'number' ? fm.position.row
          : fm.position.row === 'last' ? rows.length - 1
          : rows.findIndex(r => r?.some(c => String(c ?? '').includes(fm.position!.row as string)))
        if (rowIdx < 0) return ''
        const colIdx = typeof fm.position.col === 'number' ? fm.position.col
          : rows[rowIdx]?.findIndex(c => String(c ?? '').includes(fm.position!.col as string)) ?? -1
        if (colIdx < 0) return ''
        return String(rows[rowIdx]?.[colIdx + 1] ?? rows[rowIdx]?.[colIdx] ?? '')
      }
      case 'regex': {
        const text = rows.slice(startRow, endRow).map(r => (r || []).map(c => String(c ?? '')).join(' ')).join('\n')
        const regex = new RegExp(fm.regex || '')
        const match = regex.exec(text)
        return match?.[fm.regexGroup || 1] || ''
      }
      case 'static': return fm.staticValue || ''
      default: return ''
    }
  }

  /** 将单行映射为 OrderRecord */
  private mapRowToRecord(row: RawRow, headers: string[], metadata: Record<string, string>): OrderRecord | null {
    const record: Record<string, string | number> = {}

    for (const fm of this.rule.fieldMappings) {
      let value: string = ''
      switch (fm.sourceType) {
        case 'column': {
          const colIdx = typeof fm.sourceColumn === 'string'
            ? headers.indexOf(fm.sourceColumn) : (fm.sourceColumn ?? -1)
          if (colIdx >= 0) value = String(row[colIdx] ?? '').trim()
          break
        }
        case 'static': value = fm.staticValue || ''; break
        case 'regex': {
          const colIdx = typeof fm.sourceColumn === 'string'
            ? headers.indexOf(fm.sourceColumn) : (fm.sourceColumn ?? 0)
          const cellText = String(row[colIdx] ?? '')
          const regex = new RegExp(fm.regex || '')
          const match = regex.exec(cellText)
          value = match?.[fm.regexGroup || 1] || ''
          break
        }
        case 'composite': {
          value = fm.compositeTemplate || ''
          value = value.replace(/\{(\w+)\}/g, (_, key) => {
            const idx = headers.indexOf(key)
            if (idx >= 0) return String(row[idx] ?? '')
            const numIdx = parseInt(key)
            if (!isNaN(numIdx)) return String(row[numIdx] ?? '')
            return ''
          })
          break
        }
        default: break
      }
      if (!value && fm.defaultValue) value = fm.defaultValue
      record[fm.targetField] = value
    }

    return {
      externalCode: String(record.externalCode || metadata.externalCode || ''),
      storeName: String(record.storeName || metadata.storeName || ''),
      recipientName: String(record.recipientName || metadata.recipientName || ''),
      recipientPhone: String(record.recipientPhone || metadata.recipientPhone || ''),
      recipientAddress: String(record.recipientAddress || metadata.recipientAddress || ''),
      skuCode: String(record.skuCode || ''),
      skuName: String(record.skuName || ''),
      skuQuantity: Number(record.skuQuantity) || 0,
      skuSpec: String(record.skuSpec || ''),
      remark: String(record.remark || ''),
    }
  }
}
