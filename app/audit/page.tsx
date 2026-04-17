'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  RefreshCw, AlertTriangle, CheckCircle2, Target, X,
  Search, Zap, ArrowUpRight, DollarSign, Users, ChevronRight,
  Flame, BarChart2, Loader2, Layers, Image as ImageIcon,
  TrendingUp, TrendingDown, Minus,
} from 'lucide-react'
import type {
  ClientAudit, CampaignAudit, AuditData, CampaignData,
  CreativeData, CreativeLifecycle, Lifecycle, Status, Health,
} from '@/lib/audit'

// ── Formatters ──────────────────────────────────────────────────────────────────

const ars = (n: number) =>
  n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })

const pct = (n: number | null) =>
  n === null ? '—' : `${n > 0 ? '+' : ''}${n.toFixed(1)}%`

// ── Health config ───────────────────────────────────────────────────────────────

const HEALTH_CONFIG: Record<Health, { label: string; color: string; ring: string; bg: string; dot: string; border: string }> = {
  excellent: { label: 'Excelente', color: 'text-emerald-700', ring: 'ring-emerald-400', bg: 'bg-emerald-50',  dot: 'bg-emerald-500', border: 'border-emerald-200' },
  stable:    { label: 'Estable',   color: 'text-blue-700',    ring: 'ring-blue-400',    bg: 'bg-blue-50',     dot: 'bg-blue-500',    border: 'border-blue-200'    },
  review:    { label: 'Revisar',   color: 'text-amber-700',   ring: 'ring-amber-400',   bg: 'bg-amber-50',    dot: 'bg-amber-500',   border: 'border-amber-200'   },
  priority:  { label: 'Prioridad', color: 'text-rose-700',    ring: 'ring-rose-400',    bg: 'bg-rose-50',     dot: 'bg-rose-500',    border: 'border-rose-200'    },
}

// ── Lifecycle config ─────────────────────────────────────────────────────────────

const LC_CONFIG: Record<Lifecycle, { label: string; bg: string; color: string; border: string; dot: string; criteria: string; action: string }> = {
  growth:    {
    label: 'Creciendo',  bg: 'bg-emerald-50', color: 'text-emerald-700',
    border: 'border-emerald-200', dot: 'bg-emerald-400',
    criteria: 'CTR estable o en alza · Anuncio nuevo o mejorando',
    action: 'Mantener activo y preparar escala',
  },
  peak:      {
    label: 'En pico',    bg: 'bg-blue-50',    color: 'text-blue-700',
    border: 'border-blue-200', dot: 'bg-blue-400',
    criteria: 'CTR estable (variación ±10%)',
    action: 'Crear variaciones mientras funciona',
  },
  decline:   {
    label: 'Declinando', bg: 'bg-amber-50',   color: 'text-amber-700',
    border: 'border-amber-200', dot: 'bg-amber-400',
    criteria: 'CTR cayó entre 10% y 30%',
    action: 'Preparar creatividad nueva esta semana',
  },
  exhausted: {
    label: 'Agotado',    bg: 'bg-rose-50',    color: 'text-rose-700',
    border: 'border-rose-200', dot: 'bg-rose-400',
    criteria: 'CTR cayó más de 30%',
    action: 'Pausar y reemplazar de inmediato',
  },
}

// ── Creative action message ──────────────────────────────────────────────────────

type ActionLevel = 'great' | 'ok' | 'warn' | 'danger'

function getCreativeAction(c: CreativeLifecycle): { title: string; body: string; level: ActionLevel } {
  if (c.is_new) return {
    title: 'Anuncio nuevo — en aprendizaje',
    body: 'Esperar 5-7 días antes de evaluar rendimiento',
    level: 'ok',
  }
  switch (c.lifecycle) {
    case 'exhausted':
      return { title: 'Anuncio agotado', body: 'Pausar y reemplazar con creatividad nueva de inmediato', level: 'danger' }
    case 'decline':
      return { title: 'Rendimiento cayendo', body: 'Revisar el hook y propuesta de valor — crear una variación', level: 'warn' }
    case 'peak':
      return { title: 'Buen momento para duplicar', body: 'El anuncio está en su pico — crear variaciones similares antes de que decline', level: 'ok' }
    case 'growth':
      if (c.ctr_change !== null && c.ctr_change > 15)
        return { title: 'Anuncio con alto rendimiento', body: 'Escalar presupuesto gradualmente y crear anuncios similares', level: 'great' }
      return { title: 'Anuncio en crecimiento', body: 'Mantener activo — si los resultados acompañan, escalar de forma gradual', level: 'great' }
  }
}

