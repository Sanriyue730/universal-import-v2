import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// POST - 批量预设Demo规则
export async function POST(request: NextRequest) {
  try {
    const presetRules = getPresetRules()
    let created = 0

    for (const rule of presetRules) {
      // 用 upsert 避免重复
      await prisma.rule.upsert({
        where: { id: rule.id },
        create: rule,
        update: { ruleConfig: rule.ruleConfig, name: rule.name },
      })
      created++
    }

    return NextResponse.json({ success: true, data: { created } })
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}

function getPresetRules() {
  return [
    {
      id: 'preset_hunan',
      name: '湖南仓发货明细',
      description: '标准表格，每行含收货人，按配送单号分组',
      fileType: 'excel',
      aiGenerated: false,
      ruleConfig: {
        name: '湖南仓发货明细',
        fileType: 'excel',
        sheetSelection: 'first',
        dataRegion: { headerRow: 1, dataStartRow: 2, dataEndRow: -1 },
        fieldMappings: [
          { targetField: 'storeName', sourceType: 'column', sourceColumn: '收货机构' },
          { targetField: 'externalCode', sourceType: 'column', sourceColumn: '配送单号' },
          { targetField: 'skuCode', sourceType: 'column', sourceColumn: '物品编码*' },
          { targetField: 'skuName', sourceType: 'column', sourceColumn: '物品名称' },
          { targetField: 'skuQuantity', sourceType: 'column', sourceColumn: '发货数量*' },
          { targetField: 'skuSpec', sourceType: 'column', sourceColumn: '规格型号' },
          { targetField: 'recipientName', sourceType: 'column', sourceColumn: '收货人' },
          { targetField: 'recipientPhone', sourceType: 'column', sourceColumn: '收货电话' },
          { targetField: 'recipientAddress', sourceType: 'column', sourceColumn: '收货地址' },
          { targetField: 'remark', sourceType: 'column', sourceColumn: '物品备注' },
        ],
        aggregation: { type: 'group_by', groupByField: '配送单号' },
      },
    },
    {
      id: 'preset_haikou',
      name: '海口龙湖天街配送发货单',
      description: '干扰头部+数据+尾部收货人散落',
      fileType: 'excel',
      aiGenerated: false,
      ruleConfig: {
        name: '海口龙湖天街配送发货单',
        fileType: 'excel',
        sheetSelection: 'first',
        dataRegion: {
          headerRow: 3,
          dataStartRow: 4,
          dataEndRow: -1,
          skipCondition: { column: 0, contains: '合计' },
        },
        fieldMappings: [
          { targetField: 'skuCode', sourceType: 'column', sourceColumn: '物品编码' },
          { targetField: 'skuName', sourceType: 'column', sourceColumn: '物品名称' },
          { targetField: 'skuSpec', sourceType: 'column', sourceColumn: '规格型号' },
          { targetField: 'skuQuantity', sourceType: 'column', sourceColumn: '发货数量' },
        ],
        metadataExtraction: {
          region: 'footer',
          rowRange: { start: 7, end: 10 },
          fields: [],
        },
      },
    },
    {
      id: 'preset_huanle',
      name: '欢乐牧场模板（矩阵转置）',
      description: 'SKU×门店矩阵，门店作为列头横向排列',
      fileType: 'excel',
      aiGenerated: false,
      ruleConfig: {
        name: '欢乐牧场模板',
        fileType: 'excel',
        sheetSelection: 'first',
        dataRegion: { headerRow: 0, dataStartRow: 1, dataEndRow: -1 },
        fieldMappings: [
          { targetField: 'skuName', sourceType: 'column', sourceColumn: 'SKU名称' },
          { targetField: 'skuCode', sourceType: 'column', sourceColumn: 'SKU条码' },
          { targetField: 'skuSpec', sourceType: 'column', sourceColumn: '规格' },
        ],
        aggregation: { type: 'matrix_transpose', dynamicColumnsStart: 13 },
      },
    },
    {
      id: 'preset_multisheet',
      name: '多门店分Sheet出库单',
      description: '3个Sheet独立解析，每Sheet底部有收货人',
      fileType: 'excel',
      aiGenerated: false,
      ruleConfig: {
        name: '多门店分Sheet出库单',
        fileType: 'excel',
        sheetSelection: 'all',
        dataRegion: {
          headerRow: 3,
          dataStartRow: 4,
          dataEndRow: -1,
          skipCondition: { column: 0, contains: '合计' },
        },
        fieldMappings: [
          { targetField: 'skuCode', sourceType: 'column', sourceColumn: '物品编码' },
          { targetField: 'skuName', sourceType: 'column', sourceColumn: '物品名称' },
          { targetField: 'skuSpec', sourceType: 'column', sourceColumn: '规格型号' },
          { targetField: 'skuQuantity', sourceType: 'column', sourceColumn: '出库数量' },
        ],
        aggregation: { type: 'multi_sheet' },
        metadataExtraction: {
          region: 'footer',
          rowRange: { start: 12, end: 16 },
          fields: [],
        },
      },
    },
    {
      id: 'preset_card',
      name: '门店调拨单（卡片式）',
      description: '▶ 调拨记录分隔，每卡片含收货人和物品表',
      fileType: 'excel',
      aiGenerated: false,
      ruleConfig: {
        name: '门店调拨单-卡片式',
        fileType: 'excel',
        sheetSelection: 'first',
        dataRegion: { headerRow: -1, dataStartRow: 0, dataEndRow: -1 },
        fieldMappings: [
          { targetField: 'skuCode', sourceType: 'column', sourceColumn: '物品编码' },
          { targetField: 'skuName', sourceType: 'column', sourceColumn: '物品名称' },
          { targetField: 'skuSpec', sourceType: 'column', sourceColumn: '规格' },
          { targetField: 'skuQuantity', sourceType: 'column', sourceColumn: '数量' },
        ],
        aggregation: { type: 'card_split', cardSeparator: '▶' },
      },
    },
    {
      id: 'preset_pdf',
      name: '黔寨寨PDF配送单',
      description: 'PDF格式，表格数据+底部收货人',
      fileType: 'pdf',
      aiGenerated: false,
      ruleConfig: {
        name: '黔寨寨PDF配送单',
        fileType: 'pdf',
        sheetSelection: 'first',
        dataRegion: { headerRow: -1, dataStartRow: 0, dataEndRow: -1 },
        fieldMappings: [
          { targetField: 'skuCode', sourceType: 'column', sourceColumn: 1 },
          { targetField: 'skuName', sourceType: 'column', sourceColumn: 2 },
          { targetField: 'skuSpec', sourceType: 'column', sourceColumn: 3 },
          { targetField: 'skuQuantity', sourceType: 'column', sourceColumn: 5 },
        ],
        metadataExtraction: {
          region: 'text_block',
          textPatterns: [
            { field: 'recipientName', pattern: '收货人[：:]\\s*(.+?)\\s', group: 1 },
            { field: 'recipientPhone', pattern: '收货电话[：:]\\s*(\\d+)', group: 1 },
            { field: 'recipientAddress', pattern: '收货地址[：:]\\s*(.+?)\\s*(?:打印|备注|$)', group: 1 },
            { field: 'storeName', pattern: '收货机构[：:]\\s*(.+?)\\s', group: 1 },
          ],
        },
      },
    },
  ]
}
