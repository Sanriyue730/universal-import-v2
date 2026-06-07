'use client'

import { ParseRule } from '@/types'
import { Check, Plus, Edit3 } from 'lucide-react'
import { useState } from 'react'

interface RuleSelectorProps {
  rules: ParseRule[]
  selectedRule: ParseRule | null
  onSelect: (rule: ParseRule) => void
  onSave: (rule: ParseRule) => void
}

export function RuleSelector({ rules, selectedRule, onSelect, onSave }: RuleSelectorProps) {
  const [showEditor, setShowEditor] = useState(false)
  const [editJson, setEditJson] = useState('')

  function handleEditRule() {
    if (selectedRule) {
      setEditJson(JSON.stringify(selectedRule, null, 2))
      setShowEditor(true)
    }
  }

  function handleSaveEdit() {
    try {
      const parsed = JSON.parse(editJson)
      onSave(parsed)
      setShowEditor(false)
    } catch {
      alert('JSON格式错误，请检查')
    }
  }

  // 从数据库加载的规则，ruleConfig字段才是实际的ParseRule
  function getRuleConfig(rule: unknown): ParseRule {
    const r = rule as ParseRule & { ruleConfig?: ParseRule }
    if (r.ruleConfig && typeof r.ruleConfig === 'object') {
      return { ...r.ruleConfig, id: r.id, name: r.name }
    }
    return r
  }

  return (
    <div>
      {/* 规则列表 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {rules.map((rule) => {
          const config = getRuleConfig(rule)
          const isSelected = selectedRule?.id === rule.id
          return (
            <div
              key={rule.id}
              onClick={() => onSelect(config)}
              className={`relative p-4 rounded-lg border cursor-pointer transition-all ${
                isSelected
                  ? 'border-[var(--primary)] bg-[var(--primary-light)] shadow-sm'
                  : 'border-[var(--border)] hover:border-[var(--primary-border)] hover:bg-gray-50'
              }`}
            >
              {isSelected && (
                <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[var(--primary)] flex items-center justify-center">
                  <Check className="w-3 h-3 text-white" />
                </div>
              )}
              <p className="text-sm font-medium text-[var(--text-primary)] truncate">{rule.name}</p>
              <p className="text-xs text-[var(--text-muted)] mt-1 truncate">
                {(rule as unknown as { description?: string }).description || rule.fileType || 'excel'}
              </p>
              {(rule as unknown as { aiGenerated?: boolean }).aiGenerated && (
                <span className="inline-block mt-2 text-[10px] px-1.5 py-0.5 rounded bg-[var(--primary-light)] text-[var(--primary)] border border-[var(--primary-border)]">
                  AI生成
                </span>
              )}
            </div>
          )
        })}

        {/* AI生成的当前规则（未保存） */}
        {selectedRule && !rules.find(r => r.id === selectedRule.id) && (
          <div className="relative p-4 rounded-lg border border-[var(--primary)] bg-[var(--primary-light)] shadow-sm">
            <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[var(--primary)] flex items-center justify-center">
              <Check className="w-3 h-3 text-white" />
            </div>
            <p className="text-sm font-medium text-[var(--text-primary)] truncate">{selectedRule.name}</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">AI推荐 · 未保存</p>
            <div className="flex gap-2 mt-2">
              <button
                onClick={(e) => { e.stopPropagation(); handleEditRule() }}
                className="text-[10px] px-1.5 py-0.5 rounded border border-[var(--border)] text-[var(--text-secondary)] hover:bg-white"
              >
                <Edit3 className="w-3 h-3 inline mr-0.5" /> 编辑
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onSave(selectedRule) }}
                className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--primary)] text-white"
              >
                <Plus className="w-3 h-3 inline mr-0.5" /> 保存
              </button>
            </div>
          </div>
        )}
      </div>

      {rules.length === 0 && !selectedRule && (
        <div className="text-center py-8 text-[var(--text-muted)] text-sm">
          暂无规则，请使用"AI智能生成规则"按钮自动创建
        </div>
      )}

      {/* 规则JSON编辑器 */}
      {showEditor && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-3xl max-h-[80vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
              <h3 className="text-base font-semibold">编辑解析规则</h3>
              <button onClick={() => setShowEditor(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">✕</button>
            </div>
            <div className="flex-1 overflow-auto p-6">
              <textarea
                value={editJson}
                onChange={(e) => setEditJson(e.target.value)}
                className="w-full h-96 font-mono text-xs p-4 border border-[var(--border)] rounded-lg resize-none focus:outline-none focus:border-[var(--primary)]"
                spellCheck={false}
              />
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-[var(--border)]">
              <button onClick={() => setShowEditor(false)} className="px-4 py-2 text-sm rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:bg-gray-50">取消</button>
              <button onClick={handleSaveEdit} className="px-4 py-2 text-sm rounded-lg bg-[var(--primary)] text-white hover:bg-[var(--primary-dark)]">保存规则</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
