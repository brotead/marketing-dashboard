'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BarChart2, Target, LayoutDashboard, Zap } from 'lucide-react'

const links = [
  { href: '/dashboard',   label: 'Dashboard',  icon: LayoutDashboard },
  { href: '/cashflow',    label: 'Cashflow',   icon: BarChart2 },
  { href: '/rendimiento', label: 'Objetivos',  icon: Target },
  { href: '/creativos',   label: 'Creativos',  icon: Zap },
]

export default function Navbar() {
  const path = usePathname()

  return (
    <nav className="bg-white border-b border-gray-100 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-2.5">
            <div className="bg-[#0066FF] rounded-xl flex items-center justify-center w-9 h-9">
              <svg width="18" height="22" viewBox="0 0 18 22" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M2 2V20M2 11.5C2 11.5 4 8 8.5 8C13 8 16 11 16 14C16 17 13 20 8.5 20C4 20 2 17 2 17" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
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