const ACTION_STYLES: Record<ActionLevel, { bg: string; border: string; title: string; body: string }> = {
  great:  { bg: 'bg-emerald-50', border: 'border-emerald-200', title: 'text-emerald-800', body: 'text-emerald-700' },
  ok:     { bg: 'bg-blue-50',    border: 'border-blue-200',    title: 'text-blue-800',    body: 'text-blue-700'    },
  warn:   { bg: 'bg-amber-50',   border: 'border-amber-200',   title: 'text-amber-800',   body: 'text-amber-700'   },
  danger: { bg: 'bg-rose-50',    border: 'border-rose-200',    title: 'text-rose-800',    body: 'text-rose-700'    },
}

// ── Small atoms ──────────────────────────────────────────────────────────────────

function ScoreBadge({ score, health }: { score: number; health: Health }) {
  const cfg = HEALTH_CONFIG[health]
  return (
    <div className={`inline-flex items-center justify-center w-9 h-9 rounded-full ring-2 ${cfg.ring} ${cfg.bg}`}>
      <span className={`text-xs font-bold ${cfg.color}`}>{score > 0 ? `+${score}` : score}</span>
    </div>
  )
}

function HealthBadge({ health }: { health: Health }) {
  const cfg = HEALTH_CONFIG[health]
  return (
    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.bg} ${cfg.color} border ${cfg.border}`}>
      {cfg.label}
    </span>
  )
}

function ChangeCell({ value, status }: { value: number | null; status: Status | 'none' }) {
  if (value === null || status === 'none') return <span className="text-gray-300 text-sm">—</span>
  const Icon = value === 0 ? Minus : value > 0 ? TrendingUp : TrendingDown
  const color = status === 'green' ? 'text-emerald-600' : status === 'red' ? 'text-rose-600' : 'text-amber-600'
  return (
    <span className={`flex items-center gap-0.5 text-sm font-semibold ${color}`}>
      <Icon size={13} />{pct(value)}
    </span>
  )
}

function SummaryCard({ icon: Icon, label, value, colorClass, bgClass }: {
  icon: React.ElementType; label: string; value: string | number; colorClass: string; bgClass: string
}) {
  return (
    <div className={`${bgClass} rounded-2xl px-5 py-4 flex items-center gap-4`}>
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${colorClass} bg-white/70 shrink-0`}>
        <Icon size={17} />
      </div>
      <div>
        <p className="text-xl font-bold text-gray-900 leading-tight">{value}</p>
        <p className="text-xs text-gray-500 mt-0.5">{label}</p>
      </div>
    </div>
  )
}

function MetricCard({ label, value, change, status }: {
  label: string; value: string; change?: number | null; status?: Status
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className="text-base font-bold text-gray-900">{value}</p>
      {change !== undefined && change !== null && status && (
        <p className={`text-xs mt-0.5 font-medium ${
          status === 'green' ? 'text-emerald-600' : status === 'red' ? 'text-rose-600' : 'text-amber-600'
        }`}>
          {pct(change)} vs sem. anterior
        </p>
      )}
    </div>
  )
}

// ── Skeleton ─────────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="space-y-2">
      {[1,2,3,4,5].map(i => (
        <div key={i} className="h-14 bg-white rounded-xl border border-gray-100 animate-pulse" />
      ))}
    </div>
  )
}

// ── Creative card (thumbnail + action) ───────────────────────────────────────────

