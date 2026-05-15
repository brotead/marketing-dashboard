'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Sparkles, Check, AlertCircle, ArrowRight, ExternalLink } from 'lucide-react'
import { useRouter } from 'next/navigation'
import type { AccountData, CampaignSpend } from '@/lib/types'

// Normalize for matching: lowercase, strip accents, alphanumeric + spaces only
function norm(s: string) {
  return s.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim()
}

// Returns strong matches first; if none, partial matches; if none, empty
function findMatches(query: string, accounts: AccountData[]): AccountData[] {
  const q = norm(query)
  const words = q.split(' ').filter(w => w.length > 1)

  const strong = accounts.filter(a => {
    const t = norm(a.account_name)
    return t.includes(q) || q.includes(t) || (words.length > 0 && words.every(w => t.includes(w)))
  })
  if (strong.length > 0) return strong

  // Partial: any significant word (>2 chars) appears
  return accounts.filter(a => {
    const t = norm(a.account_name)
    return words.filter(w => w.length > 2).some(w => t.includes(w))
  })
}

const STEPS = [
  'Creando registro cliente',
  'Buscando cuentas publicitarias',
  'Vinculando cuenta encontrada',
  'Importando campañas activas',
  'Importando resultados del mes',
  'Generando módulos internos',
  'Finalizando cliente activo',
]

interface Props {
  onClose: () => void
  onCreated: (clientName: string) => void
}

type Phase = 'form' | 'processing' | 'pick' | 'success' | 'error'

interface Snap {
  accounts: AccountData[]
  campaigns: CampaignSpend[]
  yr: number
  mo: number
}

function parseBudget(s: string) {
  return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0
}

function currency(n: number) {
  return n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
}

async function micro(ms = 250) { await new Promise(r => setTimeout(r, ms)) }

