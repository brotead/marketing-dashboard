'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import {
  Mail, Lock, Eye, EyeOff, ArrowRight, Pencil, BookOpen,
  AlertCircle, LayoutDashboard, BarChart2, Target, ShieldCheck, UserPlus,
} from 'lucide-react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'

// ── Fake dashboard silhouette (blurred behind the login card) ────────────────
function DashboardBg() {
  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', active: true },
    { icon: BarChart2,       label: 'Cashflow' },
    { icon: Target,          label: 'Objetivos' },
    { icon: ShieldCheck,     label: 'AD Auditor' },
    { icon: UserPlus,        label: 'Onboarding' },
  ]
  const cards = [
    { name: 'AECO', meta: 420000, google: 180000, color: 'bg-[#1877F2]' },
    { name: 'Duraplas', meta: 310000, google: 0, color: 'bg-[#1877F2]' },
    { name: 'Agro Norte', meta: 550000, google: 220000, color: 'bg-[#4285F4]' },
    { name: 'Windsor SA', meta: 190000, google: 95000, color: 'bg-[#1877F2]' },
    { name: 'Terrazas', meta: 280000, google: 140000, color: 'bg-[#4285F4]' },
    { name: 'Pilay', meta: 730000, google: 310000, color: 'bg-[#1877F2]' },
  ]

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none select-none">
      <div className="flex h-full">
        {/* Sidebar */}
        <div className="w-[220px] shrink-0 bg-[#0d0d0d] border-r border-white/[0.06] flex flex-col">
          {/* Brand */}
          <div className="px-5 pt-6 pb-5 flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-white/10" />
            <div>
              <div className="w-16 h-3 bg-white/20 rounded mb-1.5" />
              <div className="w-12 h-2 bg-white/10 rounded" />
            </div>
          </div>
          <div className="mx-4 h-px bg-white/[0.05] mb-3" />
          {/* Nav */}
          <nav className="flex-1 px-3 space-y-0.5">
            {navItems.map(({ icon: Icon, label, active }) => (
              <div key={label} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl ${active ? 'bg-blue-600' : ''}`}>
                <Icon size={14} className={active ? 'text-white' : 'text-gray-600'} strokeWidth={1.75} />
                <div className={`h-2.5 rounded ${active ? 'bg-white/70 w-16' : 'bg-white/20 w-14'}`} />
              </div>
            ))}
          </nav>
          {/* Bottom user */}
          <div className="mx-4 h-px bg-white/[0.04] my-3" />
          <div className="px-3 pb-5 flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-600 to-blue-600 shrink-0" />
            <div>
              <div className="w-14 h-2.5 bg-white/20 rounded mb-1.5" />
              <div className="w-10 h-2 bg-white/10 rounded" />
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 bg-[#0f0f0f] overflow-hidden">
          {/* Header */}
          <div className="px-10 pt-8 pb-6 flex items-center justify-between">
            <div>
              <div className="w-32 h-4 bg-white/20 rounded mb-2" />
              <div className="w-48 h-2.5 bg-white/10 rounded" />
            </div>
            <div className="flex gap-2">
              <div className="w-24 h-8 bg-white/[0.06] rounded-xl border border-white/[0.06]" />
              <div className="w-28 h-8 bg-gradient-to-r from-violet-600/50 to-blue-600/50 rounded-xl" />
              <div className="w-8 h-8 bg-white/[0.06] rounded-xl border border-white/[0.06]" />
            </div>
          </div>

          {/* Stats row */}
          <div className="px-10 grid grid-cols-4 gap-4 mb-6">
            {['Clientes activos', 'Gasto total mes', 'Meta Ads', 'Google Ads'].map((label, i) => (
              <div key={label} className="bg-[#161616] border border-white/[0.06] rounded-2xl p-4">
                <div className="w-20 h-2 bg-white/10 rounded mb-3" />
                <div className={`h-6 rounded ${['w-10', 'w-24', 'w-20', 'w-16'][i]} bg-white/20`} />
                <div className="w-16 h-2 bg-white/[0.08] rounded mt-2" />
              </div>
            ))}
          </div>

          {/* Client cards grid */}
          <div className="px-10 grid grid-cols-2 gap-3">
            {cards.map((c) => (
              <div key={c.name} className="bg-[#161616] border border-white/[0.06] rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${c.color}`} />
                    <div className="w-20 h-3 bg-white/20 rounded" />
                  </div>
                  <div className="w-12 h-5 bg-white/[0.06] rounded-lg border border-white/[0.06]" />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-2 bg-white/10 rounded" />
                    <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                      <div className="h-full bg-[#1877F2]/60 rounded-full" style={{ width: `${(c.meta / 800000) * 100}%` }} />
                    </div>
                    <div className="w-14 h-2 bg-white/15 rounded" />
                  </div>
                  {c.google > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-2 bg-white/10 rounded" />
                      <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                        <div className="h-full bg-[#4285F4]/60 rounded-full" style={{ width: `${(c.google / 800000) * 100}%` }} />
                      </div>
                      <div className="w-14 h-2 bg-white/15 rounded" />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Blur + dim overlay */}
      <div className="absolute inset-0 backdrop-blur-[6px] bg-black/50" />
    </div>
  )
}

