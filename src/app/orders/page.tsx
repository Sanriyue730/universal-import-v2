'use client'

import { useEffect, useState } from 'react'
import { List, Search, ChevronLeft, ChevronRight } from 'lucide-react'

interface OrderItem {
  id: string
  externalCode: string
  storeName: string
  recipientName: string
  recipientPhone: string
  recipientAddress: string
  skuCode: string
  skuName: string
  skuQuantity: number
  skuSpec: string
  remark: string
  createdAt: string
}

interface Pagination {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderItem[]>([])
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pageSize: 20, total: 0, totalPages: 0 })
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ externalCode: '', recipientName: '', startDate: '', endDate: '' })

  useEffect(() => {
    fetchOrders(1)
  }, [])

  async function fetchOrders(page: number) {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '20' })
      if (filters.externalCode) params.set('externalCode', filters.externalCode)
      if (filters.recipientName) params.set('recipientName', filters.recipientName)
      if (filters.startDate) params.set('startDate', filters.startDate)
      if (filters.endDate) params.set('endDate', filters.endDate)

      const res = await fetch(`/api/orders?${params}`)
      const data = await res.json()
      if (data.success) {
        setOrders(data.data.orders)
        setPagination(data.data.pagination)
      }
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  function handleSearch() {
    fetchOrders(1)
  }

  function handlePageChange(page: number) {
    fetchOrders(page)
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">运单列表</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">查看所有已导入的运单记录</p>
      </div>

      {/* 筛选栏 */}
      <div className="bg-white rounded-xl border border-[var(--border)] p-5 shadow-sm">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1">外部编码</label>
            <input
              value={filters.externalCode}
              onChange={e => setFilters(f => ({ ...f, externalCode: e.target.value }))}
              placeholder="搜索外部编码"
              className="px-3 py-2 text-sm border border-[var(--border)] rounded-lg w-40 focus:outline-none focus:border-[var(--primary)]"
            />
          </div>
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1">收件人</label>
            <input
              value={filters.recipientName}
              onChange={e => setFilters(f => ({ ...f, recipientName: e.target.value }))}
              placeholder="搜索收件人"
              className="px-3 py-2 text-sm border border-[var(--border)] rounded-lg w-40 focus:outline-none focus:border-[var(--primary)]"
            />
          </div>
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1">开始日期</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={e => setFilters(f => ({ ...f, startDate: e.target.value }))}
              className="px-3 py-2 text-sm border border-[var(--border)] rounded-lg focus:outline-none focus:border-[var(--primary)]"
            />
          </div>
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1">结束日期</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={e => setFilters(f => ({ ...f, endDate: e.target.value }))}
              className="px-3 py-2 text-sm border border-[var(--border)] rounded-lg focus:outline-none focus:border-[var(--primary)]"
            />
          </div>
          <button
            onClick={handleSearch}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--primary)] text-white text-sm font-medium hover:bg-[var(--primary-dark)] transition-colors"
          >
            <Search className="w-4 h-4" /> 查询
          </button>
        </div>
      </div>

      {/* 表格 */}
      <div className="bg-white rounded-xl border border-[var(--border)] shadow-sm overflow-hidden">
        {loading ? (
          <div className="text-center py-20 text-[var(--text-muted)]">加载中...</div>
        ) : orders.length === 0 ? (
          <div className="text-center py-20">
            <List className="w-12 h-12 mx-auto text-[var(--text-muted)] mb-4" />
            <p className="text-[var(--text-muted)]">暂无运单数据</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[var(--primary-light)] border-b border-[var(--border)]">
                  <th className="px-3 py-3 text-left font-semibold text-[var(--text-secondary)]">外部编码</th>
                  <th className="px-3 py-3 text-left font-semibold text-[var(--text-secondary)]">收货门店</th>
                  <th className="px-3 py-3 text-left font-semibold text-[var(--text-secondary)]">收件人</th>
                  <th className="px-3 py-3 text-left font-semibold text-[var(--text-secondary)]">电话</th>
                  <th className="px-3 py-3 text-left font-semibold text-[var(--text-secondary)]">地址</th>
                  <th className="px-3 py-3 text-left font-semibold text-[var(--text-secondary)]">SKU编码</th>
                  <th className="px-3 py-3 text-left font-semibold text-[var(--text-secondary)]">SKU名称</th>
                  <th className="px-3 py-3 text-left font-semibold text-[var(--text-secondary)]">数量</th>
                  <th className="px-3 py-3 text-left font-semibold text-[var(--text-secondary)]">创建时间</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order, idx) => (
                  <tr key={order.id} className={`border-b border-[var(--border)] ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} hover:bg-[var(--primary-light)] transition-colors`}>
                    <td className="px-3 py-2.5 text-[var(--text-secondary)]">{order.externalCode || '-'}</td>
                    <td className="px-3 py-2.5 text-[var(--text-secondary)]">{order.storeName || '-'}</td>
                    <td className="px-3 py-2.5 text-[var(--text-secondary)]">{order.recipientName || '-'}</td>
                    <td className="px-3 py-2.5 text-[var(--text-secondary)]">{order.recipientPhone || '-'}</td>
                    <td className="px-3 py-2.5 text-[var(--text-secondary)] max-w-[200px] truncate">{order.recipientAddress || '-'}</td>
                    <td className="px-3 py-2.5 text-[var(--text-secondary)]">{order.skuCode}</td>
                    <td className="px-3 py-2.5 text-[var(--text-secondary)]">{order.skuName}</td>
                    <td className="px-3 py-2.5 text-[var(--text-primary)] font-medium">{order.skuQuantity}</td>
                    <td className="px-3 py-2.5 text-[var(--text-muted)]">{new Date(order.createdAt).toLocaleString('zh-CN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 分页 */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--border)]">
            <span className="text-xs text-[var(--text-muted)]">
              共 {pagination.total} 条，第 {pagination.page}/{pagination.totalPages} 页
            </span>
            <div className="flex gap-1">
              <button
                disabled={pagination.page <= 1}
                onClick={() => handlePageChange(pagination.page - 1)}
                className="p-1.5 rounded-lg border border-[var(--border)] disabled:opacity-30 hover:bg-gray-50"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => handlePageChange(pagination.page + 1)}
                className="p-1.5 rounded-lg border border-[var(--border)] disabled:opacity-30 hover:bg-gray-50"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
