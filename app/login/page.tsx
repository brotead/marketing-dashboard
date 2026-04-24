'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { Mail, Lock, Eye, EyeOff, ArrowRight, Pencil, BookOpen, AlertCircle } from 'lucide-react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'

// ── Role card ────────────────────────────────────────────────────────────────
function RoleCard({
  selected, onClick, icon: Icon, title, description, color,
}: {
  selected: boolean
  onClick: () => void
  icon: React.ElementType
  title: string
  description: string
  color: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left p-4 rounded-2xl border-2 transition-all duration-200 ${
        selected
          ? `border-${color}-500 bg-${color}-500/10`
          : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/8'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
          selected ? `bg-${color}-500/20` : 'bg-white/10'
        }`}>
          <Icon size={17} className={selected ? `text-${color}-400` : 'text-gray-400'} />
        </div>
        <div>
          <p className={`text-sm font-bold mb-0.5 ${selected ? 'text-white' : 'text-gray-300'}`}>{title}</p>
          <p className="text-xs text-gray-500 leading-relaxed">{description}</p>
        </div>
        <div className={`ml-auto w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all ${
          selected ? `border-${color}-500` : 'border-gray-600'
        }`}>
          {selected && <div className={`w-2 h-2 rounded-full bg-${color}-500`} />}
        </div>
      </div>
    </button>
  )
}

// ── Inner component (uses useSearchParams — must be wrapped in Suspense) ─────
function LoginInner() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const supabase     = createSupabaseBrowser()

  type Step = 'login' | 'role'
  const [step,         setStep]         = useState<Step>('login')
  const [mode,         setMode]         = useState<'signin' | 'signup'>('signin')
  const [email,        setEmail]        = useState('')
  const [password,     setPassword]     = useState('')
  const [showPw,       setShowPw]       = useState(false)
  const [selectedRole, setSelectedRole] = useState<'editor' | 'reader' | null>(null)
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState('')
  const [userId,       setUserId]       = useState<string | null>(null)

  useEffect(() => {
    if (searchParams.get('error')) {
      setError('Hubo un problema al iniciar sesión. Intentá de nuevo.')
    }
  }, [searchParams]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (mode === 'signin') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setError('Email o contraseña incorrectos.')
        setLoading(false)
        return
      }
      // Check if role needs selection
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role_selected')
          .eq('id', session.user.id)
          .single()
        if (!profile?.role_selected) {
          setUserId(session.user.id)
          setStep('role')
          setLoading(false)
          return
        }
      }
      router.push('/dashboard')
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) {
        setError(error.message)
        setLoading(false)
        return
      }
      if (data.user) {
        setUserId(data.user.id)
        setStep('role')
      }
      setLoading(false)
    }
  }

  async function confirmRole() {
    if (!selectedRole || !userId) return
    setLoading(true)
    await supabase
      .from('profiles')
      .update({ role: selectedRole, role_selected: true })
      .eq('id', userId)
    router.push('/dashboard')
  }

  // ── ROLE PICKER ─────────────────────────────────────────────────────────────
  if (step === 'role') return (
    <div className="min-h-screen bg-[#080808] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gradient-to-br from-violet-900/20 via-transparent to-blue-900/20 pointer-events-none" />

      <div className="relative w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <div className="w-12 h-12 rounded-2xl overflow-hidden ring-1 ring-white/10">
            <Image src="/logo.png" alt="Brote AD" width={48} height={48} className="w-full h-full object-cover" />
          </div>
        </div>

        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">
          <div className="text-center mb-7">
            <h1 className="text-xl font-bold text-white mb-1.5">¿Cómo vas a usar Brote AD?</h1>
            <p className="text-sm text-gray-400">Elegí tu rol de acceso. Podés cambiarlo después.</p>
          </div>

          <div className="space-y-3 mb-7">
            <RoleCard
              selected={selectedRole === 'editor'}
              onClick={() => setSelectedRole('editor')}
              icon={Pencil}
              title="Editor"
              description="Crear clientes, editar presupuestos, configurar objetivos y operar el panel completo."
              color="violet"
            />
            <RoleCard
              selected={selectedRole === 'reader'}
              onClick={() => setSelectedRole('reader')}
              icon={BookOpen}
              title="Lector"
              description="Ver métricas, dashboards y reportes. Sin acceso a edición o creación."
              color="blue"
            />
          </div>

          <button
            onClick={confirmRole}
            disabled={!selectedRole || loading}
            className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-violet-600 to-blue-600 text-white rounded-2xl text-sm font-bold hover:from-violet-700 hover:to-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-lg shadow-violet-900/30"
          >
            {loading ? 'Ingresando…' : <>Ingresar a Brote AD <ArrowRight size={15} /></>}
          </button>
        </div>
      </div>
    </div>
  )

  // ── LOGIN ────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#080808] flex items-center justify-center p-4">
      {/* Ambient gradient */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-gradient-to-b from-violet-900/30 to-transparent rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[300px] bg-gradient-to-t from-blue-900/20 to-transparent rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl overflow-hidden ring-1 ring-white/10 mb-4 shadow-2xl">
            <Image src="/logo.png" alt="Brote AD" width={56} height={56} className="w-full h-full object-cover" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Brote AD</h1>
          <p className="text-sm text-gray-500 mt-1">Panel de pauta digital</p>
        </div>

        {/* Card */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">
          {error && (
            <div className="flex items-center gap-2 mb-5 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
              <AlertCircle size={14} className="text-red-400 shrink-0" />
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}

          {/* Email form */}
          <form onSubmit={handleEmail} className="space-y-3">
            <div className="relative">
              <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="tu@email.com"
                required
                className="login-input w-full pl-9 pr-4 py-2.5 rounded-xl text-sm placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/60 transition"
              />
            </div>
            <div className="relative">
              <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Contraseña"
                required
                className="login-input w-full pl-9 pr-10 py-2.5 rounded-xl text-sm placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/60 transition"
              />
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition"
              >
                {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-gradient-to-r from-violet-600 to-blue-600 text-white rounded-xl text-sm font-bold hover:from-violet-700 hover:to-blue-700 disabled:opacity-50 transition shadow-lg shadow-violet-900/30"
            >
              {loading ? 'Ingresando…' : mode === 'signin' ? 'Ingresar' : 'Crear cuenta'}
            </button>
          </form>

          {/* Toggle signin/signup */}
          <p className="text-center text-xs text-gray-600 mt-4">
            {mode === 'signin' ? '¿Primera vez?' : '¿Ya tenés cuenta?'}{' '}
            <button
              onClick={() => { setMode(m => m === 'signin' ? 'signup' : 'signin'); setError('') }}
              className="text-violet-400 hover:text-violet-300 font-medium transition"
            >
              {mode === 'signin' ? 'Crear cuenta' : 'Iniciá sesión'}
            </button>
          </p>
        </div>

        <p className="text-center text-[11px] text-gray-700 mt-6">
          Brote AD · Uso interno del equipo
        </p>
      </div>
    </div>
  )
}

// ── Page export (Suspense required for useSearchParams) ──────────────────────
export default function LoginPage() {
  return (
    <Suspense>
      <LoginInner />
    </Suspense>
  )
}
