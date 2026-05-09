'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  RefreshCw, AlertTriangle, CheckCircle2, X,
  Search, Zap, ChevronRight,
  BarChart2, Loader2,
  TrendingUp, TrendingDown, Minus,
} from 'lucide-react'
import type {
  ClientAudit, AuditData, CampaignData,
  Status, Health,
} from '@/lib/audit'
import MonthlyCharts from '@/components/MonthlyCharts'
import { appCache, TTL } from '@/lib/appCache'

// ── Formatters ────────────────────────────────────────────────────────────────

function ars(n: number): string {
  const rounded = Math.round(Math.abs(n))
  const formatted = rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return (n < 0 ? '-$ ' : '$ ') + formatted
}

// ── Config ────────────────────────────────────────────────────────────────────

const HEALTH: Record<Health, { label: string; bg: string; text: string; dot: string; border: string }> = {
  excellent: { label: 'Excelente', bg: 'bg-emerald-500/15', text: 'text-emerald-400', dot: 'bg-emerald-500', border: 'border-emerald-500/30' },
  stable:    { label: 'Estable',   bg: 'bg-blue-600/15',    text: 'text-blue-400',    dot: 'bg-blue-500',    border: 'border-blue-500/30'    },
  review:    { label: 'Revisar',   bg: 'bg-amber-500/15',   text: 'text-amber-400',   dot: 'bg-amber-400',   border: 'border-amber-500/30'   },
  priority:  { label: 'Urgente',   bg: 'bg-rose-500/15',    text: 'text-rose-400',    dot: 'bg-rose-500',    border: 'border-rose-500/30'    },
}

// ── Small atoms ───────────────────────────────────────────────────────────────


function HealthPill({ health }: { health: Health }) {
  const cfg = HEALTH[health]
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}

function AuditSummary({ results }: { results: ClientAudit[] }) {
  const urgent = results.filter(r => r.health === 'priority').length
  const review = results.filter(r => r.health === 'review').length
  const stable = results.filter(r => r.health === 'stable' || r.health === 'excellent').length
  const items = [
    { count: urgent, label: 'Urgentes', bg: 'bg-rose-500/10    border-rose-500/20',    text: 'text-rose-400',    dot: 'bg-rose-500'    },
    { count: review, label: 'Revisar',  bg: 'bg-amber-500/10   border-amber-500/20',   text: 'text-amber-400',   dot: 'bg-amber-400'   },
    { count: stable, label: 'Estables', bg: 'bg-emerald-500/10 border-emerald-500/20', text: 'text-emerald-400', dot: 'bg-emerald-500' },
  ]
  return (
    <div className="grid grid-cols-3 gap-4">
      {items.map(({ count, label, bg, text, dot }) => (
        <div key={label} className={`rounded-2xl border px-5 py-5 shadow-sm ${bg}`}>
          <div className="flex items-center gap-2 mb-2.5">
            <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
            <p className={`text-[11px] font-semibold uppercase tracking-wider ${text}`}>{label}</p>
          </div>
          <p className={`text-3xl font-bold tabular-nums tracking-tight ${text}`}>{count}</p>
          <p className="text-xs text-gray-500 mt-1.5">cliente{count !== 1 ? 's' : ''}</p>
        </div>
      ))}
    </div>
  )
}

function Delta({ value, status, invert }: { value: number | null; status: Status | 'none'; invert?: boolean }) {
  if (value === null || status === 'none') return <span className="text-gray-600 text-sm">—</span>
  const Icon = value === 0 ? Minus : value > 0 ? TrendingUp : TrendingDown
  const positive = invert ? value < 0 : value > 0
  const color = value === 0 ? 'text-gray-500' : positive ? 'text-emerald-500' : 'text-rose-500'
  return (
    <span className={`inline-flex items-center gap-0.5 text-sm font-semibold tabular-nums ${color}`}>
      <Icon size={12} strokeWidth={2.5} />
      {Math.abs(value).toFixed(1)}%
    </span>
  )
}

// ── Campaign section ──────────────────────────────────────────────────────────

