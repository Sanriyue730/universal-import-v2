# Universal Import V2 - 项目构建任务

## 项目概述
构建一个"万能导入V2"智能多格式批量下单系统，部署到 Vercel。

## 技术栈
- Next.js App Router + TypeScript
- Tailwind CSS（主色 #0fc6c2）
- Prisma + Neon Postgres
- 虚拟列表（@tanstack/react-virtual）
- 文件解析：xlsx, mammoth (Word), pdfjs-dist (PDF)
- LLM：DeepSeek API（用于AI辅助生成解析规则）

## 已有文件
- src/types/index.ts - 类型定义（规则引擎+订单数据）
- src/lib/rule-engine.ts - 规则引擎核心

## 核心架构：规则引擎 + AI辅助生成
**关键：不是硬编码解析逻辑，而是设计通用的规则引擎。每种新格式只需配置一条规则。**

### 规则描述语言（已在 types/index.ts 定义）
- ParseRule：完整规则，包含 sheetSelection, dataRegion, fieldMappings, aggregation, metadataExtraction
- 支持的聚合类型：group_by, matrix_transpose, card_split, multi_sheet, text_split, week_matrix, multi_order_split

### AI 辅助流程
1. 用户上传文件 → 选择"新建规则"
2. 前端提取文件前20行原始内容
3. 调用 /api/ai-generate-rule 发送内容给 DeepSeek
4. DeepSeek 分析文件结构，返回一个 ParseRule JSON
5. 用户在UI中预览/微调规则 → 保存

## 数据库 Schema（Prisma）
```prisma
model Rule {
  id          String   @id @default(cuid())
  name        String
  description String?
  fileType    String   @default("excel")
  ruleConfig  Json     // 存储完整的 ParseRule JSON
  aiGenerated Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model Order {
  id               String   @id @default(cuid())
  externalCode     String?
  storeName        String?
  recipientName    String?
  recipientPhone   String?
  recipientAddress String?
  skuCode          String
  skuName          String
  skuQuantity      Int
  skuSpec          String?
  remark           String?
  batchId          String?
  createdAt        DateTime @default(now())
}
```

## UI 设计要求
- 主色：#0fc6c2（蓝绿色）
- 圆角卡片布局，清爽风格
- 响应式设计
- Loading 状态、Toast 提示、空状态
- 表格：虚拟列表，表头固定，横向滚动，单元格可编辑

## 页面结构
1. **首页/导入页** - 文件上传区 + 规则选择/新建 + 解析执行
2. **规则管理页** - 规则列表 CRUD + AI生成入口
3. **数据预览页** - 类Excel编辑表格 + 校验 + 提交
4. **运单列表页** - 历史运单分页查看 + 筛选

## 6份Demo文件（在 ../exam/demos/ 目录下）
1. 12.25海口龙湖天街-配送发货单（黎明屯）- 干扰头部+尾部散落收货人
2. 湖南仓.xlsx - 按配送单号分组聚合
3. 欢乐牧场模板0430.xlsx - SKU×门店矩阵转置
4. 黔寨寨贵州烙锅（鞍山店）常温.pdf - PDF解析
5. 多门店分Sheet出库单.xlsx - 多Sheet合并
6. 门店调拨单-卡片式.xlsx - 卡片边界识别

## 环境变量
```
DATABASE_URL=postgresql://neondb_owner:npg_a7ghHrVjGl3S@ep-hidden-math-aq0v76kh.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require
DEEPSEEK_API_KEY=（需要配置）
```

## 性能要求
- 1000条数据从上传到展示 < 10秒（不含AI时间）
- 前端渲染1000条 < 3秒（用虚拟列表）
- 大文件不阻塞UI

## 提交要求
- 部署到 Vercel，提供URL
- Git 仓库（GitHub）
- 代码中不出现文件名判断或特定列名硬编码
