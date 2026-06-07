'use client'

import { Bell, HelpCircle } from 'lucide-react'

export function TopBar() {
  return (
    <header className="h-12 bg-white border-b border-[var(--border)] flex items-center justify-between px-6 flex-shrink-0">
      <div className="flex items-center gap-2">
        <span className="text-xs text-[var(--text-muted)]">智能多格式批量下单系统</span>
      </div>
      <div className="flex items-center gap-4">
        <button className="p-1.5 rounded-lg hover:bg-gray-50 text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors">
          <HelpCircle className="w-4 h-4" />
        </button>
        <button className="p-1.5 rounded-lg hover:bg-gray-50 text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors relative">
          <Bell className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-2 pl-4 border-l border-[var(--border)]">
          <div className="w-7 h-7 rounded-full bg-[var(--primary)] flex items-center justify-center">
            <span className="text-xs text-white font-medium">管</span>
          </div>
          <span className="text-xs text-[var(--text-secondary)]">管理员</span>
        </div>
      </div>
    </header>
  )
}
