'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { BarChart2, Target, LayoutDashboard, ShieldCheck, UserPlus, Menu, X, Settings, Sun, Moon } from 'lucide-react'
import { useState } from 'react'
import { useTheme } from './ThemeProvider'

const links = [
  { href: '/dashboard',   label: 'Dashboard',  icon: LayoutDashboard },
  { href: '/cashflow',    label: 'Cashflow',   icon: BarChart2 },
  { href: '/rendimiento', label: 'Objetivos',  icon: Target },
  { href: '/audit',       label: 'AD Auditor', icon: ShieldCheck },
  { href: '/onboarding',  label: 'Onboarding', icon: UserPlus },
]

function NavLinks({ path, onClick }: { path: string; onClick?: () => void }) {
  return (
    <>
      {links.map(({ href, label, icon: Icon }) => {
        const active = path === href
        return (
          <Link
            key={href}
            href={href}
            onClick={onClick}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-150 group ${
              active
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/30'
                : 'text-gray-500 dark:text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-black/[0.05] dark:hover:bg-white/[0.06]'
            }`}
          >
            <Icon
              size={15}
              strokeWidth={active ? 2.5 : 1.75}
              className={active ? 'text-white' : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-700 dark:group-hover:text-gray-300 transition-colors'}
            />
            <span>{label}</span>
          </Link>
        )
      })}
    </>
  )
}

function ThemeToggle() {
  const { theme, toggle } = useTheme()
  return (
    <button
      onClick={toggle}
      className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-[13px] font-medium text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-black/[0.05] dark:hover:bg-white/[0.04] transition-all duration-150"
    >
      {theme === 'dark'
        ? <Sun size={14} strokeWidth={1.75} />
        : <Moon size={14} strokeWidth={1.75} />
      }
      <span>{theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}</span>
    </button>
  )
}

export default function Sidebar() {
  const path = usePathname()
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <>
      {/* ── Desktop sidebar ── */}
      <aside className="hidden lg:flex flex-col w-[240px] shrink-0 h-screen sticky top-0 bg-white dark:bg-[#0d0d0d] border-r border-gray-200 dark:border-white/[0.06]">
        {/* Brand */}
        <div className="px-5 pt-6 pb-5">
          <Link href="/dashboard" className="flex items-center gap-3 group">
            <div className="w-8 h-8 rounded-xl overflow-hidden ring-1 ring-black/[0.08] dark:ring-white/[0.12] group-hover:ring-black/[0.16] dark:group-hover:ring-white/[0.22] transition-all duration-200 shrink-0">
              <Image src="/logo.png" alt="Brote AD" width={32} height={32} className="w-full h-full object-cover" />
            </div>
            <div className="flex flex-col leading-none gap-[3px]">
              <span className="text-[13px] font-bold text-gray-900 dark:text-gray-100 tracking-tight">Brote AD</span>
              <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium tracking-[0.06em] uppercase">Pauta Digital</span>
            </div>
          </Link>
        </div>

        {/* Divider */}
        <div className="mx-4 h-px bg-gray-200 dark:bg-white/[0.05] mb-3" />

        {/* Nav */}
        <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
          <NavLinks path={path} />
        </nav>

        {/* Theme toggle + user */}
        <div className="mx-4 h-px bg-gray-200 dark:bg-white/[0.05] mb-2" />
        <div className="px-3 pb-2">
          <ThemeToggle />
        </div>
        <div className="mx-4 h-px bg-gray-100 dark:bg-white/[0.04] mb-3" />
        <div className="px-3 pb-5">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition group cursor-pointer">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center text-white text-[11px] font-bold shrink-0">
              B
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold text-gray-700 dark:text-gray-300 truncate leading-none mb-[3px]">Brote AD</p>
              <p className="text-[10px] text-gray-400 dark:text-gray-600 truncate leading-none">Admin</p>
            </div>
            <Settings size={13} className="text-gray-400 dark:text-gray-600 group-hover:text-gray-600 dark:group-hover:text-gray-400 transition shrink-0" />
          </div>
        </div>
      </aside>

      {/* ── Mobile top bar ── */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 h-14 bg-white/95 dark:bg-[#0d0d0d]/95 backdrop-blur-xl border-b border-gray-200 dark:border-white/[0.06] flex items-center justify-between px-4">
        <Link href="/dashboard" className="flex items-center gap-2.5 group">
          <div className="w-7 h-7 rounded-xl overflow-hidden ring-1 ring-black/[0.08] dark:ring-white/[0.12]">
            <Image src="/logo.png" alt="Brote AD" width={28} height={28} className="w-full h-full object-cover" />
          </div>
          <span className="text-[13px] font-bold text-gray-900 dark:text-gray-100 tracking-tight">Brote AD</span>
        </Link>
        <button
          onClick={() => setDrawerOpen(v => !v)}
          className="p-2 rounded-xl text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-black/[0.05] dark:hover:bg-white/[0.06] transition-all duration-150"
          aria-label="Toggle menu"
        >
          {drawerOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {/* ── Mobile overlay ── */}
      {drawerOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* ── Mobile drawer ── */}
      <div
        className={`lg:hidden fixed top-14 left-0 bottom-0 z-50 w-[240px] bg-white dark:bg-[#0d0d0d] border-r border-gray-200 dark:border-white/[0.06] flex flex-col transition-transform duration-200 ${
          drawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <nav className="flex-1 px-3 pt-3 space-y-0.5 overflow-y-auto">
          <NavLinks path={path} onClick={() => setDrawerOpen(false)} />
        </nav>
        <div className="mx-4 h-px bg-gray-200 dark:bg-white/[0.05] mb-2" />
        <div className="px-3 pb-2">
          <ThemeToggle />
        </div>
        <div className="mx-4 h-px bg-gray-100 dark:bg-white/[0.04] mb-3" />
        <div className="px-3 pb-5">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition cursor-pointer">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center text-white text-[11px] font-bold shrink-0">
              B
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold text-gray-700 dark:text-gray-300 truncate leading-none mb-[3px]">Brote AD</p>
              <p className="text-[10px] text-gray-400 dark:text-gray-600 truncate leading-none">Admin</p>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
