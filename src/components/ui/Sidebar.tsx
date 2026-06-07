'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Upload, Settings, List, Home } from 'lucide-react'

const navItems = [
  { href: '/', label: '导入下单', icon: Upload },
  { href: '/rules', label: '规则管理', icon: Settings },
  { href: '/orders', label: '运单列表', icon: List },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-60 bg-white border-r border-[var(--border)] flex flex-col shadow-sm">
      {/* Logo */}
      <div className="h-16 flex items-center px-5 border-b border-[var(--border)]">
        <div className="w-8 h-8 rounded-lg bg-[var(--primary)] flex items-center justify-center">
          <Home className="w-4 h-4 text-white" />
        </div>
        <span className="ml-3 font-semibold text-lg text-[var(--text-primary)]">万能导入</span>
        <span className="ml-1 text-xs text-[var(--text-muted)] bg-[var(--primary-light)] px-1.5 py-0.5 rounded">V2</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href || 
            (item.href !== '/' && pathname.startsWith(item.href))
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-[var(--primary-light)] text-[var(--primary)] border border-[var(--primary-border)]'
                  : 'text-[var(--text-secondary)] hover:bg-gray-50 hover:text-[var(--text-primary)]'
              }`}
            >
              <Icon className={`w-4.5 h-4.5 mr-3 ${isActive ? 'text-[var(--primary)]' : ''}`} />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-[var(--border)]">
        <p className="text-xs text-[var(--text-muted)]">智能多格式批量下单</p>
      </div>
    </aside>
  )
}
