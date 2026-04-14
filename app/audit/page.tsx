'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  RefreshCw, TrendingUp, TrendingDown, Minus,
  AlertTriangle, CheckCircle2, Flame, Target,
  ChevronDown, ChevronUp, Search, Zap, ArrowUpRight,
  DollarSign, Users,
} from 'lucide-react'
import type { ClientAudit, AuditData, Status, Health } from '@/lib/audit'

// ── Helpers ────────────────────────────────────────────────────────────────────

const ars = (n: number) =>
  n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })

const pct = (n: number | null) =>
  n === null ? '—' : `${n > 0 ? '+' : ''}${n.toFixed(1)}%`

const HEALTH_CONFIG: Record<Health, { label: string; color: string; ring: string; bg: string; dot: string }> = {
  excellent: { label: 'Excelente', color: 'text-emerald-700', ring: 'ring-emerald-400', bg: 'bg-emerald-50',  dot: 'bg-emerald-500' },
  stable:    { label: 'Estable',   color: 'text-blue-700',    ring: 'ring-blue-400',    bg: 'bg-blue-50',     dot: 'bg-blue-500'    },
  review:    { label: 'Revisar',   color: 'text-amber-700',   ring: 'ring-amber-400',   bg: 'bg-amber-50',    dot: 'bg-amber-500'   },
  priority:  { label: 'Prioridad', color: 'text-rose-700',    ring: 'ring-rose-400',    bg: 'bg-rose-50',     dot: 'bg-rose-500'    },
}

const STATUS_PILL: Record<string, string> = {
  green:  'bg-emerald-50 text-emerald-700 border border-emerald-200',
  yellow: 'bg-amber-50   text-amber-700   border border-amber-200',
  red:    'bg-rose-50    text-rose-700    border border-rose-200',
  none:   'bg-gray-50    text-gray-400    border border-gray-200',
}

function StatusPill({ status, label }: { status: string; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_PILL[status]}`}>
      {label}
    </span>
  )
}

function ChangeCell({ value, status, inverse = false }: { value: number | null; status: Status | 'none'; inverse?: boolean }) {
  if (value === null || status === 'none') return <span className="text-gray-400 text-sm">—</span>
  const up = value > 0
  const Icon = value === 0 ? Minus : up ? TrendingUp : TrendingDown
  const color =
    status === 'green' ? 'text-emerald-600' :
    status === 'red'   ? 'text-rose-600'    : 'text-amber-600'
  return (
    <span className={`flex items-center gap-0.5 text-sm font-semibold ${color}`}>
      <Icon size={13} />
      {pct(value)}
    </span>
  )
}

function ScoreBadge({ score, health }: { score: number; health: Health }) {
  const cfg = HEALTH_CONFIG[health]
  return (
    <div className={`inline-flex items-center justify-center w-10 h-10 rounded-full ring-2 ${cfg.ring} ${cfg.bg}`}>
      <span className={`text-sm font-bold ${cfg.color}`}>{score > 0 ? `+${score}` : score}</span>
    </div>
  )
}

function FreqCell({ freq, status }: { freq: number; status: Status }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${
      status === 'green'  ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
      status === 'yellow' ? 'bg-amber-50   text-amber-700   border-amber-200'  :
                            'bg-rose-50    text-rose-700    border-rose-200'
    }`}>
      {freq > 0 ? freq.toFixed(1) + 'x' : '—'}
    </span>
  )
}

// ── Summary card ───────────────────────────────────────────────────────────────

