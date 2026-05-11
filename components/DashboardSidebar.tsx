'use client'

import { memo, useMemo } from 'react'
import { TrendingDown, TrendingUp, AlertTriangle } from 'lucide-react'
import type { ClientAudit } from '@/lib/audit'

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

const RANK_BG = ['bg-violet-600', 'bg-blue-600', 'bg-cyan-600']

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

function Top3List({ clients }: { clients: ClientAudit[] }) {
  if (clients.length === 0) {
    return <p className="text-xs text-gray-400 dark:text-gray-600 py-2">Sin clientes de mensajes con datos.</p>
  }

  return (
    <div className="divide-y divide-gray-50 dark:divide-white/[0.04]">
      {clients.map((c, i) => (
        <div key={c.client_name} className="flex items-center gap-2 py-2 first:pt-0 last:pb-0">
          <span className="text-[10px] font-bold text-gray-300 dark:text-gray-700 w-3 shrink-0 tabular-nums">{i + 1}</span>
          <div className={`w-5 h-5 rounded-md ${RANK_BG[i] ?? 'bg-gray-500'} flex items-center justify-center shrink-0`}>
            <span className="text-white text-[9px] font-bold">{c.client_name[0]}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold text-gray-800 dark:text-gray-100 truncate leading-tight">{c.client_name}</p>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 tabular-nums leading-tight mt-0.5">
              {Math.round(c.messaging_total).toLocaleString('es-AR')} msg
              {c.cpl > 0 && <> · {currency(c.cpl)}/CPA</>}
              {' · '}{c.ctr.toFixed(2)}% CTR
            </p>
          </div>
        </div>
      ))}
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

      // CTR drop — MOM preferred, fallback to recent-vs-prev
      const ctrChange = c.mom_ctr_change ?? c.ctr_change
      if (ctrChange !== null && ctrChange < -5) {
        raw.push({ client: c.client_name, metric: 'CTR', change: ctrChange, severity: Math.abs(ctrChange) })
      }

      // CPA rise — messaging CPA, MOM preferred
      const cpaChange = c.mom_cpl_change ?? c.cpl_change
      if (c.has_cpl && cpaChange !== null && cpaChange > 8) {
        raw.push({ client: c.client_name, metric: 'CPA', change: cpaChange, severity: cpaChange })
      }

      // CPA rise — purchase CPA, MOM preferred
      const cpaPurchChange = c.mom_cpa_purchases_change ?? c.cpa_purchases_change
      if (c.cpa_purchases > 0 && cpaPurchChange !== null && cpaPurchChange > 8) {
        raw.push({ client: c.client_name, metric: 'CPA', change: cpaPurchChange, severity: cpaPurchChange })
      }

      // Inversión — recent 7d vs prev 7d
      if (c.spend_change !== null && Math.abs(c.spend_change) > 10) {
        raw.push({ client: c.client_name, metric: 'Inversión', change: c.spend_change, severity: Math.abs(c.spend_change) })
      }
    }

    // One alert per client — keep worst (highest severity), then top 5
    const byClient = new Map<string, DashAlert>()
    for (const a of raw) {
      const existing = byClient.get(a.client)
      if (!existing || a.severity > existing.severity) byClient.set(a.client, a)
    }
    return Array.from(byClient.values())
      .sort((a, b) => b.severity - a.severity)
      .slice(0, 5)
  }, [auditClients, activeSet])

  // Top 3: ALL clients ordered by total messaging conversations (messaging_total = raw, all campaigns)
  const top3 = useMemo<ClientAudit[]>(() => {
    if (!auditClients) return []
    return auditClients
      .filter(c => activeSet.has(c.client_name) && c.messaging_total > 0)
      .sort((a, b) => b.messaging_total - a.messaging_total)
      .slice(0, 3)
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

      {/* Top 3 clientes — mensajes */}
      <WidgetShell title="Top 3 clientes del mes" sub="Por mensajes iniciados">
        {loading || !auditClients
          ? <SkeletonWidget rows={3} />
          : <Top3List clients={top3} />
        }
      </WidgetShell>
    </div>
  )
})

export default DashboardSidebar
