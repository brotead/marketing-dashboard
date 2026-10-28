'use client'

import { X, ExternalLink, TrendingUp, TrendingDown, Minus, Zap } from 'lucide-react'
import type { AccountData, BudgetEntry } from '@/lib/types'
import type { ClientAudit, Status } from '@/lib/audit'

interface Props {
  clientName: string
  metaAccount: AccountData | undefined
  googleAccount: AccountData | undefined
  budgets: BudgetEntry[]
  daysPassed: number
  daysInMonth: number
  audit: ClientAudit | null
  responsable?: string
  onClose: () => void
  onCashflow: () => void
}

// ── Formatters ────────────────────────────────────────────────────────────────

function currency(n: number) {
  return n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
}
function fmtShort(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}k`
  return currency(n)
}
function fmtChange(c: number | null) {
  if (c === null) return null
  return `${c > 0 ? '+' : ''}${c.toFixed(0)}%`
}

// ── Status helpers ─────────────────────────────────────────────────────────────

const STATUS_COLORS: Partial<Record<string, string>> = {
  green:  'text-emerald-600 dark:text-emerald-400',
  orange: 'text-amber-600  dark:text-amber-400',
  red:    'text-red-500    dark:text-red-400',
}
function statusColor(s: Status | 'none' | null | undefined) {
  if (!s || s === 'none') return 'text-gray-400 dark:text-gray-500'
  return STATUS_COLORS[s] ?? 'text-gray-400'
}
function changeIcon(c: number | null) {
  if (c === null) return <Minus size={11} className="text-gray-400" />
  if (c >  3) return <TrendingUp  size={11} className="text-emerald-500" />
  if (c < -3) return <TrendingDown size={11} className="text-red-500"  />
  return <Minus size={11} className="text-gray-400" />
}

// ── Health badge ───────────────────────────────────────────────────────────────

const HEALTH_MAP = {
  excellent: { label: 'Excelente',  bg: 'bg-emerald-500/10 dark:bg-emerald-500/15', text: 'text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500' },
  stable:    { label: 'Estable',    bg: 'bg-blue-500/10    dark:bg-blue-500/15',    text: 'text-blue-700    dark:text-blue-400',    dot: 'bg-blue-500'    },
  review:    { label: 'Revisar',    bg: 'bg-amber-500/10   dark:bg-amber-500/15',   text: 'text-amber-700   dark:text-amber-400',   dot: 'bg-amber-400'   },
  priority:  { label: 'Prioritario',bg: 'bg-red-500/10     dark:bg-red-500/15',     text: 'text-red-700     dark:text-red-400',     dot: 'bg-red-500'     },
}

// ── Metric pill ────────────────────────────────────────────────────────────────

function MetricRow({ label, value, change, status }: {
  label: string; value: string; change: number | null; status: Status | 'none' | null
}) {
  const fmt = fmtChange(change)
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-100 dark:border-white/[0.04] last:border-0">
      <span className="text-[12px] text-gray-500 dark:text-gray-400 w-16">{label}</span>
      <span className={`text-[13px] font-bold tabular-nums ${statusColor(status)}`}>{value}</span>
      <div className="flex items-center gap-1 min-w-[52px] justify-end">
        {changeIcon(change)}
        {fmt && (
          <span className={`text-[11px] font-medium tabular-nums ${change && change > 3 ? 'text-emerald-600 dark:text-emerald-400' : change && change < -3 ? 'text-red-500 dark:text-red-400' : 'text-gray-400'}`}>
            {fmt}
          </span>
        )}
      </div>
    </div>
  )
}

// ── Campaign row ───────────────────────────────────────────────────────────────

function CampaignRow({ name, budget, source, paused }: {
  name: string; budget: number; source: string; paused?: boolean
}) {
  return (
    <div className={`flex items-center justify-between gap-3 py-2 border-b border-gray-100 dark:border-white/[0.04] last:border-0 ${paused ? 'opacity-50' : ''}`}>
      <div className="flex items-center gap-2 min-w-0">
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ background: source === 'facebook' ? '#1877F2' : '#4285F4' }}
        />
        <span className="text-[12px] text-gray-700 dark:text-gray-300 truncate">{name}</span>
        {paused && <span className="text-[9px] text-gray-400 bg-gray-100 dark:bg-white/[0.06] px-1.5 py-0.5 rounded shrink-0">Pausada</span>}
      </div>
      <span className="text-[12px] font-semibold text-gray-700 dark:text-gray-200 tabular-nums shrink-0">{fmtShort(budget)}</span>
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────────

export default function ClientDetailModal({
  clientName, metaAccount, googleAccount, budgets,
  daysPassed, daysInMonth, audit, responsable, onClose, onCashflow,
}: Props) {

  // ── Projection ──────────────────────────────────────────────────────────────
  const metaSpend   = metaAccount?.spend   ?? 0
  const googleSpend = googleAccount?.spend ?? 0
  const totalSpend  = metaSpend + googleSpend
  const totalRecent = (metaAccount?.recent_spend ?? 0) + (googleAccount?.recent_spend ?? 0)

  const activeBudgets = budgets.filter(b => !b.paused)
  const totalBudget   = activeBudgets.reduce((s, b) => s + b.budget_total, 0)

  const daysLeft   = Math.max(0, daysInMonth - daysPassed)
  const dailyRate  = totalRecent / 7
  const projected  = totalSpend + dailyRate * daysLeft
  const projectedPct = totalBudget > 0 ? (projected / totalBudget) * 100 : null
  const dailyNeeded  = daysLeft > 0 && totalBudget > 0
    ? Math.max(0, totalBudget - totalSpend) / daysLeft
    : null

  const projStatus =
    projectedPct === null ? 'neutral' :
    projectedPct >= 95 && projectedPct <= 110 ? 'ok' :
    projectedPct > 110 ? 'over' : 'under'

  const projColor = projStatus === 'ok' ? 'text-emerald-600 dark:text-emerald-400'
    : projStatus === 'over' ? 'text-red-500 dark:text-red-400'
    : projStatus === 'under' ? 'text-amber-600 dark:text-amber-400'
    : 'text-gray-400'

  // ── Health ──────────────────────────────────────────────────────────────────
  const hm = audit ? (HEALTH_MAP[audit.health] ?? HEALTH_MAP.stable) : null

  // ── Audit CPL change sign logic ─────────────────────────────────────────────
  // For CPL: lower is better → invert sign for trend icon
  const cplChangeForIcon = audit?.cpl_change != null ? -audit.cpl_change : null

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[3px]" onClick={onClose} />

      {/* Panel */}
      <div
        className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[600px] mx-4 flex flex-col rounded-2xl overflow-hidden"
        style={{ boxShadow: '0 25px 80px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.06)' }}
      >
        {/* Gradient bar */}
        <div className="h-[3px] shrink-0 bg-gradient-to-r from-violet-500 via-blue-500 to-emerald-500" />

        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-6 py-4 bg-white dark:bg-[#141414] border-b border-gray-100 dark:border-white/[0.05]">
          <div className="min-w-0 flex-1">
            <h2 className="font-bold text-[17px] text-gray-900 dark:text-white leading-tight truncate">{clientName}</h2>
            <div className="flex items-center gap-2.5 mt-1.5 flex-wrap">
              {hm && (
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${hm.bg} ${hm.text}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${hm.dot}`} />
                  {hm.label}
                </span>
              )}
              {responsable && (
                <span className="text-[12px] text-gray-400 dark:text-gray-500">Pauta: {responsable}</span>
              )}
              {audit?.tags?.map(tag => (
                <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20 font-medium">
                  {tag}
                </span>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onCashflow}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-[13px] font-semibold shadow-md shadow-violet-500/25 hover:shadow-violet-500/50 hover:scale-105 active:scale-100 transition-all duration-150"
            >
              <ExternalLink size={13} />
              Ir a cashflow
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/[0.07] transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Body — 2-column layout */}
        <div className="bg-gray-50 dark:bg-[#111111] p-5">
          <div className="grid grid-cols-2 gap-4">

            {/* LEFT column */}
            <div className="space-y-4">

              {/* Diagnóstico */}
              {audit && (
                <div className="bg-white dark:bg-[#1a1a1a] rounded-xl border border-gray-100 dark:border-white/[0.06] p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Zap size={13} className="text-violet-500 shrink-0" />
                    <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Diagnóstico</span>
                  </div>
                  <p className="text-[13px] font-bold text-gray-900 dark:text-white leading-tight mb-2">{audit.diagnosis}</p>
                  <p className="text-[12px] text-gray-500 dark:text-gray-400 leading-relaxed">{audit.action}</p>
                </div>
              )}

              {/* Proyección fin de mes */}
              <div className="bg-white dark:bg-[#1a1a1a] rounded-xl border border-gray-100 dark:border-white/[0.06] p-4">
                <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">Proyección de cierre</p>
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] text-gray-500 dark:text-gray-400">Ritmo actual</span>
                    <span className="text-[13px] font-semibold text-gray-800 dark:text-gray-100 tabular-nums">
                      {fmtShort(dailyRate)}<span className="text-gray-400 font-normal">/día</span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] text-gray-500 dark:text-gray-400">Necesario ({daysLeft}d)</span>
                    <span className="text-[13px] font-semibold text-gray-800 dark:text-gray-100 tabular-nums">
                      {dailyNeeded != null ? <>{fmtShort(dailyNeeded)}<span className="text-gray-400 font-normal">/día</span></> : '—'}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-gray-100 dark:border-white/[0.05] flex items-center justify-between">
                    <span className="text-[12px] text-gray-500 dark:text-gray-400">Cerrará en</span>
                    <span className={`text-[14px] font-bold tabular-nums ${projColor}`}>
                      {projectedPct != null ? `${projectedPct.toFixed(0)}%` : '—'}
                      {projectedPct != null && totalBudget > 0 && (
                        <span className="text-[11px] font-normal text-gray-400 ml-1.5">{fmtShort(projected)}</span>
                      )}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT column */}
            <div className="space-y-4">

              {/* Métricas con tendencias */}
              {audit && (
                <div className="bg-white dark:bg-[#1a1a1a] rounded-xl border border-gray-100 dark:border-white/[0.06] p-4">
                  <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Rendimiento (vs. 7d prev.)</p>
                  <MetricRow
                    label="CTR"
                    value={`${audit.ctr.toFixed(2)}%`}
                    change={audit.ctr_change}
                    status={audit.ctr_status}
                  />
                  <MetricRow
                    label="CPM"
                    value={audit.cpm > 0 ? fmtShort(audit.cpm) : '—'}
                    change={audit.cpm_change != null ? -audit.cpm_change : null}
                    status={audit.cpm_status}
                  />
                  {audit.has_cpl && (
                    <MetricRow
                      label="CPL"
                      value={audit.cpl > 0 ? fmtShort(audit.cpl) : '—'}
                      change={cplChangeForIcon}
                      status={audit.cpl_status}
                    />
                  )}
                  {audit.messaging_total > 0 && (
                    <MetricRow
                      label="Mensajes"
                      value={Math.round(audit.messaging_total).toLocaleString('es-AR')}
                      change={audit.conversions_change}
                      status={audit.conversions_status}
                    />
                  )}
                </div>
              )}

              {/* Campañas */}
              <div className="bg-white dark:bg-[#1a1a1a] rounded-xl border border-gray-100 dark:border-white/[0.06] p-4">
                <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Campañas del mes</p>
                <div className="max-h-[140px] overflow-y-auto pr-0.5">
                  {budgets.length === 0 ? (
                    <p className="text-[12px] text-gray-400 dark:text-gray-600 py-3">Sin campañas configuradas</p>
                  ) : (
                    budgets.map(b => (
                      <CampaignRow
                        key={b.campaign_id}
                        name={b.campaign_name}
                        budget={b.budget_total}
                        source={b.source}
                        paused={b.paused}
                      />
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
