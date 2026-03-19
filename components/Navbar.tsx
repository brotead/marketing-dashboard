'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BarChart2, Target, TrendingUp, LayoutDashboard } from 'lucide-react'

const links = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/cashflow', label: 'Cashflow', icon: BarChart2 },
  { href: '/rendimiento', label: 'Objetivos', icon: Target },
]

export default function Navbar() {
  const path = usePathname()

  return (
    <nav className="bg-white border-b border-gray-100 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-2.5">
            <div className="bg-blue-600 rounded-lg p-1.5">
              <TrendingUp size={16} className="text-white" />
            </div>
            <span className="font-bold text-gray-900 text-sm">Brote AD — Pauta Digital</span>
          </div>
          <div className="flex items-center gap-1">
            {links.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
                  path === href
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Icon size={15} />
                {label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </nav>
  )
}
