'use client'

import { memo, useMemo } from 'react'
import { TrendingDown, TrendingUp, AlertTriangle } from 'lucide-react'
import type { ClientAudit, Health } from '@/lib/audit'

// ── Types ────────────────────────────────────────────────────────────────────

interface DashAlert {
  client:   string
  metric:   'CTR' | 'CPA' | 'Inversión'
  change:   number   // signed %, negative = drop
  severity: number   // abs, for sorting
}

interface Props {
  auditClients:  ClientAudit[] | null
  activeClients: string[]
  loading:       boolean
  month:         number
  year:          number
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function currency(n: number) {
  return n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
}

const HEALTH_LABEL: Record<Health, string> = {
  excellent: 'Excelente',
  stable:    'Estable',
  review:    'Revisar',
  priority:  'Prioridad',
}

const HEALTH_COLOR: Record<Health, string> = {
  excellent: 'text-emerald-500 dark:text-emerald-400',
  stable:    'text-blue-500 dark:text-blue-400',
  review:    'text-amber-500 dark:text-amber-400',
  priority:  'text-red-500 dark:text-red-400',
}

const RANK_BG = [
  'bg-violet-600', 'bg-blue-600', 'bg-cyan-600', 'bg-teal-600', 'bg-slate-600',
]

// ── Sub-widgets ───────────────────────────────────────────────────────────────

function WidgetShell({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-[#111111] rounded-2xl border border-gray-100 dark:border-white/[0.06] shadow-sm p-5">
      <div className="mb-4">
        <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{title}</p>
        <p className="text-[11px] text-gray-400 dark:text-gray-600 mt-0.5">{sub}</p>
      </div>
      {children}
    </div>
  )
}

function AlertasList({ alerts, month, year }: { alerts: DashAlert[]; month: number; year: number }) {
  const label = `${MONTHS[month - 1]} ${year}`

  if (alerts.length === 0) {
    return (
      <p className="text-xs text-gray-400 dark:text-gray-600 py-2">Sin anomalías detectadas este mes.</p>
    )
  }

  return (
    <div className="divide-y divide-gray-50 dark:divide-white/[0.04]">
      {alerts.map((a, i) => {
        const isHigh = a.severity > 30
        const dotCls = isHigh ? 'bg-red-500' : 'bg-amber-400'
        const badgeCls = isHigh
          ? 'bg-red-500/10 text-red-500 dark:text-red-400'
          : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
        const dropped = a.change < 0
        const dir = a.metric === 'CPA'
          ? (a.change > 0 ? 'subió' : 'bajó')
          : (dropped ? 'cayó' : 'subió')
        const Icon = (a.metric === 'CPA' && a.change > 0) || (a.metric !== 'CPA' && !dropped)
          ? TrendingUp : TrendingDown

        return (
          <div key={i} className="flex items-start gap-2.5 py-2.5 first:pt-0 last:pb-0">
            <div className="flex items-center gap-1.5 mt-1 shrink-0">
              <span className={`w-1.5 h-1.5 rounded-full ${dotCls}`} />
              <AlertTriangle size={11} className={isHigh ? 'text-red-400' : 'text-amber-400'} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1 mb-0.5">
                <span className="text-[11px] font-bold text-gray-800 dark:text-gray-100 truncate uppercase tracking-wide">
                  {a.client}
                </span>
                <span className="text-[10px] text-gray-300 dark:text-gray-700 shrink-0">{label}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Icon size={10} className={isHigh ? 'text-red-400' : 'text-amber-400'} />
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  {a.metric} {dir} {Math.abs(a.change).toFixed(0)}%
                </p>
              </div>
              <span className={`inline-block mt-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${badgeCls}`}>
                {isHigh ? 'Impacto alto' : 'Impacto medio'}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function Top5List({ clients }: { clients: ClientAudit[] }) {
  if (clients.length === 0) {
    return <p className="text-xs text-gray-400 dark:text-gray-600 py-2">Sin datos disponibles.</p>
  }

  return (
    <div className="divide-y divide-gray-50 dark:divide-white/[0.04]">
      {clients.map((c, i) => {
        const isMessaging = c.client_type === 'messaging'
        return (
          <div key={c.client_name} className="flex items-start gap-2.5 py-2.5 first:pt-0 last:pb-0">
            <span className="text-[11px] font-bold text-gray-300 dark:text-gray-700 w-3 shrink-0 mt-1">{i + 1}</span>
            <div className={`w-6 h-6 rounded-lg ${RANK_BG[i] ?? 'bg-gray-500'} flex items-center justify-center shrink-0`}>
              <span className="text-white text-[10px] font-bold">{c.client_name[0]}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[11px] font-semibold text-gray-800 dark:text-gray-100 truncate">{c.client_name}</span>
                <span className={`text-[11px] font-bold tabular-nums ${HEALTH_COLOR[c.health]}`}>{c.score}</span>
              </div>
              <p className={`text-[10px] font-medium mt-0 ${HEALTH_COLOR[c.health]}`}>{HEALTH_LABEL[c.health]}</p>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-[10px] text-gray-400 dark:text-gray-500 tabular-nums">CTR {c.ctr.toFixed(2)}%</span>
                <span className="text-gray-200 dark:text-gray-700 text-[10px]">·</span>
                <span className="text-[10px] text-gray-400 dark:text-gray-500 tabular-nums">{currency(c.spend)}</span>
                {isMessaging && c.conversions > 0 && (
                  <>
                    <span className="text-gray-200 dark:text-gray-700 text-[10px]">·</span>
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 tabular-nums">
                      {Math.round(c.conversions).toLocaleString('es-AR')} msg
                    </span>
                  </>
                )}
                {isMessaging && c.cpl > 0 && (
                  <>
                    <span className="text-gray-200 dark:text-gray-700 text-[10px]">·</span>
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 tabular-nums">{currency(c.cpl)}/msg</span>
                  </>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function SkeletonWidget({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-start gap-2.5">
          <div className="w-4 h-4 bg-gray-100 dark:bg-white/[0.05] rounded-full animate-pulse shrink-0 mt-1" />
          <div className="flex-1 space-y-1.5">
            <div className="h-2.5 bg-gray-100 dark:bg-white/[0.05] rounded animate-pulse w-3/4" />
            <div className="h-2 bg-gray-100 dark:bg-white/[0.05] rounded animate-pulse w-1/2" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Main sidebar ──────────────────────────────────────────────────────────────

const DashboardSidebar = memo(function DashboardSidebar({
  auditClients, activeClients, loading, month, year,
}: Props) {
  const activeSet = useMemo(() => new Set(activeClients), [activeClients])

  const alerts = useMemo<DashAlert[]>(() => {
    if (!auditClients) return []
    const raw: DashAlert[] = []

    for (const c of auditClients) {
      if (!activeSet.has(c.client_name)) continue

      // CTR drop (MOM)
      if (c.mom_ctr_change !== null && c.mom_ctr_change < -10) {
        raw.push({ client: c.client_name, metric: 'CTR', change: c.mom_ctr_change, severity: Math.abs(c.mom_ctr_change) })
      }

      // CPA rise MOM — messaging CPA
      if (c.has_cpl && c.mom_cpl_change !== null && c.mom_cpl_change > 15) {
        raw.push({ client: c.client_name, metric: 'CPA', change: c.mom_cpl_change, severity: c.mom_cpl_change })
      }

      // CPA rise MOM — purchase CPA
      if (c.cpa_purchases > 0 && c.mom_cpa_purchases_change !== null && c.mom_cpa_purchases_change > 15) {
        raw.push({ client: c.client_name, metric: 'CPA', change: c.mom_cpa_purchases_change, severity: c.mom_cpa_purchases_change })
      }

      // Inversión — recent 7d vs prev 7d trend
      if (c.spend_change !== null && Math.abs(c.spend_change) > 20) {
        raw.push({ client: c.client_name, metric: 'Inversión', change: c.spend_change, severity: Math.abs(c.spend_change) })
      }
    }

    return raw.sort((a, b) => b.severity - a.severity).slice(0, 5)
  }, [auditClients, activeSet])

  const top5 = useMemo<ClientAudit[]>(() => {
    if (!auditClients) return []
    return auditClients
      .filter(c => activeSet.has(c.client_name) && c.spend > 0)
      .sort((a, b) => {
        const ctrDiff = b.ctr - a.ctr
        if (Math.abs(ctrDiff) > 0.05) return ctrDiff
        return b.spend - a.spend
      })
      .slice(0, 5)
  }, [auditClients, activeSet])

  return (
    <div className="space-y-4">
      {/* Alertas del mes */}
      <WidgetShell title="Alertas del mes" sub="Anomalías negativas detectadas">
        {loading || !auditClients
          ? <SkeletonWidget rows={4} />
          : <AlertasList alerts={alerts} month={month} year={year} />
        }
      </WidgetShell>

      {/* Top 5 clientes */}
      <WidgetShell title="Top 5 clientes del mes" sub="CTR · Inversión · Resultados">
        {loading || !auditClients
          ? <SkeletonWidget rows={5} />
          : <Top5List clients={top5} />
        }
      </WidgetShell>
    </div>
  )
})

export default DashboardSidebar