function AccountList({
  candidates, filtered, picked, onPick, accentColor, search, onSearch,
}: {
  candidates: AccountData[]
  filtered: AccountData[]
  picked: AccountData | null
  onPick: (a: AccountData) => void
  accentColor: string
  search: string
  onSearch: (v: string) => void
}) {
  function currency(n: number) {
    return n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
  }
  if (candidates.length === 0) return (
    <p className="text-xs text-gray-400 dark:text-gray-500 italic py-1">
      No se encontraron cuentas publicitarias disponibles.
    </p>
  )
  return (
    <div className="space-y-2">
      <div className="relative">
        <input
          value={search}
          onChange={e => onSearch(e.target.value)}
          placeholder={`Buscar entre ${candidates.length} cuentas…`}
          className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#2a2a2a] rounded-lg text-gray-800 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition"
        />
      </div>
      {filtered.length === 0 ? (
        <p className="text-xs text-gray-400 dark:text-gray-500 italic py-1 text-center">Sin resultados para "{search}"</p>
      ) : (
        <div className="space-y-1.5 max-h-44 overflow-y-auto">
          {filtered.map(a => (
            <button
              key={a.account_id}
              type="button"
              onClick={() => onPick(a)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all ${
                picked?.account_id === a.account_id
                  ? `border-opacity-50 bg-opacity-10 ${accentColor === 'meta' ? 'border-[#1877F2] bg-[#1877F2]/10' : 'border-[#4285F4] bg-[#4285F4]/10'}`
                  : 'border-gray-200 dark:border-[#2a2a2a] hover:bg-gray-50 dark:hover:bg-[#1a1a1a]'
              }`}
            >
              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                picked?.account_id === a.account_id
                  ? accentColor === 'meta' ? 'border-[#1877F2]' : 'border-[#4285F4]'
                  : 'border-gray-300 dark:border-gray-600'
              }`}>
                {picked?.account_id === a.account_id && (
                  <div className={`w-2 h-2 rounded-full ${accentColor === 'meta' ? 'bg-[#1877F2]' : 'bg-[#4285F4]'}`} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">{a.account_name}</p>
                <p className="text-[10px] text-gray-400 dark:text-gray-500 tabular-nums">
                  ID: {a.account_id}{a.spend > 0 ? ` · ${currency(a.spend)}` : ''}
                </p>
              </div>
              {picked?.account_id === a.account_id && (
                <Check size={13} className={accentColor === 'meta' ? 'text-[#1877F2] shrink-0' : 'text-[#4285F4] shrink-0'} />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function NewClientModal({ onClose, onCreated }: Props) {
  const router = useRouter()

  // ── Form state ────────────────────────────────────────────────────────────
  const [name,         setName]         = useState('')
  const [hasMeta,      setHasMeta]      = useState(true)
  const [hasGoogle,    setHasGoogle]    = useState(false)
  const [metaBudget,   setMetaBudget]   = useState('')
  const [googleBudget, setGoogleBudget] = useState('')

  // ── Windsor prefetch (starts as soon as the modal opens) ─────────────────
  const prefetchRef = useRef<{ accounts: AccountData[]; campaigns: CampaignSpend[] } | null>(null)
  const prefetchingRef = useRef(false)
  const metaDirectIdsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    const today = new Date()
    const yr = today.getFullYear()
    const mo = today.getMonth() + 1
    prefetchingRef.current = true
    fetch(`/api/windsor?year=${yr}&month=${mo}&force=true`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) prefetchRef.current = { accounts: data.data ?? [], campaigns: data.campaigns ?? [] }
        prefetchingRef.current = false
      })
      .catch(() => { prefetchingRef.current = false })
  }, [])

  // ── Flow state ────────────────────────────────────────────────────────────
  const [phase,       setPhase]       = useState<Phase>('form')
  const [stepIdx,     setStepIdx]     = useState(0)
  const [stepSub,     setStepSub]     = useState('')
  const [createdName, setCreatedName] = useState('')
  const [error,       setError]       = useState('')

  // ── Account picker state ──────────────────────────────────────────────────
  const [snap,             setSnap]             = useState<Snap | null>(null)
  const [metaCandidates,   setMetaCandidates]   = useState<AccountData[]>([])
  const [googleCandidates, setGoogleCandidates] = useState<AccountData[]>([])
  const [pickedMeta,       setPickedMeta]       = useState<AccountData | null>(null)
  const [pickedGoogle,     setPickedGoogle]     = useState<AccountData | null>(null)
  const [needPickMeta,     setNeedPickMeta]     = useState(false)
  const [needPickGoogle,   setNeedPickGoogle]   = useState(false)
  const [metaSearch,       setMetaSearch]       = useState('')
  const [googleSearch,     setGoogleSearch]     = useState('')

  // ── Result state ──────────────────────────────────────────────────────────
  const [resultCount,   setResultCount]   = useState(0)
  const [resultSpend,   setResultSpend]   = useState(0)
  const [linkedAccount, setLinkedAccount] = useState('')

  function go(idx: number, sub = '') { setStepIdx(idx); setStepSub(sub) }

  // ── Main creation flow ────────────────────────────────────────────────────
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed || (!hasMeta && !hasGoogle)) return

    setCreatedName(trimmed)
    setPhase('processing')
    go(0, 'Preparando datos del cliente…')

    try {
      const today = new Date()
      const yr = today.getFullYear()
      const mo = today.getMonth() + 1

      await micro(300)

      // ── Step 1: Fetch Windsor + Meta API in parallel ──────────────────────
      go(1, 'Buscando cuentas publicitarias…')

      // Start Meta API fetch immediately (doesn't block Windsor)
      const metaApiFetch = fetch('/api/meta/accounts')
        .then(r => r.ok ? r.json() : { accounts: [] })
        .catch(() => ({ accounts: [] }))

      let accounts: AccountData[]    = []
      let campaigns: CampaignSpend[] = []

      const pre = prefetchRef.current
      if (pre) {
        accounts  = pre.accounts
        campaigns = pre.campaigns
        go(1, 'Cuentas encontradas ✓')
        await micro(300)
      } else {
        if (prefetchingRef.current) {
          go(1, 'Esperando respuesta de Windsor…')
          const deadline = Date.now() + 15000
          while (prefetchingRef.current && Date.now() < deadline) {
            await new Promise(r => setTimeout(r, 500))
          }
        }

        const pre2 = prefetchRef.current
        if (pre2) {
          accounts  = pre2.accounts
          campaigns = pre2.campaigns
          go(1, 'Cuentas encontradas ✓')
          await micro(200)
        } else {
          let attempt = 0
          let wData: { data: AccountData[]; campaigns: CampaignSpend[] } | null = null
          while (!wData) {
            attempt++
            if (attempt > 1) go(1, `Reconectando (intento ${attempt})…`)
            try {
              const res = await fetch(`/api/windsor?year=${yr}&month=${mo}&force=true`)
              if (!res.ok) throw new Error(`HTTP ${res.status}`)
              wData = await res.json()
            } catch {
              if (attempt >= 3) throw new Error('No se pudo conectar con Windsor después de 3 intentos')
              go(1, 'Reintentando conexión…')
              await new Promise(r => setTimeout(r, 2000 * attempt))
            }
          }
          accounts  = wData.data      ?? []
          campaigns = wData.campaigns ?? []
        }
      }

      // Merge Meta API accounts (add accounts not already in Windsor)
      const metaApiData = await metaApiFetch
      const metaApiAccts: AccountData[] = metaApiData.accounts ?? []
      const windsorMetaIds = new Set(accounts.filter(a => a.source === 'facebook').map(a => a.account_id))
      const metaOnlyAccts  = metaApiAccts.filter(a => !windsorMetaIds.has(a.account_id))
      metaDirectIdsRef.current = new Set(metaOnlyAccts.map(a => a.account_id))
      if (metaOnlyAccts.length > 0) accounts = [...accounts, ...metaOnlyAccts]

      const s: Snap = { accounts, campaigns, yr, mo }
      setSnap(s)

      // ── Step 2: Fuzzy match ───────────────────────────────────────────────
      go(2, 'Analizando coincidencias…')
      await micro(350)

      const metaSrc   = accounts.filter(a => a.source === 'facebook')
      const googleSrc = accounts.filter(a => a.source === 'google')
      const metaHits  = hasMeta   ? findMatches(trimmed, metaSrc)   : []
      const gHits     = hasGoogle ? findMatches(trimmed, googleSrc) : []

      setMetaCandidates(hasMeta   ? metaSrc   : [])
      setGoogleCandidates(hasGoogle ? googleSrc : [])
      setNeedPickMeta(hasMeta)
      setNeedPickGoogle(hasGoogle)
      if (metaHits.length > 0)  setPickedMeta(metaHits[0])
      if (gHits.length    > 0)  setPickedGoogle(gHits[0])
      setMetaSearch('')
      setGoogleSearch('')
      setPhase('pick')
    } catch (err) {
      setError(String(err))
      setPhase('error')
    }
  }

  // Called when user confirms account selection
  async function continueAfterPick() {
    if (!snap) return
    if (hasMeta   && metaCandidates.length   > 0 && !pickedMeta)   return
    if (hasGoogle && googleCandidates.length > 0 && !pickedGoogle) return

    setPhase('processing')
    go(2, 'Vinculando cuentas seleccionadas…')
    try {
      await doImport(createdName, snap, pickedMeta, pickedGoogle)
    } catch (err) {
      setError(String(err))
      setPhase('error')
    }
  }

  // ── Core import: creates budget entries and finalizes ────────────────────
  async function doImport(
    clientName: string,
    s: Snap,
    metaAcct: AccountData | null,
    googleAcct: AccountData | null,
  ) {
    const { accounts, campaigns, yr, mo } = s

    // Mark step 2 visually done, move to step 3
    const linked = [metaAcct, googleAcct].filter(Boolean).map(a => a!.account_name)
    setLinkedAccount(linked.join(' · '))
    await micro(200)

    // ── Step 3: Create budget entries ─────────────────────────────────────
    go(3, 'Preparando campañas…')
    const pairs: Array<[AccountData | null, number, string]> = []
    if (hasMeta)   pairs.push([metaAcct,   parseBudget(metaBudget),   'facebook'])
    if (hasGoogle) pairs.push([googleAcct, parseBudget(googleBudget), 'google'])

    let totalCampaigns = 0

    for (const [acct, budget, source] of pairs) {
      if (!acct) continue
      const src   = acct.source
      const label = source === 'facebook' ? 'Meta' : 'Google'
      const all   = campaigns.filter(c => c.account_id === acct.account_id && c.source === src)
      const list  = all.filter(c => c.spend > 0).length > 0
        ? all.filter(c => c.spend > 0)
        : all.slice(0, 20)

      if (list.length > 0) {
        const per = Math.floor(budget / list.length)
        for (let i = 0; i < list.length; i++) {
          go(3, `Importando ${label} (${i + 1}/${list.length})`)
          const c = list[i]
          await fetch('/api/budgets', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              campaign_id:   `${src.slice(0, 2)}_${Date.now()}_${i}`,
              campaign_name: c.campaign_name || c.adset_name || 'Campaña',
              client_name:   clientName,
              source:        src,
              account_id:    acct.account_id,
              year: yr, month: mo,
              budget_total:  per,
            }),
          })
          totalCampaigns++
        }
      } else {
        // Account found but no campaigns — register account as single entry
        go(3, `Registrando cuenta ${label}…`)
        await fetch('/api/budgets', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            campaign_id:   `${src.slice(0, 2)}_${Date.now()}`,
            campaign_name: acct.account_name,
            client_name:   clientName,
            source:        src,
            account_id:    acct.account_id,
            year: yr, month: mo,
            budget_total:  budget,
          }),
        })
        totalCampaigns++
      }
    }

    // If the Meta account is from Meta API only (not in Windsor), register as direct
    if (metaAcct && metaDirectIdsRef.current.has(metaAcct.account_id)) {
      await fetch('/api/meta/mark-direct', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ account_id: metaAcct.account_id }),
      }).catch(e => console.error('[MetaDirect]', e))
    }

    // ── Step 4: Verify spend data ─────────────────────────────────────────
    go(4, 'Verificando métricas del mes…')
    const totalSpend = pairs.reduce((sum, [acct, , source]) => {
      if (!acct) return sum
      return sum + (accounts.find(a => a.account_id === acct.account_id && a.source === source)?.spend ?? 0)
    }, 0)
    await micro(400)

    // ── Step 5: Internal modules activated ───────────────────────────────
    go(5, 'Activando Dashboard · Cashflow · Objetivos…')
    await micro(500)

    // ── Step 6: Done ─────────────────────────────────────────────────────
    go(6, '¡Cliente activo y sincronizado!')
    await micro(400)

    setResultCount(totalCampaigns)
    setResultSpend(totalSpend)
    setPhase('success')
    onCreated(clientName)
  }

  // ──────────────────────────────────────────────────────────────────────────
  // RENDER
  // ──────────────────────────────────────────────────────────────────────────

  // ── FORM ──────────────────────────────────────────────────────────────────
  if (phase === 'form') return (
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
              <p className="text-xs text-white/70 flex items-center gap-1.5">
                Alta automática · Windsor + Meta API + Dashboard + Cashflow
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-white/50 animate-pulse" title="Actualizando cuentas Windsor…" />
              </p>
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
                Se distribuirá automáticamente entre las campañas activas encontradas.
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

  // ── PROCESSING ────────────────────────────────────────────────────────────
  if (phase === 'processing') return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative w-full max-w-sm bg-white dark:bg-[#111] border border-gray-200 dark:border-[#222] rounded-2xl shadow-2xl p-8 text-center">
        <div className="flex justify-center mb-5">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
            <Sparkles size={22} className="text-white spin-step" />
          </div>
        </div>
        <p className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-0.5">{createdName}</p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-6 min-h-[18px]">{stepSub}</p>

        <div className="space-y-2.5 text-left">
          {STEPS.map((label, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 ${
                i < stepIdx
                  ? 'bg-emerald-500'
                  : i === stepIdx
                    ? 'bg-violet-600'
                    : 'bg-gray-100 dark:bg-[#222]'
              }`}>
                {i < stepIdx
                  ? <Check size={11} className="text-white" strokeWidth={3} />
                  : i === stepIdx
                    ? <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                    : <div className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600" />
                }
              </div>
              <span className={`text-xs transition-all duration-200 ${
                i < stepIdx
                  ? 'text-emerald-600 dark:text-emerald-400 line-through opacity-50'
                  : i === stepIdx
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

  // ── ACCOUNT PICKER ────────────────────────────────────────────────────────
  if (phase === 'pick') {
    const filteredMeta   = metaSearch.trim()
      ? metaCandidates.filter(a => norm(a.account_name).includes(norm(metaSearch)))
      : metaCandidates
    const filteredGoogle = googleSearch.trim()
      ? googleCandidates.filter(a => norm(a.account_name).includes(norm(googleSearch)))
      : googleCandidates

    const canContinue =
      (!hasMeta   || metaCandidates.length   === 0 || !!pickedMeta) &&
      (!hasGoogle || googleCandidates.length === 0 || !!pickedGoogle)

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
        <div className="relative w-full max-w-sm bg-white dark:bg-[#111] border border-gray-200 dark:border-[#222] rounded-2xl shadow-2xl overflow-hidden">

          <div className="px-6 pt-5 pb-4 border-b border-gray-100 dark:border-[#222]">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center">
                <Sparkles size={13} className="text-white" />
              </div>
              <p className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate">{createdName}</p>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 ml-9">
              Seleccioná las cuentas publicitarias
            </p>
          </div>

          <div className="p-5 space-y-5 max-h-[60vh] overflow-y-auto">
            {hasMeta && (
              <div>
                <p className="text-[11px] font-bold text-[#1877F2] uppercase tracking-wider mb-2.5 flex items-center gap-2">
                  Meta Ads
                  {pickedMeta && <span className="text-[10px] text-emerald-500 normal-case font-medium tracking-normal">✓ seleccionada</span>}
                </p>
                <AccountList
                  candidates={metaCandidates}
                  filtered={filteredMeta}
                  picked={pickedMeta}
                  onPick={setPickedMeta}
                  accentColor="meta"
                  search={metaSearch}
                  onSearch={setMetaSearch}
                />
              </div>
            )}
            {hasGoogle && (
              <div>
                <p className="text-[11px] font-bold text-[#4285F4] uppercase tracking-wider mb-2.5 flex items-center gap-2">
                  Google Ads
                  {pickedGoogle && <span className="text-[10px] text-emerald-500 normal-case font-medium tracking-normal">✓ seleccionada</span>}
                </p>
                <AccountList
                  candidates={googleCandidates}
                  filtered={filteredGoogle}
                  picked={pickedGoogle}
                  onPick={setPickedGoogle}
                  accentColor="google"
                  search={googleSearch}
                  onSearch={setGoogleSearch}
                />
              </div>
            )}
          </div>

          <div className="px-5 pb-5 pt-3 border-t border-gray-100 dark:border-[#222] flex gap-2">
            <button
              type="button"
              onClick={() => { setPhase('form'); setPickedMeta(null); setPickedGoogle(null) }}
              className="px-4 py-2.5 border border-gray-200 dark:border-[#2a2a2a] text-gray-500 dark:text-gray-400 rounded-xl text-xs font-semibold hover:bg-gray-50 dark:hover:bg-[#1a1a1a] transition"
            >
              Volver
            </button>
            <button
              type="button"
              onClick={continueAfterPick}
              disabled={!canContinue}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-violet-600 to-blue-600 text-white rounded-xl text-xs font-bold hover:from-violet-700 hover:to-blue-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Continuar <ArrowRight size={13} />
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── SUCCESS ───────────────────────────────────────────────────────────────
  if (phase === 'success') return (
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

        <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-1">
          ¡Cliente creado y sincronizado!
        </h3>

        {linkedAccount && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">
            Cuenta vinculada: <span className="font-semibold text-gray-700 dark:text-gray-300">{linkedAccount}</span>
          </p>
        )}
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
          {resultCount > 0
            ? `${resultCount} campaña${resultCount !== 1 ? 's' : ''} activa${resultCount !== 1 ? 's' : ''} importada${resultCount !== 1 ? 's' : ''}`
            : 'Cuenta vinculada, sin campañas activas este mes'}
          {resultSpend > 0 && ` · ${currency(resultSpend)} gastados`}
        </p>
        <p className="text-[11px] text-emerald-500 dark:text-emerald-400 font-semibold mb-5">
          Activo en Dashboard · Cashflow · Objetivos · AD Auditor
        </p>

        <div className="flex gap-2">
          <button
            onClick={() => { onClose(); router.push(`/cashflow?client=${encodeURIComponent(createdName)}`) }}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition"
          >
            Ver en Cashflow <ExternalLink size={11} />
          </button>
          <button
            onClick={onClose}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 border border-gray-200 dark:border-[#2a2a2a] text-gray-600 dark:text-gray-400 rounded-xl text-xs font-semibold hover:bg-gray-50 dark:hover:bg-[#1a1a1a] transition"
          >
            Ver Dashboard
          </button>
        </div>
      </div>
    </div>
  )

  // ── ERROR ─────────────────────────────────────────────────────────────────
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
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-6 break-words">{error}</p>
        <div className="flex gap-2">
          <button
            onClick={() => { setPhase('form'); setError(''); setStepIdx(0); setStepSub('') }}
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
