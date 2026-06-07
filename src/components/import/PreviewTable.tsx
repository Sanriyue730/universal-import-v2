'use client'

import { PreviewRow } from '@/types'
import { useRef, useState, useCallback } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Trash2, Plus, AlertCircle } from 'lucide-react'

interface PreviewTableProps {
  data: PreviewRow[]
  onChange: (data: PreviewRow[]) => void
}

const COLUMNS = [
  { key: 'externalCode', label: '外部编码', width: 130 },
  { key: 'storeName', label: '收货门店', width: 160 },
  { key: 'recipientName', label: '收件人姓名', width: 100 },
  { key: 'recipientPhone', label: '收件人电话', width: 130 },
  { key: 'recipientAddress', label: '收件人地址', width: 220 },
  { key: 'skuCode', label: 'SKU编码', width: 130 },
  { key: 'skuName', label: 'SKU名称', width: 180 },
  { key: 'skuQuantity', label: '数量', width: 70 },
  { key: 'skuSpec', label: '规格型号', width: 120 },
  { key: 'remark', label: '备注', width: 150 },
]

export function PreviewTable({ data, onChange }: PreviewTableProps) {
  const parentRef = useRef<HTMLDivElement>(null)
  const [editingCell, setEditingCell] = useState<{ row: number; col: string } | null>(null)
  const [editValue, setEditValue] = useState('')

  const rowVirtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 40,
    overscan: 20,
  })

  const totalWidth = COLUMNS.reduce((sum, col) => sum + col.width, 0) + 80 // +80 for row number + actions

  const startEdit = useCallback((rowIndex: number, colKey: string) => {
    setEditingCell({ row: rowIndex, col: colKey })
    const value = data[rowIndex][colKey as keyof PreviewRow]
    setEditValue(String(value ?? ''))
  }, [data])

  const commitEdit = useCallback(() => {
    if (!editingCell) return
    const { row, col } = editingCell
    const newData = [...data]
    const record = { ...newData[row] }

    if (col === 'skuQuantity') {
      ;(record as Record<string, unknown>)[col] = Number(editValue) || 0
    } else {
      ;(record as Record<string, unknown>)[col] = editValue
    }

    // Re-validate this row
    const errors: { field: string; message: string }[] = []
    if (!record.skuCode) errors.push({ field: 'skuCode', message: 'SKU物品编码不能为空' })
    if (!record.skuName) errors.push({ field: 'skuName', message: 'SKU物品名称不能为空' })
    if (!record.skuQuantity || record.skuQuantity <= 0) errors.push({ field: 'skuQuantity', message: '数量必须为正数' })
    const hasStore = !!record.storeName
    const hasRecipient = !!(record.recipientName && record.recipientPhone && record.recipientAddress)
    if (!hasStore && !hasRecipient) errors.push({ field: 'storeName', message: '门店或收件人至少填一组' })
    if (record.recipientPhone && !/^[\d\-+()\s]{7,20}$/.test(record.recipientPhone)) {
      errors.push({ field: 'recipientPhone', message: '电话格式不正确' })
    }
    record._errors = errors

    newData[row] = record
    onChange(newData)
    setEditingCell(null)
  }, [editingCell, editValue, data, onChange])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      commitEdit()
      // Move to next cell
      if (editingCell) {
        const colIdx = COLUMNS.findIndex(c => c.key === editingCell.col)
        if (e.key === 'Tab') {
          const nextCol = COLUMNS[(colIdx + 1) % COLUMNS.length]
          const nextRow = colIdx + 1 >= COLUMNS.length ? editingCell.row + 1 : editingCell.row
          if (nextRow < data.length) {
            setTimeout(() => startEdit(nextRow, nextCol.key), 0)
          }
        }
      }
    } else if (e.key === 'Escape') {
      setEditingCell(null)
    }
  }

  const deleteRow = (index: number) => {
    const newData = data.filter((_, i) => i !== index).map((r, i) => ({ ...r, _rowIndex: i + 1 }))
    onChange(newData)
  }

  const addRow = () => {
    const newRow: PreviewRow = {
      externalCode: '',
      storeName: '',
      recipientName: '',
      recipientPhone: '',
      recipientAddress: '',
      skuCode: '',
      skuName: '',
      skuQuantity: 0,
      skuSpec: '',
      remark: '',
      _rowIndex: data.length + 1,
      _errors: [
        { field: 'skuCode', message: 'SKU物品编码不能为空' },
        { field: 'skuName', message: 'SKU物品名称不能为空' },
        { field: 'skuQuantity', message: '数量必须为正数' },
        { field: 'storeName', message: '门店或收件人至少填一组' },
      ],
      _warnings: [],
    }
    onChange([...data, newRow])
  }

  function hasFieldError(row: PreviewRow, field: string) {
    return row._errors.some(e => e.field === field)
  }

  return (
    <div>
      {/* 错误汇总 */}
      {data.some(r => r._errors.length > 0) && (
        <div className="mb-4 p-3 rounded-lg bg-[var(--error-bg)] border border-red-200">
          <div className="flex items-center gap-2 text-sm text-[var(--error)] font-medium mb-2">
            <AlertCircle className="w-4 h-4" /> 数据校验错误
          </div>
          <div className="max-h-32 overflow-auto text-xs text-[var(--text-secondary)] space-y-1">
            {data.filter(r => r._errors.length > 0).slice(0, 20).map(row => (
              <div key={row._rowIndex}>
                第{row._rowIndex}行：{row._errors.map(e => `${e.message}`).join('；')}
              </div>
            ))}
            {data.filter(r => r._errors.length > 0).length > 20 && (
              <div className="text-[var(--text-muted)]">...还有 {data.filter(r => r._errors.length > 0).length - 20} 条错误</div>
            )}
          </div>
        </div>
      )}

      {/* 操作栏 */}
      <div className="flex justify-end mb-2">
        <button
          onClick={addRow}
          className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:bg-gray-50"
        >
          <Plus className="w-3 h-3" /> 新增行
        </button>
      </div>

      {/* 虚拟列表表格 */}
      <div className="border border-[var(--border)] rounded-lg overflow-hidden">
        {/* 固定表头 */}
        <div className="overflow-x-auto">
          <div style={{ width: totalWidth }} className="flex bg-[var(--primary-light)] border-b border-[var(--border)]">
            <div className="w-10 flex-shrink-0 px-2 py-2.5 text-xs font-semibold text-[var(--text-muted)] text-center">#</div>
            {COLUMNS.map(col => (
              <div key={col.key} style={{ width: col.width }} className="flex-shrink-0 px-2 py-2.5 text-xs font-semibold text-[var(--text-secondary)]">
                {col.label}
              </div>
            ))}
            <div className="w-[70px] flex-shrink-0 px-2 py-2.5 text-xs font-semibold text-[var(--text-muted)] text-center">操作</div>
          </div>
        </div>

        {/* 虚拟滚动内容 */}
        <div ref={parentRef} className="overflow-auto" style={{ height: Math.min(data.length * 40, 500) }}>
          <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, width: totalWidth, position: 'relative' }}>
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const row = data[virtualRow.index]
              const hasError = row._errors.length > 0
              return (
                <div
                  key={virtualRow.key}
                  className={`absolute top-0 left-0 w-full flex border-b border-[var(--border)] ${
                    hasError ? 'bg-[var(--error-bg)]' : row._isDuplicate ? 'bg-[var(--warning-bg)]' : virtualRow.index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                  }`}
                  style={{ height: `${virtualRow.size}px`, transform: `translateY(${virtualRow.start}px)` }}
                >
                  <div className="w-10 flex-shrink-0 px-2 flex items-center justify-center text-[10px] text-[var(--text-muted)]">
                    {row._rowIndex}
                  </div>
                  {COLUMNS.map(col => {
                    const isEditing = editingCell?.row === virtualRow.index && editingCell?.col === col.key
                    const cellError = hasFieldError(row, col.key)
                    const value = row[col.key as keyof PreviewRow]
                    return (
                      <div
                        key={col.key}
                        style={{ width: col.width }}
                        className={`flex-shrink-0 px-2 flex items-center text-xs ${
                          cellError ? 'ring-1 ring-inset ring-[var(--error)]' : ''
                        }`}
                        onClick={() => !isEditing && startEdit(virtualRow.index, col.key)}
                      >
                        {isEditing ? (
                          <input
                            autoFocus
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={commitEdit}
                            onKeyDown={handleKeyDown}
                            className="w-full h-full px-1 py-0.5 text-xs border border-[var(--primary)] rounded outline-none bg-white"
                          />
                        ) : (
                          <span className="truncate text-[var(--text-secondary)]">{String(value ?? '')}</span>
                        )}
                      </div>
                    )
                  })}
                  <div className="w-[70px] flex-shrink-0 flex items-center justify-center">
                    <button
                      onClick={() => deleteRow(virtualRow.index)}
                      className="p-1 rounded hover:bg-red-50 text-[var(--text-muted)] hover:text-[var(--error)] transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