function CampaignSection({ accountId, convFilter }: { accountId: string; convFilter: 'messages' | 'purchases' }) {
  const [data, setData]       = useState<CampaignData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/audit/campaigns?account_id=${accountId}`)
      .then(r => r.json())
      .then(json => { if (json.error) throw new Error(json.error); setData(json) })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [accountId])

  if (loading) return <div className="flex items-center gap-2 py-3 text-sm text-gray-500"><Loader2 size={13} className="animate-spin" /> Cargando campañas…</div>
  if (error) return <p className="text-sm text-rose-400">{error}</p>
  if (!data || !data.campaigns.length) return <p className="text-sm text-gray-500">Sin campañas activas.</p>

  return (
    <table className="w-full text-left text-sm border-separate border-spacing-0">
      <thead>
        <tr>
          <th className="pb-2 pr-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider border-b border-[#2a2a2a]">Campaña</th>
          <th className="pb-2 px-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider border-b border-[#2a2a2a] text-right whitespace-nowrap">Gasto 7d</th>
          <th className="pb-2 px-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider border-b border-[#2a2a2a] text-center whitespace-nowrap">{convFilter === 'messages' ? 'Mensajes' : 'Compras'}</th>
          <th className="pb-2 px-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider border-b border-[#2a2a2a] text-center whitespace-nowrap">{convFilter === 'messages' ? 'CPA Msg' : 'CPA Compras'}</th>
          <th className="pb-2 px-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider border-b border-[#2a2a2a] text-center">CTR</th>
          <th className="pb-2 pl-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider border-b border-[#2a2a2a] text-right">Estado</th>
        </tr>
      </thead>
      <tbody>
        {data.campaigns.map((c, i) => {
          const cfg = HEALTH[c.health]
          return (
            <tr key={c.campaign_id} className={`${i !== data.campaigns.length - 1 ? 'border-b border-[#1e1e1e]' : ''} hover:bg-[#252525]/50`}>
              <td className="py-2.5 pr-3">
                <div className="flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
                  <span className="text-gray-200 text-xs font-medium truncate max-w-[220px]" title={c.campaign}>{c.campaign}</span>
                </div>
              </td>
              <td className="py-2.5 px-3 text-right whitespace-nowrap">
                <p className="text-xs font-semibold text-gray-200">{ars(c.spend)}</p>
                {c.spend_change !== null && (
                  <p className={`text-[10px] font-medium ${c.spend_change > 0 ? 'text-emerald-500' : 'text-rose-400'}`}>
                    {c.spend_change > 0 ? '+' : ''}{c.spend_change.toFixed(1)}%
                  </p>
                )}
              </td>
              <td className="py-2.5 px-3 text-center">
                <Delta
                  value={convFilter === 'messages' ? c.conversions_change : c.purchases_change}
                  status={convFilter === 'messages' ? c.conversions_status : c.purchases_status}
                />
              </td>
              <td className="py-2.5 px-3 text-center">
                <Delta
                  value={convFilter === 'messages' ? c.cpl_change : c.cpa_purchases_change}
                  status={convFilter === 'messages' ? c.cpl_status : c.cpa_purchases_status}
                  invert
                />
              </td>
              <td className="py-2.5 px-3 text-center">
                <Delta value={c.ctr_change} status={c.ctr_status} />
              </td>
              <td className="py-2.5 pl-3 text-right">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                  {cfg.label}
                </span>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

// ── Client drawer ─────────────────────────────────────────────────────────────

function ClientDrawer({ client, convFilter, onClose }: { client: ClientAudit; convFilter: 'messages' | 'purchases'; onClose: () => void }) {
  const cfg = HEALTH[client.health]

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const convLabel = convFilter === 'messages'
    ? (client.client_type === 'messaging' ? 'Mensajes' : 'Conversaciones')
    : 'Compras'
  const cpaLabel = convFilter === 'messages' ? 'CPA Msg' : 'CPA Compras'
  const convValue = convFilter === 'messages'
    ? (client.conversions > 0 ? client.conversions.toLocaleString('es-AR') : '—')
    : (client.purchases > 0 ? client.purchases.toLocaleString('es-AR') : '—')
  const cpaValue = convFilter === 'messages'
    ? (client.cpl > 0 ? ars(client.cpl) : '—')
    : (client.cpa_purchases > 0 ? ars(client.cpa_purchases) : '—')
  const convDelta = convFilter === 'messages' ? client.conversions_change : client.purchases_change
  const cpaDelta  = convFilter === 'messages' ? client.cpl_change : client.cpa_purchases_change

  const stats = [
    { label: 'Inversión 7d', value: ars(client.spend), delta: client.spend_change, invert: false },
    { label: convLabel, value: convValue, delta: convDelta, invert: false },
    { label: cpaLabel, value: cpaValue, delta: cpaDelta, invert: true },
    { label: 'CTR', value: `${client.ctr.toFixed(2)}%`, delta: client.ctr_change, invert: false },
  ]

  const diagBg = client.health === 'priority'  ? 'bg-rose-500/10 border-rose-500/20'
               : client.health === 'review'    ? 'bg-amber-500/10 border-amber-500/20'
               : client.health === 'excellent' ? 'bg-emerald-500/10 border-emerald-500/20'
               :                                 'bg-blue-600/10 border-blue-500/20'

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative min-h-full flex items-start justify-center px-4 py-10" onClick={onClose}>
        <div className="relative w-full max-w-5xl bg-[#0f0f0f] border border-[#222] rounded-2xl shadow-2xl" onClick={e => e.stopPropagation()}>

          {/* ── Header ──────────────────────────────────────────── */}
          <div className="px-8 py-5 flex items-center justify-between gap-4 border-b border-[#1c1c1c]">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className={`w-1 h-9 rounded-full shrink-0 ${cfg.dot}`} />
              <div className="min-w-0">
                <h2 className="text-xl font-bold text-white truncate leading-snug">{client.client_name}</h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <HealthPill health={client.health} />
                  <span className="text-[11px] text-gray-600">últimos 7d vs 7d anteriores</span>
                </div>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl text-gray-600 hover:text-gray-300 hover:bg-white/[0.05] transition shrink-0">
              <X size={18} />
            </button>
          </div>

          {/* ── Stats bar ───────────────────────────────────────── */}
          <div className="grid grid-cols-4 divide-x divide-[#1c1c1c] border-b border-[#1c1c1c]">
            {stats.map(s => {
              const pos     = s.delta === null ? null : s.invert ? s.delta < 0 : s.delta > 0
              const neutral = s.delta === null || Math.abs(s.delta) < 0.1
              const col     = neutral ? 'text-gray-600' : pos ? 'text-emerald-400' : 'text-rose-400'
              const Icon    = neutral ? Minus : pos ? TrendingUp : TrendingDown
              return (
                <div key={s.label} className="px-6 py-5">
                  <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest mb-2">{s.label}</p>
                  <p className="text-[22px] font-bold text-white tabular-nums leading-none mb-2">{s.value}</p>
                  {s.delta !== null ? (
                    <span className={`inline-flex items-center gap-1 text-[11px] font-bold ${col}`}>
                      <Icon size={11} strokeWidth={2.5} />
                      {s.delta > 0 ? '+' : ''}{s.delta.toFixed(1)}%
                      <span className="text-[10px] text-gray-600 font-normal ml-0.5">vs sem. ant.</span>
                    </span>
                  ) : (
                    <span className="text-[10px] text-gray-600">Sin datos previos</span>
                  )}
                </div>
              )
            })}
          </div>

          {/* ── Body ────────────────────────────────────────────── */}
          <div className="px-8 py-7 space-y-7">

            {/* Diagnosis */}
            <div className={`relative rounded-xl border overflow-hidden ${diagBg}`}>
              <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${cfg.dot}`} />
              <div className="pl-6 pr-5 py-4">
                <p className="text-sm font-bold text-gray-100 mb-1.5">{client.diagnosis}</p>
                <p className="text-sm text-gray-400 leading-relaxed mb-2.5">{client.insight}</p>
                <p className="text-sm text-gray-300">
                  <span className="font-semibold text-gray-200">Acción · </span>{client.action}
                </p>
                {client.tip && (
                  <p className="text-xs text-gray-500 mt-2.5 pt-2.5 border-t border-white/[0.05]">
                    <span className="font-semibold text-gray-400">Tip · </span>{client.tip}
                  </p>
                )}
              </div>
            </div>

            {/* Monthly charts */}
            <MonthlyCharts accountId={client.account_id} clientName={client.client_name} />

            {/* Campaigns */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <BarChart2 size={13} className="text-gray-600" />
                <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">Campañas activas</p>
              </div>
              <div className="bg-[#141414] rounded-xl border border-[#1e1e1e] px-6 py-5">
                <CampaignSection accountId={client.account_id} convFilter={convFilter} />
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}

// ── Month-over-month bar chart ────────────────────────────────────────────────

function MomBar({ label, current, prev, max, changeVal, format, invert }: {
  label: string; current: number; prev: number; max: number
  changeVal: number | null; format: (n: number) => string; invert?: boolean
}) {
  const curW  = max > 0 ? Math.round((current / max) * 100) : 0
  const prevW = max > 0 ? Math.round((prev    / max) * 100) : 0
  const pos   = invert ? (changeVal ?? 0) < 0 : (changeVal ?? 0) > 0
  const chColor = changeVal === null ? 'text-gray-600'
    : changeVal === 0 ? 'text-gray-500'
    : pos ? 'text-emerald-500' : 'text-rose-500'
  return (
    <div className="flex items-center gap-2.5 py-1.5 border-b border-gray-100 dark:border-[#2a2a2a] last:border-0">
      <span className="w-20 text-[11px] font-medium text-gray-500 dark:text-gray-400 text-right truncate shrink-0">{label}</span>
      <div className="flex-1 space-y-0.5 min-w-0">
        <div className="flex items-center gap-1.5">
          <div className="flex-1 h-2 bg-gray-200 dark:bg-[#2d2d2d] rounded-full overflow-hidden">
            <div style={{ width: `${curW}%` }} className="h-full bg-blue-500 rounded-full transition-all" />
          </div>
          <span className="text-[11px] font-semibold text-gray-600 dark:text-gray-300 w-16 text-right whitespace-nowrap shrink-0">
            {current > 0 ? format(current) : '—'}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex-1 h-2 bg-gray-200 dark:bg-[#2d2d2d] rounded-full overflow-hidden">
            <div style={{ width: `${prevW}%` }} className="h-full bg-gray-400 dark:bg-gray-500 rounded-full transition-all" />
          </div>
          <span className="text-[11px] text-gray-400 dark:text-gray-500 w-16 text-right whitespace-nowrap shrink-0">
            {prev > 0 ? format(prev) : '—'}
          </span>
        </div>
      </div>
      <span className={`text-[11px] font-bold w-12 text-right shrink-0 ${chColor}`}>
        {changeVal === null ? '—' : `${changeVal > 0 ? '+' : ''}${changeVal.toFixed(1)}%`}
      </span>
    </div>
  )
}

// ── Pure module-level helpers ─────────────────────────────────────────────────

function fmtD(s: string): string { const [,m,d] = s.split('-'); return `${d}/${m}` }

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AuditPage() {
  const [data,     setData]     = useState<AuditData | null>(() =>
    appCache.peek<AuditData>('audit'))
  const [loading,  setLoading]  = useState(() => !appCache.has('audit'))
  const [error,    setError]    = useState<string | null>(null)
  const [search,        setSearch]        = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [selected,      setSelected]      = useState<ClientAudit | null>(null)
  const [convFilter, setConvFilter] = useState<'messages' | 'purchases'>('messages')
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleSearch = useCallback((v: string) => {
    setSearch(v)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => setDebouncedSearch(v), 180)
  }, [])

  const load = useCallback(async (force = false) => {
    if (force) appCache.invalidateHard('audit')
    const hasCached = appCache.has('audit')
    if (!hasCached) setLoading(true)
    setError(null)
    try {
      const json = await appCache.fetch('audit', async () => {
        const res = await fetch(`/api/audit${force ? '?force=true' : ''}`)
        return res.json()
      }, TTL.MIN15)
      if (json.error) throw new Error(json.error)
      setData(json)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const results = data?.results ?? []
  const visible = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()
    return q === '' ? results : results.filter(r => r.client_name.toLowerCase().includes(q))
  }, [results, debouncedSearch])

  const momMaxCpl = useMemo(() => results.length > 0 ? Math.max(...results.map(r => Math.max(r.cpl, r.mom_cpl, 1))) : 1, [results])
  const momMaxCpa = useMemo(
    () => results.length > 0 ? Math.max(...results.map(r => Math.max(r.cpa_purchases, r.mom_cpa_purchases, 1))) : 1,
    [results]
  )
  const momMaxCtr = useMemo(() => results.length > 0 ? Math.max(...results.map(r => Math.max(r.ctr, r.mom_ctr, 0.01))) : 1, [results])
  const momByCpl = useMemo(
    () => [...results].sort((a, b) => (b.mom_cpl_change ?? -Infinity) - (a.mom_cpl_change ?? -Infinity)),
    [results],
  )
  const momByCtr = useMemo(
    () => [...results].sort((a, b) => (b.mom_ctr_change ?? -Infinity) - (a.mom_ctr_change ?? -Infinity)),
    [results],
  )
  const updatedAt   = data?.updated_at
    ? new Date(data.updated_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
    : '—'

  return (
    <>
      <div className="space-y-7">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5 mb-1.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center shrink-0 shadow-sm shadow-blue-900/40">
                <Zap size={14} className="text-white" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">AD Health Auditor</h1>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-500 ml-[42px]">
              Últimos 7 días vs 7 días anteriores · Solo Meta Ads · {updatedAt}
            </p>
          </div>
          <button
            onClick={() => load(true)} disabled={loading}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 shadow-sm disabled:opacity-50 shrink-0"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Actualizar análisis
          </button>
        </div>

        {/* Conv/CPA filter toggle */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Métrica:</span>
          <div className="flex rounded-xl overflow-hidden border border-gray-200 dark:border-[#333] bg-gray-50 dark:bg-[#1a1a1a]">
            {(['messages', 'purchases'] as const).map(f => (
              <button
                key={f}
                onClick={() => setConvFilter(f)}
                className={`px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                  convFilter === f
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#252525]'
                }`}
              >
                {f === 'messages' ? 'Mensajes' : 'Compras'}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="bg-rose-50 dark:bg-rose-500/15 border border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-400 rounded-xl p-3 text-sm flex items-center gap-2">
            <AlertTriangle size={14} />{error}
          </div>
        )}

        {/* Executive summary */}
        {!loading && results.length > 0 && (
          <AuditSummary results={results} />
        )}

        {/* Search */}
        <div className="flex items-center justify-between gap-4">
          <p className="text-xs text-gray-400 dark:text-gray-500">
            {visible.length} cliente{visible.length !== 1 ? 's' : ''} · clic para ver detalle
          </p>
          <div className="relative">
            <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
            <input
              type="text" placeholder="Buscar cliente..."
              value={search} onChange={e => handleSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-sm bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#333] rounded-lg text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 w-44 shadow-sm dark:shadow-none"
            />
          </div>
        </div>

        {/* Client list */}
        {loading ? (
          <div className="space-y-1.5">
            {[1,2,3,4,5].map(i => <div key={i} className="h-14 bg-gray-100 dark:bg-[#1a1a1a] rounded-xl border border-gray-200 dark:border-[#2a2a2a] animate-pulse" />)}
          </div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-36 text-gray-400 dark:text-gray-500 text-sm border border-dashed border-gray-200 dark:border-[#2a2a2a] rounded-2xl bg-gray-50 dark:bg-[#141414]">
            <CheckCircle2 size={24} className="mb-2 text-gray-300 dark:text-gray-600" />
            Sin clientes para mostrar
          </div>
        ) : (
          <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl border border-gray-200 dark:border-[#2a2a2a] shadow-sm overflow-hidden">
            {/* Header */}
            <div className="hidden sm:grid items-center gap-3 px-6 py-3 border-b border-gray-100 dark:border-[#2a2a2a] bg-gray-50 dark:bg-[#252525]/60"
                 style={{ gridTemplateColumns: '1.5rem 1fr 6.5rem 5rem 5rem 5rem 7.5rem 1rem' }}>
              {['', 'Cliente', 'Estado', convFilter === 'messages' ? 'Mensajes' : 'Compras', convFilter === 'messages' ? 'CPA Msg' : 'CPA Compras', 'CTR', 'Gasto 7d', ''].map((h, i) => (
                <span key={i} className={`text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider ${i === 0 || i === 7 ? '' : i === 1 ? '' : i === 6 ? 'text-right' : 'text-center'}`}>{h}</span>
              ))}
            </div>

            {visible.map((c, i) => {
              const cfg = HEALTH[c.health]
              return (
                <button
                  key={c.account_id}
                  onClick={() => setSelected(c)}
                  className="w-full text-left hover:bg-gray-50 dark:hover:bg-[#252525]/60 border-b border-gray-100 dark:border-[#2a2a2a] last:border-0 transition-colors"
                >
                  {/* Desktop */}
                  <div className="hidden sm:grid items-center gap-3 px-6 py-4"
                       style={{ gridTemplateColumns: '1.5rem 1fr 6.5rem 5rem 5rem 5rem 7.5rem 1rem' }}>
                    <span className="text-[10px] font-bold text-gray-400 dark:text-gray-600 text-center">{i + 1}</span>

                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
                      <div className="min-w-0">
                        <span className="font-semibold text-gray-800 dark:text-gray-100 text-sm truncate block">{c.client_name}</span>
                        {c.action && (
                          <span className="text-[10px] text-gray-400 dark:text-gray-500 truncate block">{c.action}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex justify-center">
                      <HealthPill health={c.health} />
                    </div>

                    <div className="flex justify-center">
                      <Delta
                        value={convFilter === 'messages' ? c.conversions_change : c.purchases_change}
                        status={convFilter === 'messages' ? c.conversions_status : c.purchases_status}
                      />
                    </div>

                    <div className="flex justify-center">
                      <Delta
                        value={convFilter === 'messages' ? c.cpl_change : c.cpa_purchases_change}
                        status={convFilter === 'messages' ? c.cpl_status : c.cpa_purchases_status}
                        invert
                      />
                    </div>

                    <div className="flex justify-center">
                      <Delta value={c.ctr_change} status={c.ctr_status} />
                    </div>

                    <div className="text-right">
                      <p className="text-sm font-bold text-gray-900 dark:text-white whitespace-nowrap tabular-nums">{ars(c.spend)}</p>
                      {c.spend_change !== null && (
                        <p className={`text-[11px] font-semibold tabular-nums ${c.spend_change > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {c.spend_change > 0 ? '+' : ''}{c.spend_change.toFixed(1)}%
                        </p>
                      )}
                    </div>

                    <ChevronRight size={13} className="text-gray-600 justify-self-end" />
                  </div>

                  {/* Mobile */}
                  <div className="sm:hidden flex items-center gap-3 px-4 py-4">
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${cfg.dot}`} />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-100 text-sm truncate">{c.client_name}</p>
                      <p className="text-xs text-gray-500">{ars(c.spend)} · {cfg.label}</p>
                    </div>
                    <ChevronRight size={13} className="text-gray-600" />
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {/* Legend */}
        {!loading && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-400 dark:text-gray-500 pt-2 border-t border-gray-200 dark:border-[#2a2a2a]">
            <span className="font-semibold text-gray-500 dark:text-gray-400">7d vs 7d ant. —</span>
            <span>{convFilter === 'messages' ? 'Mensajes' : 'Compras'}/CTR/Gasto: ↑ verde ↓ rojo</span>
            <span>{convFilter === 'messages' ? 'CPA Msg' : 'CPA Compras'}: ↓ verde ↑ rojo</span>
          </div>
        )}

        {/* Month-over-month chart */}
        {!loading && data && results.length > 0 && (
          <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl border border-gray-200 dark:border-[#2a2a2a] shadow-sm p-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100">Variación vs mismo período del mes pasado</h3>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                  Actual {fmtD(data.date_from)}–{fmtD(data.date_to)}
                  {' · '}Mes pasado {fmtD(data.mom_from)}–{fmtD(data.mom_to)}
                </p>
              </div>
              <div className="flex items-center gap-4 text-[11px] text-gray-400 dark:text-gray-500 shrink-0">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-1.5 bg-blue-500 rounded-full inline-block" />
                  Este período
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-1.5 bg-gray-500 rounded-full inline-block" />
                  Mes anterior
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
              <div>
                <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2 pb-1.5 border-b border-gray-200 dark:border-[#2a2a2a]">{convFilter === 'messages' ? 'Costo por conv. iniciada (CPA Msg)' : 'Costo por compra (CPA Compras)'}</p>
                {convFilter === 'messages' ? momByCpl.map(c => (
                  <MomBar key={c.account_id} label={c.client_name} current={c.cpl} prev={c.mom_cpl}
                    max={momMaxCpl} changeVal={c.mom_cpl_change} format={ars} invert />
                )) : momByCpl.map(c => (
                  <MomBar key={c.account_id} label={c.client_name} current={c.cpa_purchases} prev={c.mom_cpa_purchases}
                    max={momMaxCpa} changeVal={c.mom_cpa_purchases_change} format={ars} invert />
                ))}
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2 pb-1.5 border-b border-gray-200 dark:border-[#2a2a2a]">CTR</p>
                {momByCtr.map(c => (
                  <MomBar key={c.account_id}
                    label={c.client_name} current={c.ctr} prev={c.mom_ctr}
                    max={momMaxCtr} changeVal={c.mom_ctr_change}
                    format={v => `${v.toFixed(2)}%`}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

      </div>

      {selected && <ClientDrawer client={selected} convFilter={convFilter} onClose={() => setSelected(null)} />}
    </>
  )
}