// ── Error mapper ──────────────────────────────────────────────────────────────
function mapAuthError(msg: string, mode: 'signin' | 'signup'): { text: string; hint?: 'switch_to_signin' } {
  const m = msg.toLowerCase()
  if (mode === 'signup') {
    if (m.includes('already registered') || m.includes('already exists') || m.includes('user already'))
      return { text: 'Este email ya tiene una cuenta.', hint: 'switch_to_signin' }
    if (m.includes('password') && m.includes('least'))
      return { text: 'La contraseña debe tener al menos 6 caracteres.' }
  }
  if (mode === 'signin') {
    if (m.includes('invalid login') || m.includes('invalid credentials') || m.includes('wrong'))
      return { text: 'Email o contraseña incorrectos.' }
    if (m.includes('too many'))
      return { text: 'Demasiados intentos. Esperá unos minutos.' }
  }
  return { text: 'Ocurrió un error. Intentá de nuevo.' }
}

// ── Role card ─────────────────────────────────────────────────────────────────
function RoleCard({ selected, onClick, icon: Icon, title, description, accent }: {
  selected: boolean; onClick: () => void; icon: React.ElementType
  title: string; description: string; accent: 'violet' | 'blue'
}) {
  return (
    <button type="button" onClick={onClick}
      className={`w-full text-left p-4 rounded-2xl border-2 transition-all duration-200 ${
        selected
          ? accent === 'violet' ? 'border-violet-500 bg-violet-500/10' : 'border-blue-500 bg-blue-500/10'
          : 'border-white/10 bg-white/5 hover:border-white/20'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
          selected ? accent === 'violet' ? 'bg-violet-500/20' : 'bg-blue-500/20' : 'bg-white/10'
        }`}>
          <Icon size={17} className={selected ? accent === 'violet' ? 'text-violet-400' : 'text-blue-400' : 'text-gray-400'} />
        </div>
        <div>
          <p className={`text-sm font-bold mb-0.5 ${selected ? 'text-white' : 'text-gray-300'}`}>{title}</p>
          <p className="text-xs text-gray-500 leading-relaxed">{description}</p>
        </div>
        <div className={`ml-auto w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
          selected ? accent === 'violet' ? 'border-violet-500' : 'border-blue-500' : 'border-gray-600'
        }`}>
          {selected && <div className={`w-2 h-2 rounded-full ${accent === 'violet' ? 'bg-violet-500' : 'bg-blue-500'}`} />}
        </div>
      </div>
    </button>
  )
}

