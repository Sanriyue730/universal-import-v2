'use client'

import { useState, useEffect } from 'react'
import { FileUpload } from '@/components/import/FileUpload'
import { RuleSelector } from '@/components/import/RuleSelector'
import { PreviewTable } from '@/components/import/PreviewTable'
import { parseExcelBuffer, getPreviewRows } from '@/lib/file-parser'
import { RuleEngine } from '@/lib/rule-engine'
import { ParseRule, PreviewRow } from '@/types'
import { toast } from 'sonner'
import { Loader2, Sparkles, Play, Download, Send, Settings } from 'lucide-react'
import type { RawSheet } from '@/lib/file-parser'

type Step = 'upload' | 'select-rule' | 'preview'

export default function HomePage() {
  const [step, setStep] = useState<Step>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [sheets, setSheets] = useState<RawSheet[]>([])
  const [rules, setRules] = useState<ParseRule[]>([])
  const [selectedRule, setSelectedRule] = useState<ParseRule | null>(null)
  const [previewData, setPreviewData] = useState<PreviewRow[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [aiGenerating, setAiGenerating] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [apiKey, setApiKey] = useState(() => typeof window !== 'undefined' ? localStorage.getItem('ai_api_key') || '' : '')
  const [apiBaseUrl, setApiBaseUrl] = useState(() => typeof window !== 'undefined' ? localStorage.getItem('ai_base_url') || '' : '')

  // 加载规则列表
  useEffect(() => {
    fetchRules()
  }, [])

  async function fetchRules() {
    try {
      const res = await fetch('/api/rules')
      const data = await res.json()
      if (data.success) {
        setRules(data.data)
        // 如果没有规则，自动加载预设
        if (data.data.length === 0) {
          await loadPresetRules()
        }
      }
    } catch { /* ignore */ }
  }

  async function loadPresetRules() {
    try {
      const res = await fetch('/api/preset-rules', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        toast.success(`已加载 ${data.data.created} 条预设规则`)
        // 重新获取规则列表
        const res2 = await fetch('/api/rules')
        const data2 = await res2.json()
        if (data2.success) setRules(data2.data)
      }
    } catch { /* ignore */ }
  }

  // 文件选择
  async function handleFileSelect(f: File) {
    setFile(f)
    setIsProcessing(true)
    setProgress(10)

    try {
      let parsed: RawSheet[]
      const isExcel = f.name.endsWith('.xlsx') || f.name.endsWith('.xls')

      if (isExcel) {
        // Excel 前端直接解析（快速）
        const buffer = await f.arrayBuffer()
        parsed = parseExcelBuffer(buffer)
      } else {
        // PDF / Word 走服务端API解析
        setProgress(30)
        const formData = new FormData()
        formData.append('file', f)
        const res = await fetch('/api/parse-file', { method: 'POST', body: formData })
        const data = await res.json()
        if (!data.success) throw new Error(data.error)
        parsed = data.data
      }

      setSheets(parsed)
      setProgress(100)
      setStep('select-rule')
      toast.success(`文件解析成功，共 ${parsed.length} 个Sheet`)
    } catch (err) {
      toast.error(`文件解析失败: ${err}`)
    } finally {
      setIsProcessing(false)
    }
  }

  // AI生成规则
  async function handleAiGenerate() {
    if (sheets.length === 0) return
    setAiGenerating(true)

    try {
      const preview = getPreviewRows(sheets, 30)
      const fileType = file?.name.endsWith('.pdf') ? 'pdf' 
        : file?.name.endsWith('.docx') ? 'word' : 'excel'

      const res = await fetch('/api/ai-generate-rule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileContent: preview,
          fileName: file?.name,
          fileType,
          apiKey: apiKey || undefined,
          baseUrl: apiBaseUrl || undefined,
        }),
      })

      const data = await res.json()
      if (data.success) {
        const rule = { ...data.data, id: `ai_${Date.now()}` } as ParseRule
        setSelectedRule(rule)
        toast.success(data.message || 'AI规则生成成功')
      } else {
        toast.error(data.error || 'AI规则生成失败')
      }
    } catch (err) {
      toast.error(`AI调用失败: ${err}`)
    } finally {
      setAiGenerating(false)
    }
  }

  // 执行解析
  function handleExecuteParse() {
    if (!selectedRule || sheets.length === 0) return
    setIsProcessing(true)
    setProgress(0)

    try {
      const engine = new RuleEngine(selectedRule)
      const startTime = performance.now()
      const result = engine.execute(sheets)
      const elapsed = performance.now() - startTime

      if (result.success) {
        const rows: PreviewRow[] = result.data.map((record, idx) => ({
          ...record,
          _rowIndex: idx + 1,
          _errors: [],
          _warnings: [],
        }))
        // 执行校验
        const validated = validateRows(rows)
        setPreviewData(validated)
        setStep('preview')
        toast.success(`解析完成：${result.data.length} 条数据，耗时 ${elapsed.toFixed(0)}ms`)
      } else {
        toast.error(result.errors?.join(', ') || '解析失败')
      }
    } catch (err) {
      toast.error(`解析执行出错: ${err}`)
    } finally {
      setIsProcessing(false)
      setProgress(100)
    }
  }

  // 数据校验
  function validateRows(rows: PreviewRow[]): PreviewRow[] {
    const codeMap = new Map<string, number[]>()

    return rows.map((row) => {
      const errors: { field: string; message: string }[] = []

      // 必填校验
      if (!row.skuCode) errors.push({ field: 'skuCode', message: 'SKU物品编码不能为空' })
      if (!row.skuName) errors.push({ field: 'skuName', message: 'SKU物品名称不能为空' })
      if (!row.skuQuantity || row.skuQuantity <= 0) errors.push({ field: 'skuQuantity', message: 'SKU发货数量必须为正数' })

      // A组/B组校验
      const hasStore = !!row.storeName
      const hasRecipient = !!(row.recipientName && row.recipientPhone && row.recipientAddress)
      if (!hasStore && !hasRecipient) {
        errors.push({ field: 'storeName', message: '收货门店(A组)或收件人信息(B组)至少填一组' })
      }

      // 电话格式
      if (row.recipientPhone && !/^[\d\-+()\s]{7,20}$/.test(row.recipientPhone)) {
        errors.push({ field: 'recipientPhone', message: '电话格式不正确' })
      }

      // 外部编码重复检测
      if (row.externalCode) {
        if (!codeMap.has(row.externalCode)) codeMap.set(row.externalCode, [])
        codeMap.get(row.externalCode)!.push(row._rowIndex)
      }

      return { ...row, _errors: errors }
    }).map((row) => {
      if (row.externalCode && codeMap.has(row.externalCode)) {
        const indices = codeMap.get(row.externalCode)!
        if (indices.length > 1) {
          return { ...row, _isDuplicate: true, _duplicateWith: indices.find(i => i !== row._rowIndex) }
        }
      }
      return row
    })
  }

  // 保存规则
  async function handleSaveRule(rule: ParseRule) {
    try {
      const res = await fetch('/api/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: rule.name,
          description: rule.description,
          fileType: rule.fileType,
          ruleConfig: rule,
          aiGenerated: rule.aiGenerated,
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('规则保存成功')
        fetchRules()
      } else {
        toast.error(data.error || '保存失败')
      }
    } catch (err) {
      toast.error(`保存失败: ${err}`)
    }
  }

  // 提交订单
  async function handleSubmit() {
    const validRows = previewData.filter(r => r._errors.length === 0)
    const invalidRows = previewData.filter(r => r._errors.length > 0)

    if (invalidRows.length > 0) {
      toast.error(`有 ${invalidRows.length} 条数据校验不通过，请先修正`)
      return
    }

    setIsSubmitting(true)
    setProgress(0)

    try {
      const orders = validRows.map(({ _rowIndex, _errors, _warnings, _isDuplicate, _duplicateWith, ...rest }) => rest)
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orders }),
      })

      setProgress(100)
      const data = await res.json()
      if (data.success) {
        toast.success(`提交成功！成功 ${data.data.successCount} 条，失败 ${data.data.failCount} 条`)
      } else {
        toast.error(data.error || '提交失败')
      }
    } catch (err) {
      toast.error(`提交失败: ${err}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  // 导出Excel
  function handleExport() {
    import('xlsx').then((XLSX) => {
      const exportData = previewData.map(({ _rowIndex, _errors, _warnings, _isDuplicate, _duplicateWith, ...rest }) => ({
        '外部编码': rest.externalCode,
        '收货门店': rest.storeName,
        '收件人姓名': rest.recipientName,
        '收件人电话': rest.recipientPhone,
        '收件人地址': rest.recipientAddress,
        'SKU物品编码': rest.skuCode,
        'SKU物品名称': rest.skuName,
        'SKU发货数量': rest.skuQuantity,
        'SKU规格型号': rest.skuSpec,
        '备注': rest.remark,
      }))
      const ws = XLSX.utils.json_to_sheet(exportData)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, '导入数据')
      XLSX.writeFile(wb, `导出数据_${new Date().toISOString().slice(0, 10)}.xlsx`)
      toast.success('导出成功')
    })
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">导入下单</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">上传文件，选择或AI生成解析规则，智能批量下单</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--border)] text-sm text-[var(--text-muted)] hover:bg-gray-50 transition-colors"
            title="AI 设置"
          >
            <Settings className="w-4 h-4" />
          </button>
          {step === 'preview' && (
            <>
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--border)] text-sm font-medium text-[var(--text-secondary)] hover:bg-gray-50 transition-colors"
            >
              <Download className="w-4 h-4" /> 导出Excel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--primary)] text-white text-sm font-medium hover:bg-[var(--primary-dark)] transition-colors disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              提交下单
            </button>
            </>
          )}
        </div>
      </div>

      {/* 进度条 */}
      {(isProcessing || isSubmitting) && (
        <div className="w-full bg-gray-100 rounded-full h-2">
          <div
            className="bg-[var(--primary)] h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Step 1: 上传文件 */}
      <div className="bg-white rounded-xl border border-[var(--border)] p-6 shadow-sm">
        <h2 className="text-base font-semibold text-[var(--text-primary)] mb-4">① 上传文件</h2>
        <FileUpload onFileSelect={handleFileSelect} isProcessing={isProcessing} />
      </div>

      {/* Step 2: 选择规则 */}
      {step !== 'upload' && (
        <div className="bg-white rounded-xl border border-[var(--border)] p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-[var(--text-primary)]">② 选择解析规则</h2>
            <div className="flex gap-2">
              <button
                onClick={handleAiGenerate}
                disabled={aiGenerating}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gradient-to-r from-[var(--primary)] to-[#0bada9] text-white text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {aiGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                AI智能生成规则
              </button>
            </div>
          </div>

          <RuleSelector
            rules={rules}
            selectedRule={selectedRule}
            onSelect={setSelectedRule}
            onSave={handleSaveRule}
          />

          {selectedRule && (
            <div className="mt-4 flex justify-end">
              <button
                onClick={handleExecuteParse}
                disabled={isProcessing}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--primary)] text-white text-sm font-medium hover:bg-[var(--primary-dark)] transition-colors disabled:opacity-50"
              >
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                执行解析
              </button>
            </div>
          )}
        </div>
      )}

      {/* Step 3: 数据预览 */}
      {step === 'preview' && (
        <div className="bg-white rounded-xl border border-[var(--border)] p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-[var(--text-primary)]">
              ③ 数据预览
              <span className="ml-2 text-sm font-normal text-[var(--text-muted)]">
                共 {previewData.length} 条
                {previewData.filter(r => r._errors.length > 0).length > 0 && (
                  <span className="text-[var(--error)] ml-2">
                    {previewData.filter(r => r._errors.length > 0).length} 条有错误
                  </span>
                )}
              </span>
            </h2>
          </div>
          <PreviewTable data={previewData} onChange={setPreviewData} />
        </div>
      )}

      {/* AI 设置面板 */}
      {showSettings && (
        <div className="bg-white rounded-xl border border-[var(--border)] p-6 shadow-sm">
          <h2 className="text-base font-semibold text-[var(--text-primary)] mb-4">AI 模型配置</h2>
          <p className="text-xs text-[var(--text-muted)] mb-4">配置大模型 API，用于智能生成解析规则。支持 DeepSeek、OpenAI 等兼容 OpenAI 格式的 API。</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">API Key</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => { setApiKey(e.target.value); localStorage.setItem('ai_api_key', e.target.value) }}
                placeholder="sk-..."
                className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg focus:outline-none focus:border-[var(--primary)]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">API Base URL（可选）</label>
              <input
                value={apiBaseUrl}
                onChange={(e) => { setApiBaseUrl(e.target.value); localStorage.setItem('ai_base_url', e.target.value) }}
                placeholder="https://api.deepseek.com"
                className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg focus:outline-none focus:border-[var(--primary)]"
              />
            </div>
          </div>
          <p className="text-[10px] text-[var(--text-muted)] mt-3">Key 仅存储在浏览器本地，不会上传到服务器。默认使用 DeepSeek API。</p>
        </div>
      )}
    </div>
  )
}