function SummaryCard({
  icon: Icon, label, value, color, bg,
}: {
  icon: React.ElementType; label: string; value: string | number; color: string; bg: string
}) {
  return (
    <div className={`${bg} rounded-2xl border border-white/60 px-5 py-4 flex items-center gap-4`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color} bg-white/70 shrink-0`}>
        <Icon size={18} />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900 leading-tight">{value}</p>
        <p className="text-xs text-gray-500 mt-0.5">{label}</p>
      </div>
    </div>
  )
}

// ── Expandable client card ─────────────────────────────────────────────────────

function ClientCard({ client, rank }: { client: ClientAudit; rank: number }) {
  const [open, setOpen] = useState(false)
  const cfg = HEALTH_CONFIG[client.health]

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden transition-shadow hover:shadow-md">
      {/* Row */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full text-left"
      >
        <div className="grid grid-cols-[2rem_1fr_3rem_5rem_5rem_5rem_5rem_1fr_6rem_2rem] gap-3 items-center px-5 py-4">
          {/* Rank */}
          <span className="text-xs font-bold text-gray-300">#{rank}</span>

          {/* Client */}
          <div className="flex items-center gap-2 min-w-0">
            <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
            <span className="font-semibold text-gray-900 text-sm truncate">{client.client_name}</span>
          </div>

          {/* Score */}
          <ScoreBadge score={client.score} health={client.health} />

          {/* CTR change */}
          <div className="text-center">
            <ChangeCell value={client.ctr_change} status={client.ctr_status} />
          </div>

          {/* CPM change */}
          <div className="text-center">
            <ChangeCell value={client.cpm_change} status={client.cpm_status} inverse />
          </div>

          {/* Frequency */}
          <div className="text-center">
            <FreqCell freq={client.frequency} status={client.freq_status} />
          </div>

          {/* CPL change */}
          <div className="text-center">
            <ChangeCell value={client.cpl_change} status={client.cpl_status === 'none' ? 'none' : client.cpl_status} inverse />
          </div>

          {/* Diagnóstico */}
          <div className="min-w-0">
            <span className="text-xs text-gray-600 truncate block">{client.diagnosis}</span>
            <div className="flex gap-1 mt-0.5 flex-wrap">
              {client.tags.map(t => (
                <span key={t} className="text-[10px] bg-blue-50 text-blue-600 border border-blue-100 px-1.5 py-0.5 rounded-full font-medium">{t}</span>
              ))}
            </div>
          </div>

          {/* Health badge */}
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.bg} ${cfg.color} border ${cfg.ring.replace('ring-', 'border-')}`}>
            {cfg.label}
          </span>

          {/* Expand */}
          <div className="flex justify-center">
            {open ? <ChevronUp size={15} className="text-gray-400" /> : <ChevronDown size={15} className="text-gray-400" />}
          </div>
        </div>
      </button>

      {/* Expanded detail */}
      {open && (
        <div className="border-t border-gray-50 bg-gray-50/50 px-5 py-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
            <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
              <p className="text-xs text-gray-400 mb-1">Gasto 7d</p>
              <p className="text-base font-bold text-gray-900">{ars(client.spend)}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
              <p className="text-xs text-gray-400 mb-1">CTR actual</p>
              <p className="text-base font-bold text-gray-900">{client.ctr.toFixed(2)}%</p>
              <p className={`text-xs mt-0.5 font-medium ${client.ctr_status === 'green' ? 'text-emerald-600' : client.ctr_status === 'red' ? 'text-rose-600' : 'text-amber-600'}`}>
                {pct(client.ctr_change)} vs semana anterior
              </p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
              <p className="text-xs text-gray-400 mb-1">CPM actual</p>
              <p className="text-base font-bold text-gray-900">{ars(client.cpm)}</p>
              <p className={`text-xs mt-0.5 font-medium ${client.cpm_status === 'green' ? 'text-emerald-600' : client.cpm_status === 'red' ? 'text-rose-600' : 'text-amber-600'}`}>
                {pct(client.cpm_change)} vs semana anterior
              </p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
              <p className="text-xs text-gray-400 mb-1">Frecuencia</p>
              <p className="text-base font-bold text-gray-900">{client.frequency > 0 ? client.frequency.toFixed(2) + 'x' : '—'}</p>
              <StatusPill status={client.freq_status} label={HEALTH_CONFIG[client.health].label} />
            </div>
            {client.has_cpl && (
              <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
                <p className="text-xs text-gray-400 mb-1">CPL actual</p>
                <p className="text-base font-bold text-gray-900">{ars(client.cpl)}</p>
                <p className={`text-xs mt-0.5 font-medium ${client.cpl_status === 'green' ? 'text-emerald-600' : client.cpl_status === 'red' ? 'text-rose-600' : 'text-amber-600'}`}>
                  {pct(client.cpl_change)} vs semana anterior
                </p>
              </div>
            )}
            {client.has_cpl && (
              <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
                <p className="text-xs text-gray-400 mb-1">Leads 7d</p>
                <p className="text-base font-bold text-gray-900">{client.leads}</p>
              </div>
            )}
          </div>

          {/* Diagnosis block */}
          <div className={`rounded-xl border p-4 ${
            client.health === 'priority'  ? 'bg-rose-50   border-rose-200'   :
            client.health === 'review'    ? 'bg-amber-50  border-amber-200'  :
            client.health === 'excellent' ? 'bg-emerald-50 border-emerald-200' :
                                           'bg-blue-50   border-blue-200'
          }`}>
            <div className="flex items-start gap-3">
              <div className={`mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                client.health === 'priority'  ? 'bg-rose-100 text-rose-600'   :
                client.health === 'review'    ? 'bg-amber-100 text-amber-600' :
                client.health === 'excellent' ? 'bg-emerald-100 text-emerald-600' :
                                               'bg-blue-100 text-blue-600'
              }`}>
                {client.health === 'priority' || client.health === 'review'
                  ? <AlertTriangle size={15} />
                  : client.health === 'excellent'
                  ? <CheckCircle2 size={15} />
                  : <Target size={15} />
                }
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">{client.diagnosis}</p>
                <p className="text-sm text-gray-600 mt-1">{client.action}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Skeleton ───────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="space-y-3">
      {[1,2,3,4,5].map(i => (
        <div key={i} className="h-16 bg-white rounded-2xl border border-gray-100 animate-pulse" />
      ))}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

type Filter = 'all' | 'red' | 'escalar' | 'creativo' | 'publico'

export default function AuditPage() {
  const [data,    setData]    = useState<AuditData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)
  const [filter,  setFilter]  = useState<Filter>('all')
  const [search,  setSearch]  = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/audit')
      if (!res.ok) throw new Error('Error al cargar el audit')
      const json = await res.json()
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

  // Derived counts for summary cards
  const redCount      = results.filter(r => r.health === 'priority').length
  const scaleCount    = results.filter(r => r.tags.includes('Escalar')).length
  const creativoCount = results.filter(r => r.tags.includes('Creativo agotado')).length
  const publicoCount  = results.filter(r => r.tags.includes('Público nuevo')).length

  // Filtered list
  const visible = results.filter(r => {
    const matchFilter =
      filter === 'all'      ? true :
      filter === 'red'      ? r.health === 'priority' || r.health === 'review' :
      filter === 'escalar'  ? r.tags.includes('Escalar') :
      filter === 'creativo' ? r.tags.includes('Creativo agotado') :
      filter === 'publico'  ? r.tags.includes('Público nuevo') : true
    const matchSearch = search.trim() === '' ||
      r.client_name.toLowerCase().includes(search.toLowerCase())
    return matchFilter && matchSearch
  })

  // Priorities: worst score first (already sorted)
  const priorities = results.slice(0, 5).filter(r => r.health !== 'excellent')

  const updatedAt = data?.updated_at
    ? new Date(data.updated_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
    : '—'

  const FILTERS: { key: Filter; label: string }[] = [
    { key: 'all',      label: 'Todos' },
    { key: 'red',      label: 'Solo urgentes' },
    { key: 'escalar',  label: 'Para escalar' },
    { key: 'creativo', label: 'Creativo agotado' },
    { key: 'publico',  label: 'Público nuevo' },
  ]

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center">
              <Zap size={14} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">AD Health Auditor</h1>
          </div>
          <p className="text-sm text-gray-400">
            Últimos 7 días vs 7 días anteriores · Actualizado {updatedAt}
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-800 transition disabled:opacity-50 shrink-0"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Actualizar análisis
        </button>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-4 text-sm flex items-center gap-2">
          <AlertTriangle size={15} />
          {error}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <SummaryCard icon={Flame}        label="Urgentes hoy"       value={redCount}      color="text-rose-600"    bg="bg-rose-50" />
        <SummaryCard icon={ArrowUpRight} label="Para escalar"       value={scaleCount}    color="text-emerald-600" bg="bg-emerald-50" />
        <SummaryCard icon={RefreshCw}    label="Creativo agotado"   value={creativoCount} color="text-orange-600"  bg="bg-orange-50" />
        <SummaryCard icon={Target}       label="Público a renovar"  value={publicoCount}  color="text-blue-600"    bg="bg-blue-50" />
        <SummaryCard icon={DollarSign}   label="Gasto total 7d"     value={data ? ars(data.total_spend) : '—'} color="text-violet-600" bg="bg-violet-50" />
        <SummaryCard icon={Users}        label="Leads totales 7d"   value={data?.total_leads ?? '—'} color="text-indigo-600" bg="bg-indigo-50" />
      </div>

      {/* Priorities block */}
      {!loading && priorities.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <Flame size={15} className="text-rose-500" />
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Prioridades de hoy</h2>
          </div>
          <div className="space-y-2">
            {priorities.map((c, i) => {
              const cfg = HEALTH_CONFIG[c.health]
              return (
                <div key={c.account_id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                  <span className="text-sm font-bold text-gray-300 w-5 shrink-0">#{i + 1}</span>
                  <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
                  <span className="font-semibold text-sm text-gray-900 w-28 shrink-0">{c.client_name}</span>
                  <span className="text-sm text-gray-500 flex-1 truncate">{c.action}</span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color} shrink-0`}>
                    {cfg.label}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Filter + search bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-1.5 flex-wrap">
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                filter === f.key
                  ? 'bg-gray-900 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative ml-auto">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar cliente..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 w-44"
          />
        </div>
      </div>

      {/* Table header */}
      {!loading && visible.length > 0 && (
        <div className="grid grid-cols-[2rem_1fr_3rem_5rem_5rem_5rem_5rem_1fr_6rem_2rem] gap-3 px-5 py-2">
          {['#', 'Cliente', 'Score', 'CTR %', 'CPM %', 'Frecuencia', 'CPL %', 'Diagnóstico', 'Estado', ''].map((h, i) => (
            <span key={i} className="text-xs font-semibold text-gray-400 uppercase tracking-wider truncate">{h}</span>
          ))}
        </div>
      )}

      {/* Client rows */}
      {loading ? (
        <Skeleton />
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-gray-400 text-sm border border-dashed border-gray-200 rounded-2xl bg-white">
          <CheckCircle2 size={28} className="mb-2 text-gray-300" />
          <p>Sin clientes que mostrar</p>
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map((c, i) => (
            <ClientCard key={c.account_id} client={c} rank={i + 1} />
          ))}
        </div>
      )}

      {/* Legend */}
      {!loading && (
        <div className="flex flex-wrap gap-4 pt-2 border-t border-gray-100">
          <p className="text-xs text-gray-400 font-medium">Thresholds:</p>
          <span className="text-xs text-gray-400">CTR: 🟢 &gt;+10% · 🟡 ±10% · 🔴 &lt;-15%</span>
          <span className="text-xs text-gray-400">CPM: 🟢 &lt;-10% · 🟡 0-20% · 🔴 &gt;+20%</span>
          <span className="text-xs text-gray-400">Frecuencia: 🟢 ≤2.2x · 🟡 ≤3.0x · 🔴 &gt;3.0x</span>
          <span className="text-xs text-gray-400">CPL: 🟢 &lt;-10% · 🟡 0-18% · 🔴 &gt;+18%</span>
        </div>
      )}
    </div>
  )
}
