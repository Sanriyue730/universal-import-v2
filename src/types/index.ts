// ============ 规则引擎类型定义 ============

/** 字段映射来源类型 */
export type FieldSourceType =
  | 'column'        // 从某列直接取值
  | 'static'        // 静态值（写死）
  | 'regex'         // 正则提取
  | 'composite'     // 复合提取（多列拼接等）
  | 'position'      // 按位置提取（如尾部某行某列）
  | 'cell_split'    // 单元格内拆分（如 "物品x数量"）

/** 单个字段的映射规则 */
export interface FieldMapping {
  /** 目标字段名 */
  targetField: string
  /** 来源类型 */
  sourceType: FieldSourceType
  /** 来源列名或列索引 */
  sourceColumn?: string | number
  /** 正则表达式（sourceType=regex时） */
  regex?: string
  /** 正则捕获组索引 */
  regexGroup?: number
  /** 静态值（sourceType=static时） */
  staticValue?: string
  /** 复合模板（sourceType=composite时），如 "{col1} {col2}" */
  compositeTemplate?: string
  /** 位置信息（sourceType=position时） */
  position?: { row: number | 'last' | string; col: number | string }
  /** 单元格拆分规则 */
  splitPattern?: string
  /** 默认值 */
  defaultValue?: string
}

/** 数据区域定义 */
export interface DataRegion {
  /** 表头行号（0-based），-1表示无表头 */
  headerRow: number
  /** 数据起始行号（0-based） */
  dataStartRow: number
  /** 数据结束行号，-1表示到末尾 */
  dataEndRow: number
  /** 跳过的行（如合计行） */
  skipRows?: number[]
  /** 跳过条件（如某列为空或包含特定文字） */
  skipCondition?: { column: string | number; contains?: string; isEmpty?: boolean }
}

/** 聚合规则 */
export interface AggregationRule {
  /** 聚合方式 */
  type: 'group_by' | 'matrix_transpose' | 'card_split' | 'multi_sheet' | 'multi_order_split' | 'week_matrix' | 'text_split'
  /** 分组字段（group_by时） */
  groupByField?: string | number
  /** 矩阵转置时，哪些列是动态列（门店名/日期） */
  dynamicColumnsStart?: number
  /** 卡片分隔标志（card_split时） */
  cardSeparator?: string
  /** 多订单分隔标志（multi_order_split时） */
  orderSeparator?: string
  /** 文本记录分隔符（text_split时） */
  textSeparator?: string
  /** 复合单元格拆分模式 */
  cellSplitPattern?: string
  /** 值提取模式（如 "物品名x数量"） */
  valueExtractPattern?: string
}

/** 尾部/头部信息提取规则 */
export interface MetadataExtraction {
  /** 提取区域 */
  region: 'header' | 'footer' | 'specific_row' | 'text_block'
  /** 行范围 */
  rowRange?: { start: number; end: number }
  /** 字段映射 */
  fields: FieldMapping[]
  /** 文本匹配模式（用于从纯文本中提取） */
  textPatterns?: { field: string; pattern: string; group?: number }[]
}

/** 完整的解析规则 */
export interface ParseRule {
  id: string
  /** 规则名称 */
  name: string
  /** 规则描述 */
  description?: string
  /** 适用文件格式 */
  fileType: 'excel' | 'pdf' | 'word' | 'auto'
  /** Sheet选择（Excel时） */
  sheetSelection?: 'first' | 'all' | 'by_name' | 'by_index'
  sheetName?: string
  sheetIndex?: number
  /** 数据区域定义 */
  dataRegion: DataRegion
  /** 字段映射 */
  fieldMappings: FieldMapping[]
  /** 聚合规则（可选） */
  aggregation?: AggregationRule
  /** 元数据提取（头部/尾部信息） */
  metadataExtraction?: MetadataExtraction
  /** 创建时间 */
  createdAt?: string
  /** 更新时间 */
  updatedAt?: string
  /** 是否AI生成 */
  aiGenerated?: boolean
}

// ============ 订单数据类型 ============

/** 单个SKU行 */
export interface SkuItem {
  skuCode: string       // SKU物品编码
  skuName: string       // SKU物品名称
  skuQuantity: number   // SKU发货数量
  skuSpec?: string      // SKU规格型号
}

/** 一条出库单（按外部编码聚合） */
export interface OrderRecord {
  id?: string
  externalCode?: string    // 外部编码
  storeName?: string       // 收货门店
  recipientName?: string   // 收件人姓名
  recipientPhone?: string  // 收件人电话
  recipientAddress?: string // 收件人地址
  skuCode: string          // SKU物品编码
  skuName: string          // SKU物品名称
  skuQuantity: number      // SKU发货数量
  skuSpec?: string         // SKU规格型号
  remark?: string          // 备注
}

/** 预览行（含校验状态） */
export interface PreviewRow extends OrderRecord {
  _rowIndex: number
  _errors: FieldError[]
  _warnings: FieldWarning[]
  _isDuplicate?: boolean
  _duplicateWith?: number
}

export interface FieldError {
  field: string
  message: string
}

export interface FieldWarning {
  field: string
  message: string
}

/** 解析结果 */
export interface ParseResult {
  success: boolean
  data: OrderRecord[]
  errors?: string[]
  totalRows: number
  parsedRows: number
}

/** API 响应 */
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}
