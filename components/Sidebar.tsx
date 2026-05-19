'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import {
  BarChart2, Target, LayoutDashboard, ShieldCheck, UserPlus,
  Menu, X, Settings, Sun, Moon, LogOut, Crown, Pencil, BookOpen,
  HelpCircle, RefreshCw, AlertTriangle, FileDown, Zap, PenLine, CircleDot,
} from 'lucide-react'
import { useState, memo } from 'react'
import { useTheme } from './ThemeProvider'
import { useAuth } from '@/contexts/AuthContext'
import UsersModal from './UsersModal'

const links = [
  { href: '/dashboard',   label: 'Dashboard',  icon: LayoutDashboard },
  { href: '/cashflow',    label: 'Cashflow',   icon: BarChart2 },
  { href: '/rendimiento', label: 'Objetivos',  icon: Target },
  { href: '/audit',       label: 'Ad Health Auditor', icon: ShieldCheck },
  { href: '/onboarding',  label: 'Onboarding', icon: UserPlus },
]

const NavLinks = memo(function NavLinks({ path, onClick }: { path: string; onClick?: () => void }) {
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
                : 'text-gray-400 hover:text-gray-100 hover:bg-white/[0.06]'
            }`}
          >
            <Icon
              size={15}
              strokeWidth={active ? 2.5 : 1.75}
              className={active ? 'text-white' : 'text-gray-500 group-hover:text-gray-300 transition-colors'}
            />
            <span>{label}</span>
          </Link>
        )
      })}
    </>
  )
})

function ThemeToggle() {
  const { theme, toggle } = useTheme()
  return (
    <button
      onClick={toggle}
      className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-[13px] font-medium text-gray-400 hover:text-gray-200 hover:bg-white/[0.06] transition-all duration-150"
    >
      {theme === 'dark'
        ? <Sun size={14} strokeWidth={1.75} />
        : <Moon size={14} strokeWidth={1.75} />
      }
      <span>{theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}</span>
    </button>
  )
}

// ── Help Modal ────────────────────────────────────────────────────────────────

const HELP_CARDS = [
  {
    icon: CircleDot,
    title: 'Colores de estado',
    color: 'text-blue-400',
    content: (
      <div className="flex flex-col gap-1.5 mt-1">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
          <span className="text-[11px] text-gray-400 dark:text-gray-400">Verde — desvío entre <strong className="text-gray-200">-5% y +5%</strong></span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
          <span className="text-[11px] text-gray-400 dark:text-gray-400">Naranja — desvío entre <strong className="text-gray-200">-6% y +9%</strong></span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
          <span className="text-[11px] text-gray-400 dark:text-gray-400">Rojo — desvío <strong className="text-gray-200">mayor a ±10%</strong></span>
        </div>
      </div>
    ),
  },
  {
    icon: PenLine,
    title: 'Consumido manual',
    color: 'text-violet-400',
    content: (
      <p className="text-[11px] text-gray-400 dark:text-gray-400 mt-1 leading-relaxed">
        El consumido ingresado manualmente tiene <strong className="text-gray-200">prioridad</strong> sobre la sincronización automática.
      </p>
    ),
  },
  {
    icon: RefreshCw,
    title: 'Sincronización',
    color: 'text-cyan-400',
    content: (
      <div className="mt-1 space-y-1">
        <p className="text-[11px] text-gray-400 leading-relaxed">Cambios guardados automáticamente para todos los usuarios:</p>
        <ul className="text-[11px] text-gray-400 space-y-0.5 pl-2">
          {['Presupuestos', 'Pausas', 'Campañas', 'Consumidos'].map(i => (
            <li key={i} className="flex items-center gap-1.5"><span className="w-1 h-1 rounded-full bg-gray-600 shrink-0" />{i}</li>
          ))}
        </ul>
      </div>
    ),
  },
  {
    icon: AlertTriangle,
    title: 'Alertas',
    color: 'text-amber-400',
    content: (
      <div className="mt-1 space-y-1">
        <p className="text-[11px] text-gray-400">Detectan anomalías en:</p>
        <ul className="text-[11px] text-gray-400 space-y-0.5 pl-2">
          {['CTR bajo', 'Inversión fuera de ritmo', 'CPA elevado'].map(i => (
            <li key={i} className="flex items-center gap-1.5"><span className="w-1 h-1 rounded-full bg-gray-600 shrink-0" />{i}</li>
          ))}
        </ul>
        <p className="text-[10px] text-amber-400/80 mt-1.5">⚠ CPA solo aplica a campañas de mensajes.</p>
      </div>
    ),
  },
  {
    icon: ShieldCheck,
    title: 'Ad Health Auditor',
    color: 'text-blue-400',
    content: (
      <ul className="text-[11px] text-gray-400 space-y-0.5 pl-2 mt-1">
        {['Mismos clientes que Dashboard', 'Solo clientes activos', 'Métricas del mes actual'].map(i => (
          <li key={i} className="flex items-center gap-1.5"><span className="w-1 h-1 rounded-full bg-gray-600 shrink-0" />{i}</li>
        ))}
      </ul>
    ),
  },
  {
    icon: FileDown,
    title: 'Exportación',
    color: 'text-emerald-400',
    content: (
      <div className="mt-1 space-y-1">
        <p className="text-[11px] text-gray-400">Desde <strong className="text-gray-200">Cashflow</strong> → "Exportar reporte mensual". Incluye:</p>
        <ul className="text-[11px] text-gray-400 space-y-0.5 pl-2">
          {['Campañas', 'Presupuesto', 'Gasto real', 'Totales'].map(i => (
            <li key={i} className="flex items-center gap-1.5"><span className="w-1 h-1 rounded-full bg-gray-600 shrink-0" />{i}</li>
          ))}
        </ul>
      </div>
    ),
  },
  {
    icon: Zap,
    title: 'Actualización automática',
    color: 'text-yellow-400',
    content: (
      <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">
        Las campañas nuevas de Meta se <strong className="text-gray-200">detectan y agregan solas</strong>. Sincronización cada <strong className="text-gray-200">1 hora</strong>.
      </p>
    ),
    wide: true,
  },
]

function HelpModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-[#111111] border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center shrink-0">
              <HelpCircle size={13} className="text-white" />
            </div>
            <div>
              <h2 className="text-[14px] font-semibold text-gray-100 leading-none">Guía de uso</h2>
              <p className="text-[10px] text-gray-500 mt-0.5">Referencia rápida de la plataforma</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-white/[0.06] transition-all"
          >
            <X size={15} />
          </button>
        </div>

        {/* Cards grid */}
        <div className="p-5 grid grid-cols-2 gap-3 max-h-[70vh] overflow-y-auto">
          {HELP_CARDS.map(({ icon: Icon, title, color, content, wide }) => (
            <div
              key={title}
              className={`bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3 ${wide ? 'col-span-2' : ''}`}
            >
              <div className="flex items-center gap-2 mb-0.5">
                <Icon size={12} className={`${color} shrink-0`} strokeWidth={2} />
                <p className="text-[11px] font-semibold text-gray-300 uppercase tracking-wider">{title}</p>
              </div>
              {content}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function HelpButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-[13px] font-medium text-gray-400 hover:text-gray-200 hover:bg-white/[0.06] transition-all duration-150"
    >
      <HelpCircle size={14} strokeWidth={1.75} />
      <span>Ayuda</span>
    </button>
  )
}

// ── User panel ────────────────────────────────────────────────────────────────

const ROLE_ICONS = { super_admin: Crown, editor: Pencil, reader: BookOpen }
const ROLE_LABELS = { super_admin: 'Administrador', editor: 'Editor', reader: 'Lector' }

function UserPanel({ onOpenUsers }: { onOpenUsers: () => void }) {
  const { profile, signOut } = useAuth()
  const router = useRouter()

  const handleSignOut = async () => {
    await signOut()
    router.push('/login')
  }

  return (
    <div className="space-y-0.5">
      {profile && (() => {
        const RoleIcon = ROLE_ICONS[profile.role]
        const initials = (profile.name ?? profile.email).slice(0, 2).toUpperCase()
        return (
          <div className="flex items-center gap-3 px-3 py-2.5">
            {profile.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatar_url} alt="" className="w-7 h-7 rounded-lg object-cover shrink-0" />
            ) : (
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                {initials}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold text-gray-200 truncate leading-none mb-[3px]">
                {profile.name ?? profile.email.split('@')[0]}
              </p>
              <p className="text-[10px] text-gray-500 truncate leading-none flex items-center gap-1">
                <RoleIcon size={9} />
                {ROLE_LABELS[profile.role]}
              </p>
            </div>
          </div>
        )
      })()}

      <button
        onClick={onOpenUsers}
        className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-[13px] font-medium text-gray-400 hover:text-gray-200 hover:bg-white/[0.06] transition-all duration-150"
      >
        <Settings size={14} strokeWidth={1.75} />
        <span>Usuarios y permisos</span>
      </button>

      <button
        onClick={handleSignOut}
        className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-[13px] font-medium text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all duration-150"
      >
        <LogOut size={14} strokeWidth={1.75} />
        <span>Cerrar sesión</span>
      </button>
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function Sidebar() {
  const path = usePathname()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [showUsers,  setShowUsers]  = useState(false)
  const [showHelp,   setShowHelp]   = useState(false)

  return (
    <>
      {showUsers && <UsersModal onClose={() => setShowUsers(false)} />}
      {showHelp  && <HelpModal  onClose={() => setShowHelp(false)}  />}

      {/* ── Desktop sidebar ── */}
      <aside className="hidden lg:flex flex-col w-[240px] shrink-0 h-screen sticky top-0 bg-gray-800 dark:bg-[#0d0d0d] border-r border-white/[0.06]">
        <div className="px-5 pt-6 pb-5">
          <Link href="/dashboard" className="flex items-center gap-3 group">
            <div className="w-8 h-8 rounded-xl overflow-hidden ring-1 ring-white/[0.12] group-hover:ring-white/[0.22] transition-all duration-200 shrink-0">
              <Image src="/logo.png" alt="Brote AD" width={32} height={32} className="w-full h-full object-cover" />
            </div>
            <div className="flex flex-col leading-none gap-[3px]">
              <span className="text-[13px] font-bold text-gray-100 tracking-tight">Brote AD</span>
              <span className="text-[10px] text-gray-500 font-medium tracking-[0.06em] uppercase">Pauta Digital</span>
            </div>
          </Link>
        </div>

        <div className="mx-4 h-px bg-white/[0.05] mb-3" />
        <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
          <NavLinks path={path} />
        </nav>
        <div className="mx-4 h-px bg-white/[0.05] mb-2" />
        <div className="px-3 pb-1">
          <HelpButton onClick={() => setShowHelp(true)} />
          <ThemeToggle />
        </div>
        <div className="mx-4 h-px bg-white/[0.04] mb-3" />
        <div className="px-3 pb-5">
          <UserPanel onOpenUsers={() => setShowUsers(true)} />
        </div>
      </aside>

      {/* ── Mobile top bar ── */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 h-14 bg-gray-800/95 dark:bg-[#0d0d0d]/95 backdrop-blur-xl border-b border-white/[0.06] flex items-center justify-between px-4">
        <Link href="/dashboard" className="flex items-center gap-2.5 group">
          <div className="w-7 h-7 rounded-xl overflow-hidden ring-1 ring-white/[0.12]">
            <Image src="/logo.png" alt="Brote AD" width={28} height={28} className="w-full h-full object-cover" />
          </div>
          <span className="text-[13px] font-bold text-gray-100 tracking-tight">Brote AD</span>
        </Link>
        <button
          onClick={() => setDrawerOpen(v => !v)}
          className="p-2 rounded-xl text-gray-400 hover:text-gray-100 hover:bg-white/[0.06] transition-all duration-150"
          aria-label="Toggle menu"
        >
          {drawerOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />
      )}

      <div
        className={`lg:hidden fixed top-14 left-0 bottom-0 z-50 w-[240px] bg-gray-800 dark:bg-[#0d0d0d] border-r border-white/[0.06] flex flex-col transition-transform duration-200 ${
          drawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <nav className="flex-1 px-3 pt-3 space-y-0.5 overflow-y-auto">
          <NavLinks path={path} onClick={() => setDrawerOpen(false)} />
        </nav>
        <div className="mx-4 h-px bg-white/[0.05] mb-2" />
        <div className="px-3 pb-1">
          <HelpButton onClick={() => { setDrawerOpen(false); setShowHelp(true) }} />
          <ThemeToggle />
        </div>
        <div className="mx-4 h-px bg-white/[0.04] mb-3" />
        <div className="px-3 pb-5">
          <UserPanel onOpenUsers={() => { setDrawerOpen(false); setShowUsers(true) }} />
        </div>
      </div>
    </>
  )
}
