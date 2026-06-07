import { NextRequest, NextResponse } from 'next/server'

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || ''
const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com'

const SYSTEM_PROMPT = `你是一个文件结构分析专家。用户会给你一个文件的前若干行原始数据，你需要分析文件结构并生成一个解析规则JSON。

规则JSON格式如下：
{
  "name": "规则名称",
  "description": "规则描述",
  "fileType": "excel" | "pdf" | "word",
  "sheetSelection": "first" | "all" | "by_name" | "by_index",
  "sheetName": "可选",
  "dataRegion": {
    "headerRow": 表头行号(0-based)，-1表示无表头,
    "dataStartRow": 数据起始行号(0-based),
    "dataEndRow": 数据结束行号(-1表示到末尾),
    "skipRows": [跳过的行号数组],
    "skipCondition": { "column": "列名或索引", "contains": "包含的文字", "isEmpty": true/false }
  },
  "fieldMappings": [
    {
      "targetField": "目标字段(externalCode/storeName/recipientName/recipientPhone/recipientAddress/skuCode/skuName/skuQuantity/skuSpec/remark)",
      "sourceType": "column" | "static" | "regex" | "composite" | "position",
      "sourceColumn": "列名或列索引",
      "regex": "正则表达式(sourceType=regex时)",
      "regexGroup": 捕获组索引,
      "staticValue": "静态值",
      "compositeTemplate": "模板如{col1} {col2}",
      "position": { "row": 行号或"last", "col": 列号 },
      "defaultValue": "默认值"
    }
  ],
  "aggregation": {
    "type": "group_by" | "matrix_transpose" | "card_split" | "multi_sheet" | "week_matrix" | "text_split" | "multi_order_split",
    "groupByField": "分组字段",
    "dynamicColumnsStart": 动态列起始索引,
    "cardSeparator": "卡片分隔标志",
    "orderSeparator": "订单分隔标志",
    "textSeparator": "文本分隔符",
    "cellSplitPattern": "复合单元格拆分模式",
    "valueExtractPattern": "值提取正则"
  },
  "metadataExtraction": {
    "region": "header" | "footer" | "specific_row" | "text_block",
    "rowRange": { "start": 起始行, "end": 结束行 },
    "fields": [同fieldMappings格式],
    "textPatterns": [{ "field": "字段名", "pattern": "正则", "group": 捕获组 }]
  }
}

目标字段说明：
- externalCode: 外部编码（订单唯一编号）
- storeName: 收货门店
- recipientName: 收件人姓名
- recipientPhone: 收件人电话
- recipientAddress: 收件人地址
- skuCode: SKU物品编码
- skuName: SKU物品名称
- skuQuantity: SKU发货数量
- skuSpec: SKU规格型号
- remark: 备注

分析要点：
1. 识别表头行位置（可能不是第一行，有干扰性头部信息）
2. 识别数据区域（起止行）
3. 识别是否有合计行需要跳过
4. 判断文件结构类型（标准表格/矩阵/卡片式/多Sheet等）
5. 找到字段和列的对应关系
6. 如果收货人信息在尾部/头部单独区域，用metadataExtraction描述
7. 标注哪些映射是确定的，哪些是推测的

请只返回JSON，不要其他文字。如果某个字段映射是推测的，在该映射中加 "confidence": "low"。`

export async function POST(request: NextRequest) {
  try {
    const { fileContent, fileName, fileType } = await request.json()

    if (!fileContent) {
      return NextResponse.json({ success: false, error: '文件内容不能为空' }, { status: 400 })
    }

    if (!DEEPSEEK_API_KEY) {
      // Fallback: 返回一个基础规则模板让用户手动配置
      return NextResponse.json({
        success: true,
        data: generateFallbackRule(fileName, fileType),
        aiGenerated: false,
        message: 'AI API Key未配置，已生成基础规则模板，请手动配置'
      })
    }

    const userPrompt = `请分析以下文件内容并生成解析规则：

文件名：${fileName}
文件类型：${fileType}

文件内容（前若干行）：
${fileContent}`

    const response = await fetch(`${DEEPSEEK_BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.1,
        max_tokens: 4096,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      return NextResponse.json({ 
        success: false, 
        error: `AI API调用失败: ${response.status} ${errorText}` 
      }, { status: 500 })
    }

    const result = await response.json()
    const content = result.choices?.[0]?.message?.content || ''
    
    // 提取JSON（可能被包裹在```json```中）
    let ruleJson
    try {
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/\{[\s\S]*\}/)
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content
      ruleJson = JSON.parse(jsonStr)
    } catch {
      return NextResponse.json({ 
        success: false, 
        error: 'AI返回的规则格式无法解析',
        rawContent: content 
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: ruleJson,
      aiGenerated: true,
      message: 'AI已分析文件并生成推荐规则，请确认后保存'
    })
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}

function generateFallbackRule(fileName: string, fileType: string) {
  return {
    name: `规则 - ${fileName}`,
    description: '基础规则模板，请手动配置字段映射',
    fileType: fileType || 'excel',
    sheetSelection: 'first',
    dataRegion: {
      headerRow: 0,
      dataStartRow: 1,
      dataEndRow: -1,
    },
    fieldMappings: [
      { targetField: 'externalCode', sourceType: 'column', sourceColumn: 0 },
      { targetField: 'storeName', sourceType: 'column', sourceColumn: 1 },
      { targetField: 'recipientName', sourceType: 'column', sourceColumn: 2 },
      { targetField: 'recipientPhone', sourceType: 'column', sourceColumn: 3 },
      { targetField: 'recipientAddress', sourceType: 'column', sourceColumn: 4 },
      { targetField: 'skuCode', sourceType: 'column', sourceColumn: 5 },
      { targetField: 'skuName', sourceType: 'column', sourceColumn: 6 },
      { targetField: 'skuQuantity', sourceType: 'column', sourceColumn: 7 },
      { targetField: 'skuSpec', sourceType: 'column', sourceColumn: 8 },
      { targetField: 'remark', sourceType: 'column', sourceColumn: 9 },
    ],
  }
}
