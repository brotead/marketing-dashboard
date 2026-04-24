'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { Mail, Lock, Eye, EyeOff, ArrowRight, Pencil, BookOpen, AlertCircle, CheckCircle2 } from 'lucide-react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'

// ── Helpers ──────────────────────────────────────────────────────────────────
function mapAuthError(msg: string, mode: 'signin' | 'signup'): { text: string; hint?: 'switch_to_signin' | 'switch_to_signup' } {
  const m = msg.toLowerCase()
  if (mode === 'signup') {
    if (m.includes('already registered') || m.includes('already exists') || m.includes('user already'))
      return { text: 'Este email ya tiene una cuenta.', hint: 'switch_to_signin' }
    if (m.includes('password') && m.includes('least'))
      return { text: 'La contraseña debe tener al menos 6 caracteres.' }
    if (m.includes('valid email') || m.includes('invalid email'))
      return { text: 'El email no es válido.' }
  }
  if (mode === 'signin') {
    if (m.includes('invalid login') || m.includes('invalid credentials') || m.includes('wrong password'))
      return { text: 'Email o contraseña incorrectos.' }
    if (m.includes('email not confirmed'))
      return { text: 'Confirmá tu email antes de ingresar.' }
    if (m.includes('too many'))
      return { text: 'Demasiados intentos. Esperá unos minutos.' }
  }
  return { text: 'Ocurrió un error. Intentá de nuevo.' }
}

