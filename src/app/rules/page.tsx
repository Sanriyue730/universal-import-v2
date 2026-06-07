'use client'

import { useEffect, useState } from 'react'
import { Settings, Trash2, Copy, Edit3, Plus } from 'lucide-react'
import { toast } from 'sonner'

interface RuleItem {
  id: string
  name: string
  description?: string
  fileType: string
  aiGenerated: boolean
  createdAt: string
  ruleConfig: unknown
}

export default function RulesPage() {
  const [rules, setRules] = useState<RuleItem[]>([])
  const [loading, setLoading] = useState(true)
  const [editingRule, setEditingRule] = useState<RuleItem | null>(null)
  const [editJson, setEditJson] = useState('')
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')

  useEffect(() => {
    fetchRules()
  }, [])

  async function fetchRules() {
    try {
      const res = await fetch('/api/rules')
      const data = await res.json()
      if (data.success) setRules(data.data)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  async function deleteRule(id: string) {
    if (!confirm('确定删除该规则？')) return
    try {
      const res = await fetch(`/api/rules/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        toast.success('删除成功')
        fetchRules()
      } else {
        toast.error(data.error)
      }
    } catch (err) {
      toast.error(`删除失败: ${err}`)
    }
  }

  async function duplicateRule(rule: RuleItem) {
    try {
      const res = await fetch('/api/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${rule.name} (副本)`,
          description: rule.description,
          fileType: rule.fileType,
          ruleConfig: rule.ruleConfig,
          aiGenerated: false,
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('复制成功')
        fetchRules()
      }
    } catch (err) {
      toast.error(`复制失败: ${err}`)
    }
  }

  function openEditor(rule: RuleItem) {
    setEditingRule(rule)
    setEditName(rule.name)
    setEditDesc(rule.description || '')
    setEditJson(JSON.stringify(rule.ruleConfig, null, 2))
  }

  async function saveEdit() {
    if (!editingRule) return
    try {
      const ruleConfig = JSON.parse(editJson)
      const res = await fetch(`/api/rules/${editingRule.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName,
          description: editDesc,
          ruleConfig,
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('保存成功')
        setEditingRule(null)
        fetchRules()
      } else {
        toast.error(data.error)
      }
    } catch {
      toast.error('JSON格式错误')
    }
  }

  async function createNewRule() {
    const defaultConfig = {
      name: '新规则',
      fileType: 'excel',
      sheetSelection: 'first',
      dataRegion: { headerRow: 0, dataStartRow: 1, dataEndRow: -1 },
      fieldMappings: [
        { targetField: 'skuCode', sourceType: 'column', sourceColumn: 0 },
        { targetField: 'skuName', sourceType: 'column', sourceColumn: 1 },
        { targetField: 'skuQuantity', sourceType: 'column', sourceColumn: 2 },
      ],
    }
    try {
      const res = await fetch('/api/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: '新规则',
          description: '手动创建的规则',
          fileType: 'excel',
          ruleConfig: defaultConfig,
          aiGenerated: false,
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('创建成功')
        fetchRules()
        openEditor(data.data)
      }
    } catch (err) {
      toast.error(`创建失败: ${err}`)
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">规则管理</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">管理解析规则，支持创建、编辑、复制和删除</p>
        </div>
        <button
          onClick={createNewRule}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--primary)] text-white text-sm font-medium hover:bg-[var(--primary-dark)] transition-colors"
        >
          <Plus className="w-4 h-4" /> 新建规则
        </button>
      </div>

      {loading ? (
        <div className="text-center py-20 text-[var(--text-muted)]">加载中...</div>
      ) : rules.length === 0 ? (
        <div className="text-center py-20">
          <Settings className="w-12 h-12 mx-auto text-[var(--text-muted)] mb-4" />
          <p className="text-[var(--text-muted)]">暂无规则</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">在导入页面使用AI生成，或点击上方"新建规则"手动创建</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {rules.map((rule) => (
            <div key={rule.id} className="bg-white rounded-xl border border-[var(--border)] p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-[var(--text-primary)]">{rule.name}</h3>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-[var(--text-muted)]">{rule.fileType}</span>
                    {rule.aiGenerated && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--primary-light)] text-[var(--primary)] border border-[var(--primary-border)]">AI生成</span>
                    )}
                  </div>
                  {rule.description && (
                    <p className="text-xs text-[var(--text-muted)] mt-1">{rule.description}</p>
                  )}
                  <p className="text-[10px] text-[var(--text-muted)] mt-2">
                    创建于 {new Date(rule.createdAt).toLocaleString('zh-CN')}
                  </p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEditor(rule)} className="p-2 rounded-lg hover:bg-gray-50 text-[var(--text-muted)] hover:text-[var(--primary)]" title="编辑">
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button onClick={() => duplicateRule(rule)} className="p-2 rounded-lg hover:bg-gray-50 text-[var(--text-muted)] hover:text-[var(--primary)]" title="复制">
                    <Copy className="w-4 h-4" />
                  </button>
                  <button onClick={() => deleteRule(rule.id)} className="p-2 rounded-lg hover:bg-red-50 text-[var(--text-muted)] hover:text-[var(--error)]" title="删除">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 编辑弹窗 */}
      {editingRule && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
              <h3 className="text-base font-semibold">编辑规则</h3>
              <button onClick={() => setEditingRule(null)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-lg">✕</button>
            </div>
            <div className="flex-1 overflow-auto p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">规则名称</label>
                <input value={editName} onChange={e => setEditName(e.target.value)} className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg focus:outline-none focus:border-[var(--primary)]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">描述</label>
                <input value={editDesc} onChange={e => setEditDesc(e.target.value)} className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg focus:outline-none focus:border-[var(--primary)]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">规则配置 (JSON)</label>
                <textarea
                  value={editJson}
                  onChange={e => setEditJson(e.target.value)}
                  className="w-full h-80 font-mono text-xs p-4 border border-[var(--border)] rounded-lg resize-none focus:outline-none focus:border-[var(--primary)]"
                  spellCheck={false}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-[var(--border)]">
              <button onClick={() => setEditingRule(null)} className="px-4 py-2 text-sm rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:bg-gray-50">取消</button>
              <button onClick={saveEdit} className="px-4 py-2 text-sm rounded-lg bg-[var(--primary)] text-white hover:bg-[var(--primary-dark)]">保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
