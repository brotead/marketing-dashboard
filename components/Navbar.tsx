'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { BarChart2, Target, LayoutDashboard, ShieldCheck, UserPlus, Menu, X } from 'lucide-react'
import { useState } from 'react'

const links = [
  { href: '/dashboard',   label: 'Dashboard',  icon: LayoutDashboard },
  { href: '/cashflow',    label: 'Cashflow',   icon: BarChart2 },
  { href: '/rendimiento', label: 'Objetivos',  icon: Target },
  { href: '/audit',       label: 'AD Auditor', icon: ShieldCheck },
  { href: '/onboarding',  label: 'Onboarding', icon: UserPlus },
]

export default function Navbar() {
  const path = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <nav className="sticky top-0 z-50 bg-[#080808]/95 backdrop-blur-xl border-b border-white/[0.07]">
      <div className="max-w-7xl mx-auto px-4 sm:px-8">
        <div className="flex items-center justify-between h-[60px]">

          {/* Brand */}
          <Link href="/dashboard" className="flex items-center gap-3 group shrink-0">
            <div className="w-[33px] h-[33px] rounded-xl overflow-hidden ring-1 ring-white/[0.12] group-hover:ring-white/[0.22] transition-all duration-200 shrink-0">
              <Image src="/logo.png" alt="Brote AD" width={33} height={33} className="w-full h-full object-cover" />
            </div>
            <div className="hidden sm:flex flex-col leading-none gap-[3px]">
              <span className="text-[13px] font-bold text-gray-100 tracking-tight">Brote AD</span>
              <span className="text-[10px] text-gray-500 font-medium tracking-[0.06em] uppercase">Pauta Digital</span>
            </div>
          </Link>

          {/* Desktop nav — pill container */}
          <div className="hidden sm:flex items-center gap-0.5 bg-white/[0.03] border border-white/[0.06] rounded-xl p-[5px]">
            {links.map(({ href, label, icon: Icon }) => {
              const active = path === href
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-[7px] px-3.5 py-[6px] rounded-[9px] text-[13px] font-medium transition-all duration-150 whitespace-nowrap ${
                    active
                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/40'
                      : 'text-gray-400 hover:text-gray-100 hover:bg-white/[0.06]'
                  }`}
                >
                  <Icon size={14} strokeWidth={active ? 2.5 : 1.75} />
                  <span>{label}</span>
                </Link>
              )
            })}
          </div>

          {/* Mobile hamburger */}
          <button
            className="sm:hidden p-2 rounded-xl text-gray-400 hover:text-gray-100 hover:bg-white/[0.06] transition-all duration-150"
            onClick={() => setMobileOpen(v => !v)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="sm:hidden border-t border-white/[0.06] bg-[#080808] px-3 py-2.5 space-y-0.5">
          {links.map(({ href, label, icon: Icon }) => {
            const active = path === href
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150 ${
                  active
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-400 hover:text-gray-100 hover:bg-white/[0.06]'
                }`}
              >
                <Icon size={15} strokeWidth={active ? 2.5 : 1.75} />
                {label}
              </Link>
            )
          })}
        </div>
      )}
    </nav>
  )
}
