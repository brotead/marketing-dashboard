'use client'

import { memo, useMemo } from 'react'
import type { ClientAudit } from '@/lib/audit'
import type { BudgetEntry } from '@/lib/types'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  auditClients:  ClientAudit[] | null
  activeClients: string[]
  loading:       boolean
  month:         number
  year:          number
  monthBudgets:  BudgetEntry[]
  clientMetrics: Record<string, { spend: number; deviation: number }>
}

interface Segment {
  value: number
  color: string
  label: string
  fmt?: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const RANK_BG = ['bg-violet-600', 'bg-blue-600', 'bg-cyan-600']

function currency(n: number) {
  return n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
}

function fmtBudget(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`
  return currency(n)
}

// ── Shells ────────────────────────────────────────────────────────────────────

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

// ── Donut chart — pure SVG, no deps ──────────────────────────────────────────

function DonutChart({ segments }: { segments: Segment[] }) {
  const total = segments.reduce((s, g) => s + g.value, 0)
  if (total === 0) {
    return <p className="text-xs text-gray-400 dark:text-gray-600 py-1">Sin datos</p>
  }

  const r = 30, cx = 40, cy = 40
  const C = 2 * Math.PI * r  // ≈ 188.5

  let cum = 0
  const arcs = segments.map(seg => {
    const len = (seg.value / total) * C
    const arc = { ...seg, len, offset: C / 4 - cum }
    cum += len
    return arc
  })

  return (
    <div className="flex flex-col items-center gap-3">
      <svg width="80" height="80" viewBox="0 0 80 80">
        {/* Track */}
        <circle
          cx={cx} cy={cy} r={r} fill="none" strokeWidth={12}
          stroke="currentColor" className="text-gray-100 dark:text-white/[0.06]"
        />
        {/* Segments */}
        {arcs.map((arc, i) => (
          <circle
            key={i}
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={arc.color}
            strokeWidth={12}
            strokeDasharray={`${arc.len} ${C}`}
            strokeDashoffset={arc.offset}
          />
        ))}
      </svg>

      <div className="w-full space-y-1.5">
        {arcs.map((arc, i) => (
          <div key={i} className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: arc.color }} />
              <span className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{arc.label}</span>
            </div>
            <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-200 tabular-nums shrink-0">
              {arc.fmt ?? arc.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Skeletons ─────────────────────────────────────────────────────────────────

function SkeletonDonut() {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="w-20 h-20 rounded-full bg-gray-100 dark:bg-white/[0.05] animate-pulse" />
      <div className="w-full space-y-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex justify-between gap-2">
            <div className="h-2.5 bg-gray-100 dark:bg-white/[0.05] rounded animate-pulse flex-1" />
            <div className="h-2.5 bg-gray-100 dark:bg-white/[0.05] rounded animate-pulse w-8 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  )
}

function SkeletonList({ rows = 3 }: { rows?: number }) {
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

// ── Top 3 list ────────────────────────────────────────────────────────────────

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

// ── Main component ────────────────────────────────────────────────────────────

const DashboardSidebar = memo(function DashboardSidebar({
  auditClients, activeClients, loading, month, year, monthBudgets, clientMetrics,
}: Props) {
  const activeSet = useMemo(() => new Set(activeClients), [activeClients])

  // Pacing status: how many clients are on-track / under / over / no-spend
  const pacingSegments = useMemo<Segment[]>(() => {
    let onTrack = 0, under = 0, over = 0, noSpend = 0
    for (const c of activeClients) {
      const m = clientMetrics[c]
      if (!m) continue
      if (m.spend === 0) { noSpend++; continue }
      if (m.deviation >= -5 && m.deviation <= 5) onTrack++
      else if (m.deviation < -5) under++
      else over++
    }
    return [
      { value: onTrack, color: '#10b981', label: 'En ritmo'      },
      { value: under,   color: '#f59e0b', label: 'Bajo ritmo'    },
      { value: over,    color: '#3b82f6', label: 'Sobre ritmo'   },
      { value: noSpend, color: '#6b7280', label: 'Sin inversión' },
    ].filter(s => s.value > 0)
  }, [activeClients, clientMetrics])

  // Budget distribution by platform
  const platformSegments = useMemo<Segment[]>(() => {
    const meta   = monthBudgets.filter(b => b.source === 'facebook').reduce((s, b) => s + b.budget_total, 0)
    const google = monthBudgets.filter(b => b.source === 'google').reduce((s, b) => s + b.budget_total, 0)
    return [
      { value: meta,   color: '#1877F2', label: 'Meta Ads',   fmt: fmtBudget(meta)   },
      { value: google, color: '#4285F4', label: 'Google Ads', fmt: fmtBudget(google) },
    ].filter(s => s.value > 0)
  }, [monthBudgets])

  // Top 3 by messaging volume
  const top3 = useMemo<ClientAudit[]>(() => {
    if (!auditClients) return []
    return auditClients
      .filter(c => activeSet.has(c.client_name) && c.messaging_total > 0)
      .sort((a, b) => b.messaging_total - a.messaging_total)
      .slice(0, 3)
  }, [auditClients, activeSet])

  const monthLabel = `${MONTHS[month - 1]} · ${activeClients.length} cliente${activeClients.length !== 1 ? 's' : ''}`

  return (
    <div className="space-y-4">

      {/* Pacing donut */}
      <WidgetShell title="Ritmo de inversión" sub={monthLabel}>
        {loading ? <SkeletonDonut /> : <DonutChart segments={pacingSegments} />}
      </WidgetShell>

      {/* Platform budget donut */}
      <WidgetShell title="Presupuesto por plataforma" sub="Distribución del mes actual">
        {loading ? <SkeletonDonut /> : <DonutChart segments={platformSegments} />}
      </WidgetShell>

      {/* Top 3 by messaging */}
      <WidgetShell title="Top 3 clientes del mes" sub="Por mensajes iniciados">
        {loading || !auditClients
          ? <SkeletonList rows={3} />
          : <Top3List clients={top3} />
        }
      </WidgetShell>

    </div>
  )
})

export default DashboardSidebar
