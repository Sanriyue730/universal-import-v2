# 万能导入 V2 - 智能多格式批量下单系统

## 在线地址

🔗 **https://universal-import-v2-snowy.vercel.app**

## 项目简介

通过设计通用的「解析规则引擎」+ AI 辅助生成规则，实现任意格式文件（Excel / Word / PDF）的智能解析与批量下单。

核心理念：**不为每种文件写硬编码逻辑，而是配置规则来适配不同格式**。新增第 N 种文件格式时，系统代码零改动，只需新增一条解析规则。

## 技术栈

- **框架**: Next.js 16 (App Router) + TypeScript
- **样式**: Tailwind CSS 4（主色 `#0fc6c2`）
- **数据库**: Neon PostgreSQL + Prisma 5
- **LLM**: DeepSeek API（可配置其他兼容 OpenAI 格式的 API）
- **部署**: Vercel
- **UI**: lucide-react 图标、sonner toast、react-dropzone、@tanstack/react-virtual

## 核心架构：规则引擎

### ParseRule 规则描述

每条规则由以下部分组成：
- `dataRegion`: 定义数据区域（表头行、数据起止行、跳过条件）
- `fieldMappings`: 字段映射（column / static / regex / composite / position）
- `aggregation`: 聚合策略（group_by / matrix_transpose / card_split / multi_sheet / text_split / week_matrix）
- `metadataExtraction`: 元数据提取（头部/尾部/文本块中的收货人信息）

### 支持的解析场景

| 场景 | 策略 | 示例 |
|------|------|------|
| 标准表格 | 直接映射 | 湖南仓发货明细 |
| 干扰头部+尾部信息 | footer extraction | 海口龙湖天街 |
| SKU×门店矩阵 | matrix_transpose | 欢乐牧场 |
| 多Sheet独立出库单 | multi_sheet + all | 多门店分Sheet |
| 卡片式非标表格 | card_split | 门店调拨单 |
| PDF文本解析 | text_block patterns | 黔寨寨 |

## AI 辅助生成规则

1. 上传文件后，点击「AI智能生成规则」
2. 系统提取文件前30行发送给大模型
3. 大模型分析结构并返回 ParseRule JSON
4. 用户在 UI 中预览、微调后保存

支持在前端配置 API Key（点击齿轮图标），兼容 DeepSeek / GPT / Claude 等 OpenAI 格式 API。

## 大模型调用说明

- **模型**: DeepSeek Chat (`deepseek-chat`)
- **Prompt 设计**: 系统 Prompt 定义了完整的规则 JSON Schema 和字段说明，要求模型只返回 JSON，并标注低置信度映射
- **API Key 配置**: 环境变量 `DEEPSEEK_API_KEY` 或前端界面输入

## 本地开发

```bash
# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env 填入 DATABASE_URL 和 DEEPSEEK_API_KEY

# 初始化数据库
npx prisma db push

# 启动开发服务器
npm run dev
```

## 源码仓库

- GitHub: https://github.com/Sanriyue730/universal-import-v2