// ── Role card ─────────────────────────────────────────────────────────────────
function RoleCard({ selected, onClick, icon: Icon, title, description, accent }: {
  selected: boolean; onClick: () => void; icon: React.ElementType
  title: string; description: string; accent: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left p-4 rounded-2xl border-2 transition-all duration-200 ${
        selected
          ? accent === 'violet'
            ? 'border-violet-500 bg-violet-500/10'
            : 'border-blue-500 bg-blue-500/10'
          : 'border-white/10 bg-white/5 hover:border-white/20'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
          selected
            ? accent === 'violet' ? 'bg-violet-500/20' : 'bg-blue-500/20'
            : 'bg-white/10'
        }`}>
          <Icon size={17} className={selected ? accent === 'violet' ? 'text-violet-400' : 'text-blue-400' : 'text-gray-400'} />
        </div>
        <div>
          <p className={`text-sm font-bold mb-0.5 ${selected ? 'text-white' : 'text-gray-300'}`}>{title}</p>
          <p className="text-xs text-gray-500 leading-relaxed">{description}</p>
        </div>
        <div className={`ml-auto w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
          selected
            ? accent === 'violet' ? 'border-violet-500' : 'border-blue-500'
            : 'border-gray-600'
        }`}>
          {selected && <div className={`w-2 h-2 rounded-full ${accent === 'violet' ? 'bg-violet-500' : 'bg-blue-500'}`} />}
        </div>
      </div>
    </button>
  )
}

// ── Inner component ───────────────────────────────────────────────────────────
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
  const [errorHint,    setErrorHint]    = useState<'switch_to_signin' | 'switch_to_signup' | undefined>()
  const [success,      setSuccess]      = useState('')
  const [userId,       setUserId]       = useState<string | null>(null)

  useEffect(() => {
    if (searchParams.get('error')) {
      setError('Hubo un problema al iniciar sesión. Intentá de nuevo.')
    }
  }, [searchParams]) // eslint-disable-line react-hooks/exhaustive-deps

  function switchMode(next: 'signin' | 'signup') {
    setMode(next)
    setError('')
    setErrorHint(undefined)
    setSuccess('')
    setPassword('')
    setConfirmPw('')
  }

  // ── Client-side validations before hitting Supabase ──────────────────────
  function validate(): string | null {
    if (!email.trim()) return 'Ingresá tu email.'
    if (!password)     return 'Ingresá tu contraseña.'
    if (mode === 'signup') {
      if (password.length < 6) return 'La contraseña debe tener al menos 6 caracteres.'
      if (password !== confirmPw) return 'Las contraseñas no coinciden.'
    }
    return null
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setErrorHint(undefined)
    setSuccess('')

    const validationError = validate()
    if (validationError) { setError(validationError); return }

    setLoading(true)

    if (mode === 'signin') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        const mapped = mapAuthError(error.message, 'signin')
        setError(mapped.text)
        setErrorHint(mapped.hint)
        setLoading(false)
        return
      }
      // Check if first-time user (no role selected yet)
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles').select('role_selected').eq('id', session.user.id).single()
        if (!profile?.role_selected) {
          setUserId(session.user.id)
          setStep('role')
          setLoading(false)
          return
        }
      }
      router.push('/dashboard')

    } else {
      // Sign up
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) {
        const mapped = mapAuthError(error.message, 'signup')
        setError(mapped.text)
        setErrorHint(mapped.hint)
        setLoading(false)
        return
      }
      // Supabase may return identities:[] if email already exists (without error)
      if (!data.user || data.user.identities?.length === 0) {
        setError('Este email ya tiene una cuenta.')
        setErrorHint('switch_to_signin')
        setLoading(false)
        return
      }
      setUserId(data.user.id)
      setStep('role')
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

  // ── ROLE PICKER ──────────────────────────────────────────────────────────────
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
            <p className="text-sm text-gray-400">Elegí tu rol de acceso.</p>
          </div>
          <div className="space-y-3 mb-7">
            <RoleCard
              selected={selectedRole === 'editor'}
              onClick={() => setSelectedRole('editor')}
              icon={Pencil} title="Editor" accent="violet"
              description="Crear clientes, editar presupuestos, configurar objetivos y operar el panel completo."
            />
            <RoleCard
              selected={selectedRole === 'reader'}
              onClick={() => setSelectedRole('reader')}
              icon={BookOpen} title="Lector" accent="blue"
              description="Ver métricas, dashboards y reportes. Sin acceso a edición o creación."
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

  // ── LOGIN / REGISTRO ──────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#080808] flex items-center justify-center p-4">
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

          {/* Title */}
          <p className="text-center text-sm font-semibold text-gray-300 mb-5">
            {mode === 'signin' ? 'Iniciá sesión' : 'Crear cuenta'}
          </p>

          {/* Error */}
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
              <div className="flex items-start gap-2">
                <AlertCircle size={14} className="text-red-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-red-400">{error}</p>
                  {errorHint === 'switch_to_signin' && (
                    <button
                      onClick={() => switchMode('signin')}
                      className="text-xs text-violet-400 hover:text-violet-300 font-medium mt-1 transition"
                    >
                      Ir a iniciar sesión →
                    </button>
                  )}
                  {errorHint === 'switch_to_signup' && (
                    <button
                      onClick={() => switchMode('signup')}
                      className="text-xs text-violet-400 hover:text-violet-300 font-medium mt-1 transition"
                    >
                      Crear cuenta →
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Success */}
          {success && (
            <div className="flex items-center gap-2 mb-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
              <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
              <p className="text-xs text-emerald-400">{success}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Email */}
            <div className="relative">
              <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="tu@email.com"
                required
                autoComplete="email"
                className="login-input w-full pl-9 pr-4 py-2.5 rounded-xl text-sm placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/40 transition"
              />
            </div>

            {/* Password */}
            <div className="relative">
              <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={mode === 'signup' ? 'Mínimo 6 caracteres' : 'Contraseña'}
                required
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                className="login-input w-full pl-9 pr-10 py-2.5 rounded-xl text-sm placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/40 transition"
              />
              <button type="button" onClick={() => setShowPw(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition">
                {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>

            {/* Confirm password — only on signup */}
            {mode === 'signup' && (
              <div className="relative">
                <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPw}
                  onChange={e => setConfirmPw(e.target.value)}
                  placeholder="Repetir contraseña"
                  required
                  autoComplete="new-password"
                  className={`login-input w-full pl-9 pr-10 py-2.5 rounded-xl text-sm placeholder:text-gray-500 focus:outline-none focus:ring-2 transition ${
                    confirmPw && confirmPw !== password
                      ? 'focus:ring-red-500/40 border-red-500/40'
                      : 'focus:ring-violet-500/40'
                  }`}
                />
                <button type="button" onClick={() => setShowConfirm(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition">
                  {showConfirm ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
                {confirmPw && confirmPw !== password && (
                  <p className="text-[11px] text-red-400 mt-1 ml-1">Las contraseñas no coinciden</p>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-gradient-to-r from-violet-600 to-blue-600 text-white rounded-xl text-sm font-bold hover:from-violet-700 hover:to-blue-700 disabled:opacity-50 transition shadow-lg shadow-violet-900/30 mt-1"
            >
              {loading
                ? mode === 'signin' ? 'Ingresando…' : 'Creando cuenta…'
                : mode === 'signin' ? 'Ingresar' : 'Crear cuenta'
              }
            </button>
          </form>

          {/* Switch mode */}
          <p className="text-center text-xs text-gray-600 mt-4">
            {mode === 'signin' ? '¿No tenés cuenta?' : '¿Ya tenés cuenta?'}{' '}
            <button
              onClick={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}
              className="text-violet-400 hover:text-violet-300 font-medium transition"
            >
              {mode === 'signin' ? 'Registrarte' : 'Iniciá sesión'}
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

export default function LoginPage() {
  return (
    <Suspense>
      <LoginInner />
    </Suspense>
  )
}
