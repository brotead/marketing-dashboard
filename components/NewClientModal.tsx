'use client'

import { useState } from 'react'
import { X, Sparkles, Check, AlertCircle, ArrowRight, ExternalLink } from 'lucide-react'
import { useRouter } from 'next/navigation'
import type { AccountData, CampaignSpend } from '@/lib/types'

function normName(s: string) {
  return s.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim()
}

function fuzzyMatch(query: string, target: string): boolean {
  const q = normName(query)
  const t = normName(target)
  if (t.includes(q) || q.includes(t)) return true
  const words = q.split(' ').filter(w => w.length > 2)
  return words.length > 0 && words.every(w => t.includes(w))
}

const LOADING_STEPS = [
  'Verificando disponibilidad…',
  'Conectando con Windsor…',
  'Identificando cuentas publicitarias…',
  'Creando campañas y presupuestos…',
  '¡Listo!',
]

interface Props {
  onClose: () => void
  onCreated: (clientName: string) => void
}

type Step = 'form' | 'loading' | 'success' | 'error'

export default function NewClientModal({ onClose, onCreated }: Props) {
  const router = useRouter()
  const [step,          setStep]          = useState<Step>('form')
  const [name,          setName]          = useState('')
  const [hasMeta,       setHasMeta]       = useState(true)
  const [hasGoogle,     setHasGoogle]     = useState(false)
  const [metaBudget,    setMetaBudget]    = useState('')
  const [googleBudget,  setGoogleBudget]  = useState('')
  const [loadingStep,   setLoadingStep]   = useState(0)
  const [error,         setError]         = useState('')
  const [resultCount,   setResultCount]   = useState(0)
  const [resultPending, setResultPending] = useState(false)
  const [createdName,   setCreatedName]   = useState('')

  async function pause(ms: number) {
    return new Promise(r => setTimeout(r, ms))
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    if (!hasMeta && !hasGoogle) return

    setStep('loading')
    setLoadingStep(0)
    setCreatedName(trimmed)

    try {
      const today = new Date()
      const yr = today.getFullYear()
      const mo = today.getMonth() + 1
      const platform = hasMeta && hasGoogle ? 'both' : hasMeta ? 'meta' : 'google'

      // Step 1 -- create onboarding entry
      await pause(400)
      const obRes = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: trimmed, platform }),
      })
      const obData = await obRes.json()
      if (obData.error) throw new Error(obData.error)

      // Step 2 -- fetch Windsor data (force fresh)
      setLoadingStep(1)
      await pause(300)
      const wRes = await fetch(`/api/windsor?year=${yr}&month=${mo}&force=true`)
      if (!wRes.ok) throw new Error('Error al conectar con Windsor')
      const wData = await wRes.json()
      const accounts: AccountData[]    = wData.data      ?? []
      const campaigns: CampaignSpend[] = wData.campaigns ?? []

      // Step 3 -- fuzzy match accounts
      setLoadingStep(2)
      await pause(600)
      const metaAcct   = hasMeta   ? (accounts.find(a => a.source === 'facebook' && fuzzyMatch(trimmed, a.account_name)) ?? null) : null
      const googleAcct = hasGoogle ? (accounts.find(a => a.source === 'google'   && fuzzyMatch(trimmed, a.account_name)) ?? null) : null

      // Step 4 -- create budget entries
      setLoadingStep(3)
      await pause(400)

      let totalCampaigns = 0
      let anyPending     = false

      const pairs: Array<[AccountData | null, number, string]> = []
      if (hasMeta)   pairs.push([metaAcct,   parseFloat(metaBudget.replace(/\./g, '').replace(',', '.'))   || 0, 'facebook'])
      if (hasGoogle) pairs.push([googleAcct, parseFloat(googleBudget.replace(/\./g, '').replace(',', '.')) || 0, 'google'])

      for (const [acct, budget, source] of pairs) {
        if (acct) {
          const src = acct.source
          const acctCampaigns = campaigns.filter(c =>
            c.account_id === acct.account_id && c.source === src && c.spend > 0
          )
          if (acctCampaigns.length === 0) {
            // Account found, no campaigns with spend yet -- register the account
            await fetch('/api/budgets', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({
                campaign_id:   `${src.slice(0, 2)}_${Date.now()}`,
                campaign_name: acct.account_name,
                client_name:   trimmed,
                source:        src,
                account_id:    acct.account_id,
                year: yr, month: mo,
                budget_total:  budget,
              }),
            })
            totalCampaigns++
          } else {
            const perCampaign = Math.floor(budget / acctCampaigns.length)
            for (let i = 0; i < acctCampaigns.length; i++) {
              const c = acctCampaigns[i]
              await fetch('/api/budgets', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                  campaign_id:   `${src.slice(0, 2)}_${Date.now()}_${i}`,
                  campaign_name: c.campaign_name || c.adset_name || 'Campaña',
                  client_name:   trimmed,
                  source:        src,
                  account_id:    acct.account_id,
                  year: yr, month: mo,
                  budget_total:  perCampaign,
                }),
              })
              totalCampaigns++
            }
          }
        } else {
          // No Windsor match -- create pending entry
          anyPending = true
          await fetch('/api/budgets', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              campaign_id:   `${source.slice(0, 2)}_${Date.now()}_p`,
              campaign_name: '__pending__',
              client_name:   trimmed,
              source,
              account_id:    '__pending__',
              year: yr, month: mo,
              budget_total:  parseFloat(source === 'facebook' ? metaBudget : googleBudget) || 0,
            }),
          })
        }
      }

      // Step 5 -- done
      setLoadingStep(4)
      await pause(600)
      setResultCount(totalCampaigns)
      setResultPending(anyPending)
      setStep('success')
      onCreated(trimmed)
    } catch (err) {
      setError(String(err))
      setStep('error')
    }
  }

  // -- Form --
  if (step === 'form') return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md bg-white dark:bg-[#111] border border-gray-200 dark:border-[#222] rounded-2xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="bg-gradient-to-r from-violet-600 to-blue-600 px-6 pt-6 pb-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center">
                  <Sparkles size={14} className="text-white" />
                </div>
                <h2 className="text-base font-bold text-white">Nuevo Cliente</h2>
              </div>
              <p className="text-xs text-white/70">Alta automática · Windsor + Cashflow + Onboarding</p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 transition">
              <X size={14} />
            </button>
          </div>
        </div>

        <form onSubmit={handleCreate} className="p-6 space-y-5">
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5">
              Nombre del cliente *
            </label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ej: Agro Norte"
              required
              autoFocus
              className="w-full px-3 py-2.5 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#2a2a2a] rounded-xl text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-2">
              Plataformas *
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { if (hasMeta && !hasGoogle) return; setHasMeta(v => !v) }}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-sm font-semibold transition-all ${
                  hasMeta
                    ? 'bg-[#1877F2]/10 border-[#1877F2]/40 text-[#1877F2] dark:text-[#4a9eff]'
                    : 'bg-white dark:bg-[#1a1a1a] border-gray-200 dark:border-[#2a2a2a] text-gray-400 hover:border-gray-300'
                }`}
              >
                <span className="font-bold">M</span> Meta Ads
                {hasMeta && <Check size={13} />}
              </button>
              <button
                type="button"
                onClick={() => { if (hasGoogle && !hasMeta) return; setHasGoogle(v => !v) }}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-sm font-semibold transition-all ${
                  hasGoogle
                    ? 'bg-[#4285F4]/10 border-[#4285F4]/40 text-[#4285F4] dark:text-[#5a9eff]'
                    : 'bg-white dark:bg-[#1a1a1a] border-gray-200 dark:border-[#2a2a2a] text-gray-400 hover:border-gray-300'
                }`}
              >
                <span className="font-bold">G</span> Google Ads
                {hasGoogle && <Check size={13} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-2">
              Presupuesto mensual (ARS)
            </label>
            <div className="space-y-2">
              {hasMeta && (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-[#1877F2] font-bold w-14 shrink-0">Meta</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={metaBudget}
                    onChange={e => setMetaBudget(e.target.value.replace(/[^0-9.,]/g, ''))}
                    placeholder="200000"
                    className="flex-1 px-3 py-2 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#2a2a2a] rounded-xl text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition"
                  />
                </div>
              )}
              {hasGoogle && (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-[#4285F4] font-bold w-14 shrink-0">Google</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={googleBudget}
                    onChange={e => setGoogleBudget(e.target.value.replace(/[^0-9.,]/g, ''))}
                    placeholder="150000"
                    className="flex-1 px-3 py-2 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#2a2a2a] rounded-xl text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition"
                  />
                </div>
              )}
              <p className="text-[11px] text-gray-400 dark:text-gray-500 pt-0.5">
                El presupuesto se distribuirá entre las campañas activas en Windsor.
              </p>
            </div>
          </div>

          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-violet-600 to-blue-600 text-white rounded-xl text-sm font-bold hover:from-violet-700 hover:to-blue-700 transition shadow-md shadow-violet-500/20"
          >
            Crear cliente <ArrowRight size={15} />
          </button>
        </form>
      </div>
    </div>
  )

  // -- Loading --
  if (step === 'loading') return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative w-full max-w-sm bg-white dark:bg-[#111] border border-gray-200 dark:border-[#222] rounded-2xl shadow-2xl p-8 text-center">
        <div className="flex justify-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
            <Sparkles size={22} className="text-white spin-step" />
          </div>
        </div>
        <p className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-1">{createdName}</p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-7">Configurando cliente automáticamente…</p>

        <div className="space-y-3 text-left">
          {LOADING_STEPS.map((label, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-all ${
                i < loadingStep
                  ? 'bg-emerald-500'
                  : i === loadingStep
                    ? 'bg-violet-600'
                    : 'bg-gray-100 dark:bg-[#222]'
              }`}>
                {i < loadingStep
                  ? <Check size={11} className="text-white" strokeWidth={3} />
                  : i === loadingStep
                    ? <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                    : <div className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600" />
                }
              </div>
              <span className={`text-xs transition-all ${
                i < loadingStep
                  ? 'text-emerald-600 dark:text-emerald-400 line-through opacity-60'
                  : i === loadingStep
                    ? 'text-gray-900 dark:text-gray-100 font-semibold'
                    : 'text-gray-400 dark:text-gray-600'
              }`}>
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  // -- Success --
  if (step === 'success') return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-sm bg-white dark:bg-[#111] border border-gray-200 dark:border-[#222] rounded-2xl shadow-2xl p-8 text-center"
        onClick={e => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-[#222] transition">
          <X size={14} />
        </button>

        <div className="flex justify-center mb-5">
          <div className="w-16 h-16 rounded-full bg-emerald-500/15 border-2 border-emerald-500/30 flex items-center justify-center shadow-lg shadow-emerald-500/10">
            <Check size={28} className="text-emerald-500" strokeWidth={2.5} />
          </div>
        </div>

        <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-2">
          ¡{createdName} fue creado!
        </h3>

        {resultPending && resultCount === 0 ? (
          <p className="text-sm text-amber-500 dark:text-amber-400 mb-2">
            No se encontró en Windsor. Configuración pendiente en Cashflow.
          </p>
        ) : resultPending ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
            {resultCount} campaña{resultCount !== 1 ? 's' : ''} creada{resultCount !== 1 ? 's' : ''}. Una plataforma queda pendiente.
          </p>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
            {resultCount > 0
              ? `${resultCount} campaña${resultCount !== 1 ? 's' : ''} configurada${resultCount !== 1 ? 's' : ''} correctamente.`
              : 'Cliente registrado. Config el presupuesto en Cashflow.'}
          </p>
        )}

        <p className="text-[11px] text-gray-400 dark:text-gray-500 mb-6">
          Aparece en Dashboard, Cashflow y Onboarding.
        </p>

        <div className="flex gap-2">
          <button
            onClick={() => { onClose(); router.push(`/cashflow?client=${encodeURIComponent(createdName)}`) }}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition"
          >
            Ver en Cashflow <ExternalLink size={11} />
          </button>
          <button
            onClick={() => { onClose(); router.push('/onboarding') }}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 border border-gray-200 dark:border-[#2a2a2a] text-gray-600 dark:text-gray-400 rounded-xl text-xs font-semibold hover:bg-gray-50 dark:hover:bg-[#1a1a1a] transition"
          >
            Ir a Onboarding
          </button>
        </div>
      </div>
    </div>
  )

  // -- Error --
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-sm bg-white dark:bg-[#111] border border-gray-200 dark:border-[#222] rounded-2xl shadow-2xl p-8 text-center"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-center mb-5">
          <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <AlertCircle size={24} className="text-red-400" />
          </div>
        </div>
        <p className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-2">Error al crear el cliente</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-6 break-all">{error}</p>
        <div className="flex gap-2">
          <button
            onClick={() => { setStep('form'); setError('') }}
            className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition"
          >
            Reintentar
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-2.5 border border-gray-200 dark:border-[#2a2a2a] text-gray-500 rounded-xl text-xs font-semibold hover:bg-gray-50 dark:hover:bg-[#1a1a1a] transition"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