function CreativeCard({ c }: { c: CreativeLifecycle }) {
  const action = getCreativeAction(c)
  const styles = ACTION_STYLES[action.level]
  const lcCfg  = LC_CONFIG[c.lifecycle]
  const [imgErr, setImgErr] = useState(false)

  return (
    <div className="flex items-start gap-3 p-3 bg-white border border-gray-100 rounded-xl hover:shadow-sm transition-shadow">
      {/* Thumbnail */}
      <div className="w-14 h-14 rounded-lg overflow-hidden bg-gray-100 border border-gray-200 shrink-0 flex items-center justify-center">
        {c.thumbnail_url && !imgErr ? (
          <img
            src={c.thumbnail_url}
            alt={c.ad_name}
            className="w-full h-full object-cover"
            onError={() => setImgErr(true)}
          />
        ) : (
          <ImageIcon size={20} className="text-gray-300" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1">
          <p className="text-sm font-semibold text-gray-900 truncate leading-tight" title={c.ad_name}>
            {c.ad_name}
          </p>
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border shrink-0 ${lcCfg.bg} ${lcCfg.color} ${lcCfg.border}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${lcCfg.dot}`} />
            {lcCfg.label}
          </span>
        </div>
        <p className="text-xs text-gray-400 truncate mb-2" title={`${c.campaign} › ${c.adset_name}`}>
          {c.campaign}{c.adset_name && c.adset_name !== '—' ? ` › ${c.adset_name}` : ''}
        </p>
        {/* Action message */}
        <div className={`rounded-lg border px-3 py-2 ${styles.bg} ${styles.border}`}>
          <p className={`text-xs font-bold leading-tight ${styles.title}`}>{action.title}</p>
          <p className={`text-xs leading-tight mt-0.5 ${styles.body}`}>{action.body}</p>
        </div>
        {/* Spend + CTR change */}
        <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
          <span>Gasto 7d: <span className="font-medium text-gray-600">{ars(c.spend_week)}</span></span>
          {c.ctr_change !== null && (
            <span className={c.ctr_change >= 0 ? 'text-emerald-600 font-medium' : 'text-rose-600 font-medium'}>
              CTR {c.ctr_change > 0 ? '+' : ''}{c.ctr_change.toFixed(0)}% vs sem. ant.
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Lifecycle legend ──────────────────────────────────────────────────────────────

function LifecycleLegend() {
  return (
    <div className="grid grid-cols-2 gap-2 mb-4">
      {(Object.entries(LC_CONFIG) as [Lifecycle, typeof LC_CONFIG[Lifecycle]][]).map(([, cfg]) => (
        <div key={cfg.label} className={`rounded-xl border px-3 py-2 ${cfg.bg} ${cfg.border}`}>
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
            <span className={`text-xs font-bold ${cfg.color}`}>{cfg.label}</span>
          </div>
          <p className="text-[11px] text-gray-500 leading-tight">{cfg.criteria}</p>
        </div>
      ))}
    </div>
  )
}

// ── Creative lifecycle section (inside drawer) ────────────────────────────────────

function CreativeSection({ accountId }: { accountId: string }) {
  const [data, setData]       = useState<CreativeData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/audit/creatives?account_id=${accountId}`)
      .then(r => r.json())
      .then(json => { if (json.error) throw new Error(json.error); setData(json) })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [accountId])

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Layers size={14} className="text-gray-400" />
        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Ciclo de vida de creatividades</h3>
      </div>

      <LifecycleLegend />

      {loading && (
        <div className="flex items-center gap-2 py-4 text-sm text-gray-400">
          <Loader2 size={14} className="animate-spin" /> Analizando creatividades…
        </div>
      )}
      {error && (
        <div className="text-sm text-rose-600 flex items-center gap-2">
          <AlertTriangle size={14} /> {error}
        </div>
      )}
      {!loading && !error && data && data.creatives.length === 0 && (
        <p className="text-sm text-gray-400">Sin anuncios con actividad suficiente en el período.</p>
      )}
      {!loading && !error && data && data.creatives.length > 0 && (
        <>
          <div className="flex flex-wrap gap-2 mb-3">
            {(Object.entries(LC_CONFIG) as [Lifecycle, typeof LC_CONFIG[Lifecycle]][]).map(([lc, cfg]) => {
              const count = data.creatives.filter(c => c.lifecycle === lc).length
              if (!count) return null
              return (
                <span key={lc} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${cfg.bg} ${cfg.color} ${cfg.border}`}>
                  {cfg.label}: {count}
                </span>
              )
            })}
          </div>
          <div className="space-y-2">
            {data.creatives.map(c => <CreativeCard key={c.ad_id} c={c} />)}
          </div>
        </>
      )}
    </div>
  )
}

// ── Campaign section (inside drawer) ─────────────────────────────────────────────

function CampaignSection({ accountId, clientName }: { accountId: string; clientName: string }) {
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

  if (loading) return (
    <div className="flex items-center gap-2 py-3 text-sm text-gray-400">
      <Loader2 size={14} className="animate-spin" /> Cargando campañas…
    </div>
  )
  if (error) return <p className="text-sm text-rose-600">{error}</p>
  if (!data || !data.campaigns.length) return <p className="text-sm text-gray-400">Sin campañas activas.</p>

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100">
            <th className="pb-2 pr-3">Campaña</th>
            <th className="pb-2 px-2 text-right">Gasto 7d</th>
            <th className="pb-2 px-2 text-center">CPL</th>
            <th className="pb-2 px-2 text-center">CTR</th>
            <th className="pb-2 px-2 text-center">CPM</th>
            <th className="pb-2 pl-2 text-right">Estado</th>
          </tr>
        </thead>
        <tbody>
          {data.campaigns.map(c => {
            const cfg = HEALTH_CONFIG[c.health]
            return (
              <tr key={c.campaign_id} className="border-b border-gray-50 hover:bg-gray-50/40">
                <td className="py-2 pr-3">
                  <div className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
                    <span className="text-gray-800 truncate max-w-[200px] text-xs" title={c.campaign}>{c.campaign}</span>
                  </div>
                </td>
                <td className="py-2 px-2 text-right text-xs text-gray-600 whitespace-nowrap">{ars(c.spend)}</td>
                <td className="py-2 px-2 text-center">
                  {c.has_cpl ? <ChangeCell value={c.cpl_change} status={c.cpl_status} /> : <span className="text-gray-200 text-xs">—</span>}
                </td>
                <td className="py-2 px-2 text-center"><ChangeCell value={c.ctr_change} status={c.ctr_status} /></td>
                <td className="py-2 px-2 text-center"><ChangeCell value={c.cpm_change} status={c.cpm_status} /></td>
                <td className="py-2 pl-2 text-right">
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color} border ${cfg.border}`}>
                    {cfg.label}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Client drawer ─────────────────────────────────────────────────────────────────

function ClientDrawer({ client, onClose }: { client: ClientAudit; onClose: () => void }) {
  const cfg = HEALTH_CONFIG[client.health]

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // Prevent body scroll while open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/30 cursor-pointer" onClick={onClose} />

      {/* Drawer panel */}
      <div className="w-full max-w-2xl bg-gray-50 shadow-2xl flex flex-col overflow-hidden">

        {/* Header */}
        <div className="bg-white border-b border-gray-100 px-6 py-4 flex items-start justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full shrink-0 mt-1 ${cfg.dot}`} />
            <div>
              <h2 className="text-lg font-bold text-gray-900">{client.client_name}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <HealthBadge health={client.health} />
                <span className="text-xs text-gray-400">Últimos 7 días vs 7 días anteriores</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition shrink-0">
            <X size={18} />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <MetricCard label="Gasto 7d" value={ars(client.spend)} />
            {client.has_cpl && (
              <MetricCard label="CPL" value={ars(client.cpl)} change={client.cpl_change} status={client.cpl_status === 'none' ? undefined : client.cpl_status} />
            )}
            {client.has_cpl && (
              <MetricCard label="Resultados 7d" value={String(client.results)} />
            )}
            <MetricCard label="CTR (clics en enlace)" value={`${client.ctr.toFixed(2)}%`} change={client.ctr_change} status={client.ctr_status} />
            <MetricCard label="CPM" value={ars(client.cpm)} change={client.cpm_change} status={client.cpm_status} />
          </div>

          {/* Diagnosis */}
          <div className={`rounded-xl border p-4 ${
            client.health === 'priority'  ? 'bg-rose-50   border-rose-200'    :
            client.health === 'review'    ? 'bg-amber-50  border-amber-200'   :
            client.health === 'excellent' ? 'bg-emerald-50 border-emerald-200' :
                                            'bg-blue-50   border-blue-200'
          }`}>
            <div className="flex items-start gap-3">
              <div className={`mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                client.health === 'priority'  ? 'bg-rose-100 text-rose-600'       :
                client.health === 'review'    ? 'bg-amber-100 text-amber-600'     :
                client.health === 'excellent' ? 'bg-emerald-100 text-emerald-600' :
                                                'bg-blue-100 text-blue-600'
              }`}>
                {client.health === 'priority' || client.health === 'review'
                  ? <AlertTriangle size={15} />
                  : client.health === 'excellent' ? <CheckCircle2 size={15} /> : <Target size={15} />}
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-gray-900">{client.diagnosis}</p>
                <p className="text-sm text-gray-600">{client.insight}</p>
                <p className="text-sm text-gray-800"><span className="font-semibold">Acción: </span>{client.action}</p>
                {client.tip && (
                  <p className="text-sm text-gray-500 pt-1 border-t border-black/5 mt-1">
                    <span className="font-semibold">Tip: </span>{client.tip}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Campaigns */}
          <div className="bg-white rounded-xl border border-gray-100 px-4 py-4">
            <div className="flex items-center gap-2 mb-3">
              <BarChart2 size={14} className="text-gray-400" />
              <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Desglose por campaña</h3>
            </div>
            <CampaignSection accountId={client.account_id} clientName={client.client_name} />
          </div>

          {/* Creative lifecycle */}
          <div className="bg-white rounded-xl border border-gray-100 px-4 py-4">
            <CreativeSection accountId={client.account_id} />
          </div>

        </div>
      </div>
    </div>
  )
}

// ── Table header for client list ──────────────────────────────────────────────────

function ClientListHeader() {
  return (
    <div className="hidden sm:grid items-center gap-3 px-5 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100"
         style={{ gridTemplateColumns: '1.5rem 1fr 6rem 5.5rem 5.5rem 5.5rem 7rem 1rem' }}>
      <span />
      <span>Cliente</span>
      <span className="text-center">Estado</span>
      <span className="text-center">CPL</span>
      <span className="text-center">CTR</span>
      <span className="text-center">CPM</span>
      <span className="text-right">Gasto 7d</span>
      <span />
    </div>
  )
}

// ── Compact client row ────────────────────────────────────────────────────────────

function ClientRow({ client, rank, onSelect }: { client: ClientAudit; rank: number; onSelect: () => void }) {
  const cfg = HEALTH_CONFIG[client.health]
  return (
    <button
      onClick={onSelect}
      className="w-full text-left bg-white hover:bg-gray-50/60 border-b border-gray-100 last:border-0 transition-colors"
    >
      <div className="hidden sm:grid items-center gap-3 px-5 py-3"
           style={{ gridTemplateColumns: '1.5rem 1fr 6rem 5.5rem 5.5rem 5.5rem 7rem 1rem' }}>
        {/* Rank */}
        <span className="text-[10px] font-bold text-gray-300 text-center">#{rank}</span>

        {/* Client name */}
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
          <span className="font-semibold text-gray-900 text-sm truncate">{client.client_name}</span>
        </div>

        {/* Health badge */}
        <div className="flex justify-center">
          <HealthBadge health={client.health} />
        </div>

        {/* CPL change */}
        <div className="flex justify-center">
          {client.has_cpl
            ? <ChangeCell value={client.cpl_change} status={client.cpl_status} />
            : <span className="text-gray-200 text-xs">—</span>}
        </div>

        {/* CTR change */}
        <div className="flex justify-center">
          <ChangeCell value={client.ctr_change} status={client.ctr_status} />
        </div>

        {/* CPM change */}
        <div className="flex justify-center">
          <ChangeCell value={client.cpm_change} status={client.cpm_status} />
        </div>

        {/* Spend */}
        <span className="text-sm font-medium text-gray-600 whitespace-nowrap text-right">{ars(client.spend)}</span>

        {/* Arrow */}
        <ChevronRight size={14} className="text-gray-300" />
      </div>

      {/* Mobile fallback */}
      <div className="sm:hidden flex items-center gap-3 px-4 py-3">
        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${cfg.dot}`} />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 text-sm truncate">{client.client_name}</p>
          <p className="text-xs text-gray-400 truncate">{client.diagnosis}</p>
        </div>
        <span className="text-sm font-medium text-gray-500 whitespace-nowrap">{ars(client.spend)}</span>
        <ChevronRight size={14} className="text-gray-300" />
      </div>
    </button>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────────

export default function AuditPage() {
  const [data,     setData]     = useState<AuditData | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)
  const [search,   setSearch]   = useState('')
  const [selected, setSelected] = useState<ClientAudit | null>(null)

  const load = useCallback(async (force = false) => {
    setLoading(true); setError(null)
    try {
      const res  = await fetch(`/api/audit${force ? '?force=true' : ''}`)
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
  const visible = results.filter(r =>
    search.trim() === '' || r.client_name.toLowerCase().includes(search.toLowerCase())
  )

  const urgentCount   = results.filter(r => r.health === 'priority').length
  const scaleCount    = results.filter(r => r.tags.includes('Escalar')).length
  const creativoCount = results.filter(r => r.tags.includes('Creativo agotado')).length
  const publicoCount  = results.filter(r => r.tags.includes('Público nuevo')).length
  const updatedAt     = data?.updated_at
    ? new Date(data.updated_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
    : '—'

  return (
    <>
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
              Últimos 7 días vs 7 días anteriores · Solo Meta Ads · Actualizado {updatedAt}
            </p>
          </div>
          <button
            onClick={() => load(true)} disabled={loading}
            className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-800 transition disabled:opacity-50 shrink-0"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Actualizar análisis
          </button>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-4 text-sm flex items-center gap-2">
            <AlertTriangle size={15} />{error}
          </div>
        )}

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <SummaryCard icon={Flame}        label="Urgentes"           value={urgentCount}               colorClass="text-rose-600"    bgClass="bg-rose-50" />
          <SummaryCard icon={ArrowUpRight} label="Para escalar"       value={scaleCount}                colorClass="text-emerald-600" bgClass="bg-emerald-50" />
          <SummaryCard icon={RefreshCw}    label="Creativo agotado"   value={creativoCount}             colorClass="text-orange-600"  bgClass="bg-orange-50" />
          <SummaryCard icon={Target}       label="Público a renovar"  value={publicoCount}              colorClass="text-blue-600"    bgClass="bg-blue-50" />
          <SummaryCard icon={DollarSign}   label="Gasto total 7d"     value={data ? ars(data.total_spend) : '—'} colorClass="text-violet-600" bgClass="bg-violet-50" />
          <SummaryCard icon={Users}        label="Cuentas analizadas" value={data?.total_accounts ?? '—'}        colorClass="text-indigo-600" bgClass="bg-indigo-50" />
        </div>

        {/* Search + hint */}
        <div className="flex items-center justify-between gap-4">
          <p className="text-xs text-gray-400">
            Hacé clic en cualquier cuenta para ver el análisis completo
          </p>
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text" placeholder="Buscar cliente..."
              value={search} onChange={e => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 w-44"
            />
          </div>
        </div>

        {/* Client list */}
        {loading ? (
          <Skeleton />
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-400 text-sm border border-dashed border-gray-200 rounded-2xl bg-white">
            <CheckCircle2 size={28} className="mb-2 text-gray-300" />
            <p>Sin clientes que mostrar</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <ClientListHeader />
            {visible.map((c, i) => (
              <ClientRow key={c.account_id} client={c} rank={i + 1} onSelect={() => setSelected(c)} />
            ))}
          </div>
        )}

        {/* Thresholds legend */}
        {!loading && (
          <div className="flex flex-wrap gap-x-5 gap-y-1 pt-3 border-t border-gray-100">
            <p className="text-xs text-gray-400 font-semibold w-full">Umbrales — Prioridad: CPL → CTR → CPM</p>
            <span className="text-xs text-gray-400">CPL: −10% = verde · +18% = rojo (peso ×3)</span>
            <span className="text-xs text-gray-400">CTR: +10% = verde · −15% = rojo (peso ×2)</span>
            <span className="text-xs text-gray-400">CPM: −10% = verde · +20% = rojo (peso ×1)</span>
          </div>
        )}

      </div>

      {/* Drawer */}
      {selected && <ClientDrawer client={selected} onClose={() => setSelected(null)} />}
    </>
  )
}