// ── Main inner component ──────────────────────────────────────────────────────
function LoginInner() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const supabase     = createSupabaseBrowser()

  type Step = 'login' | 'role'
  const [step,         setStep]         = useState<Step>('login')
  const [mode,         setMode]         = useState<'signin' | 'signup'>('signin')
  const [email,        setEmail]        = useState('')
  const [password,     setPassword]     = useState('')
  const [confirmPw,    setConfirmPw]    = useState('')
  const [showPw,       setShowPw]       = useState(false)
  const [showConfirm,  setShowConfirm]  = useState(false)
  const [selectedRole, setSelectedRole] = useState<'editor' | 'reader' | null>(null)
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState('')
  const [errorHint,    setErrorHint]    = useState<'switch_to_signin' | undefined>()
  const [userId,       setUserId]       = useState<string | null>(null)

  useEffect(() => {
    if (searchParams.get('error')) setError('Hubo un problema. Intentá de nuevo.')
  }, [searchParams]) // eslint-disable-line react-hooks/exhaustive-deps

  function switchMode(next: 'signin' | 'signup') {
    setMode(next); setError(''); setErrorHint(undefined); setPassword(''); setConfirmPw('')
  }

  function validate(): string | null {
    if (!email.trim()) return 'Ingresá tu email.'
    if (!password)     return 'Ingresá tu contraseña.'
    if (mode === 'signup') {
      if (password.length < 6)        return 'La contraseña debe tener al menos 6 caracteres.'
      if (password !== confirmPw)     return 'Las contraseñas no coinciden.'
    }
    return null
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setErrorHint(undefined)
    const ve = validate()
    if (ve) { setError(ve); return }
    setLoading(true)

    if (mode === 'signin') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        const m = mapAuthError(error.message, 'signin')
        setError(m.text); setErrorHint(m.hint); setLoading(false); return
      }
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles').select('role_selected').eq('id', session.user.id).single()
        if (!profile?.role_selected) { setUserId(session.user.id); setStep('role'); setLoading(false); return }
      }
      router.push('/dashboard')

    } else {
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) {
        const m = mapAuthError(error.message, 'signup')
        setError(m.text); setErrorHint(m.hint); setLoading(false); return
      }
      // identities:[] means email already registered (Supabase silent duplicate behavior)
      if (!data.user || data.user.identities?.length === 0) {
        setError('Este email ya tiene una cuenta.'); setErrorHint('switch_to_signin'); setLoading(false); return
      }
      setUserId(data.user.id)
      setStep('role')
      setLoading(false)
    }
  }

  async function confirmRole() {
    if (!selectedRole || !userId) return
    setLoading(true)
    await supabase.from('profiles').update({ role: selectedRole, role_selected: true }).eq('id', userId)
    router.push('/dashboard')
  }

  // ── ROLE PICKER ──────────────────────────────────────────────────────────────
  if (step === 'role') return (
    <>
      <DashboardBg />
      <div className="fixed inset-0 flex items-center justify-center p-4 z-10">
        <div className="w-full max-w-sm">
          <div className="flex justify-center mb-7">
            <div className="w-12 h-12 rounded-2xl overflow-hidden ring-1 ring-white/20 shadow-2xl">
              <Image src="/logo.png" alt="Brote AD" width={48} height={48} className="w-full h-full object-cover" />
            </div>
          </div>
          <div className="bg-[#111]/90 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 shadow-2xl">
            <div className="text-center mb-7">
              <h1 className="text-xl font-bold text-white mb-1.5">¿Cómo vas a usar Brote AD?</h1>
              <p className="text-sm text-gray-400">Elegí tu rol de acceso.</p>
            </div>
            <div className="space-y-3 mb-7">
              <RoleCard selected={selectedRole === 'editor'} onClick={() => setSelectedRole('editor')}
                icon={Pencil} title="Editor" accent="violet"
                description="Crear clientes, editar presupuestos, configurar objetivos y operar el panel completo." />
              <RoleCard selected={selectedRole === 'reader'} onClick={() => setSelectedRole('reader')}
                icon={BookOpen} title="Lector" accent="blue"
                description="Ver métricas, dashboards y reportes. Sin acceso a edición o creación." />
            </div>
            <button onClick={confirmRole} disabled={!selectedRole || loading}
              className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-violet-600 to-blue-600 text-white rounded-2xl text-sm font-bold hover:from-violet-700 hover:to-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-lg shadow-violet-900/30">
              {loading ? 'Ingresando…' : <>Ingresar a Brote AD <ArrowRight size={15} /></>}
            </button>
          </div>
        </div>
      </div>
    </>
  )

  // ── LOGIN / REGISTRO ──────────────────────────────────────────────────────────
  return (
    <>
      <DashboardBg />
      <div className="fixed inset-0 flex items-center justify-center p-4 z-10">
        <div className="w-full max-w-sm">
          {/* Logo */}
          <div className="flex flex-col items-center mb-7">
            <div className="w-14 h-14 rounded-2xl overflow-hidden ring-1 ring-white/20 mb-4 shadow-2xl">
              <Image src="/logo.png" alt="Brote AD" width={56} height={56} className="w-full h-full object-cover" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Brote AD</h1>
            <p className="text-sm text-gray-400 mt-1">Panel de pauta digital</p>
          </div>

          {/* Card */}
          <div className="bg-[#111]/90 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 shadow-2xl">
            <p className="text-center text-sm font-semibold text-gray-300 mb-5">
              {mode === 'signin' ? 'Iniciá sesión' : 'Crear cuenta'}
            </p>

            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                <div className="flex items-start gap-2">
                  <AlertCircle size={14} className="text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-red-400">{error}</p>
                    {errorHint === 'switch_to_signin' && (
                      <button onClick={() => switchMode('signin')}
                        className="text-xs text-violet-400 hover:text-violet-300 font-medium mt-1 transition">
                        Ir a iniciar sesión →
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="relative">
                <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="tu@email.com" required autoComplete="email"
                  className="login-input w-full pl-9 pr-4 py-2.5 rounded-xl text-sm placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/40 transition" />
              </div>

              <div className="relative">
                <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                  placeholder={mode === 'signup' ? 'Mínimo 6 caracteres' : 'Contraseña'} required
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  className="login-input w-full pl-9 pr-10 py-2.5 rounded-xl text-sm placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/40 transition" />
                <button type="button" onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition">
                  {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>

              {mode === 'signup' && (
                <div className="relative">
                  <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                  <input type={showConfirm ? 'text' : 'password'} value={confirmPw}
                    onChange={e => setConfirmPw(e.target.value)}
                    placeholder="Repetir contraseña" required autoComplete="new-password"
                    className={`login-input w-full pl-9 pr-10 py-2.5 rounded-xl text-sm placeholder:text-gray-500 focus:outline-none focus:ring-2 transition ${
                      confirmPw && confirmPw !== password ? 'border-red-500/50 focus:ring-red-500/40' : 'focus:ring-violet-500/40'
                    }`} />
                  <button type="button" onClick={() => setShowConfirm(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition">
                    {showConfirm ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                  {confirmPw && confirmPw !== password && (
                    <p className="text-[11px] text-red-400 mt-1 ml-1">Las contraseñas no coinciden</p>
                  )}
                </div>
              )}

              <button type="submit" disabled={loading}
                className="w-full py-2.5 bg-gradient-to-r from-violet-600 to-blue-600 text-white rounded-xl text-sm font-bold hover:from-violet-700 hover:to-blue-700 disabled:opacity-50 transition shadow-lg shadow-violet-900/30 mt-1">
                {loading
                  ? mode === 'signin' ? 'Ingresando…' : 'Creando cuenta…'
                  : mode === 'signin' ? 'Ingresar' : 'Crear cuenta'}
              </button>
            </form>

            <p className="text-center text-xs text-gray-600 mt-4">
              {mode === 'signin' ? '¿No tenés cuenta?' : '¿Ya tenés cuenta?'}{' '}
              <button onClick={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}
                className="text-violet-400 hover:text-violet-300 font-medium transition">
                {mode === 'signin' ? 'Registrarte' : 'Iniciá sesión'}
              </button>
            </p>
          </div>

          <p className="text-center text-[11px] text-gray-700 mt-5">
            Brote AD · Uso interno del equipo
          </p>
        </div>
      </div>
    </>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginInner />
    </Suspense>
  )
}
