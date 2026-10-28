'use client'

import { X, ExternalLink } from 'lucide-react'
import type { AccountData, BudgetEntry } from '@/lib/types'
import type { ClientAudit } from '@/lib/audit'
import { getDeviationClasses } from '@/lib/deviationColor'

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

function currency(n: number) {
  return n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
}

function fmtShort(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}k`
  return currency(n)
}

function StatBlock({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{label}</span>
      <span className="text-xl font-bold text-gray-900 dark:text-white tabular-nums leading-tight">{value}</span>
      {sub && <span className="text-[11px] text-gray-400 dark:text-gray-500">{sub}</span>}
      {highlight && <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">{highlight}</span>}
    </div>
  )
}

function PlatformRow({ label, color, spend, budget, recentSpend, pctExpected }: {
  label: string; color: string; spend: number; budget: number; recentSpend: number; pctExpected: number
}) {
  const pct = budget > 0 ? (spend / budget) * 100 : null
  const isActive = recentSpend > 0

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded text-white shrink-0" style={{ background: color }}>
            {label}
          </span>
          <span className="text-sm font-semibold text-gray-800 dark:text-gray-100 tabular-nums">{currency(spend)}</span>
          <span className="text-gray-300 dark:text-gray-700">/</span>
          <span className="text-sm text-gray-400 dark:text-gray-500 tabular-nums">{budget > 0 ? currency(budget) : '—'}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {pct !== null && (
            <span className={`text-[11px] font-semibold tabular-nums ${isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
              {pct.toFixed(0)}%
            </span>
          )}
          <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-amber-400'}`} />
        </div>
      </div>
      {budget > 0 && (
        <div className="relative h-1 bg-gray-100 dark:bg-white/[0.06] rounded-full overflow-hidden">
          <div
            className="absolute top-0 bottom-0 w-px bg-gray-300 dark:bg-gray-600 z-10"
            style={{ left: `${Math.min(pctExpected, 100)}%` }}
          />
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${Math.min(pct ?? 0, 100)}%`, background: color }}
          />
        </div>
      )}
    </div>
  )
}

function MetricPill({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex-1 min-w-0 bg-gray-50 dark:bg-white/[0.03] rounded-xl p-3 border border-gray-100 dark:border-white/[0.05]">
      <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-base font-bold text-gray-900 dark:text-white tabular-nums leading-tight">{value}</p>
      {sub && <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{sub}</p>}
    </div>
  )
}

export default function ClientDetailModal({
  clientName, metaAccount, googleAccount, budgets,
  daysPassed, daysInMonth, audit, responsable, onClose, onCashflow,
}: Props) {
  const activeBudgets = budgets.filter(b => !b.paused)
  const pausedBudgets = budgets.filter(b => b.paused)

  const metaBudget   = activeBudgets.filter(b => b.source === 'facebook').reduce((s, b) => s + b.budget_total, 0)
  const googleBudget = activeBudgets.filter(b => b.source === 'google').reduce((s, b) => s + b.budget_total, 0)
  const totalBudget  = metaBudget + googleBudget

  const metaSpend    = metaAccount?.spend   ?? 0
  const googleSpend  = googleAccount?.spend ?? 0
  const totalSpend   = metaSpend + googleSpend

  const metaRecent   = metaAccount?.recent_spend   ?? 0
  const googleRecent = googleAccount?.recent_spend ?? 0
  const totalRecent  = metaRecent + googleRecent

  const pctExpected = (daysPassed / daysInMonth) * 100
  const pctConsumed = totalBudget > 0 ? (totalSpend / totalBudget) * 100 : null
  const deviation   = pctConsumed != null ? pctConsumed - pctExpected : null

  const hasMeta   = !!metaAccount   || activeBudgets.some(b => b.source === 'facebook')
  const hasGoogle = !!googleAccount || activeBudgets.some(b => b.source === 'google')

  const dc = getDeviationClasses(deviation)

  // Health
  let healthDot   = 'bg-green-500'
  let healthLabel = 'Activo'
  if (totalRecent > 0) { healthDot = 'bg-green-500'; healthLabel = 'Activo' }
  else if (totalSpend > 0) { healthDot = 'bg-amber-400'; healthLabel = 'Sin actividad reciente' }
  else { healthDot = 'bg-red-400'; healthLabel = 'Sin gasto' }

  // Trend
  const recentDaily = totalRecent / 7
  const priorDays   = Math.max(1, daysPassed - 7)
  const priorDaily  = Math.max(0, totalSpend - totalRecent) / priorDays
  let trendLabel = ''
  let trendColor = ''
  if (priorDaily >= 100) {
    if (recentDaily > priorDaily * 1.12)      { trendLabel = '↑ Mejorando'; trendColor = 'text-emerald-600 dark:text-emerald-500' }
    else if (recentDaily < priorDaily * 0.88) { trendLabel = '↓ Cayendo';   trendColor = 'text-rose-500 dark:text-rose-400'       }
    else                                      { trendLabel = '→ Estable';   trendColor = 'text-gray-500'                          }
  }

  const remainingBudget = Math.max(0, totalBudget - totalSpend)
  const remainingDays   = Math.max(0, daysInMonth - daysPassed)

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[3px]" onClick={onClose} />

      {/* Panel */}
      <div
        className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[580px] mx-4 flex flex-col rounded-2xl overflow-hidden"
        style={{ boxShadow: '0 25px 80px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.06)' }}
      >
        {/* Gradient bar */}
        <div className="h-[3px] shrink-0 bg-gradient-to-r from-violet-500 via-blue-500 to-emerald-500" />

        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-6 py-4 bg-white dark:bg-[#141414] border-b border-gray-100 dark:border-white/[0.05]">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-bold text-lg text-gray-900 dark:text-white leading-tight truncate">{clientName}</h2>
              {hasMeta   && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#1877F2] text-white shrink-0">Meta</span>}
              {hasGoogle && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#4285F4] text-white shrink-0">Google</span>}
            </div>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${healthDot}`} />
                <span className="text-[12px] text-gray-500 dark:text-gray-400">{healthLabel}</span>
              </div>
              {responsable && (
                <span className="text-[12px] text-gray-400 dark:text-gray-500">Pauta: {responsable}</span>
              )}
              {trendLabel && (
                <span className={`text-[12px] font-semibold ${trendColor}`}>{trendLabel}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onCashflow}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-[13px] font-semibold shadow-md shadow-violet-500/30 hover:shadow-violet-500/50 hover:scale-105 active:scale-100 transition-all duration-150"
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

        {/* Body */}
        <div className="bg-gray-50 dark:bg-[#111111] p-5 space-y-4">

          {/* Row 1: Totals */}
          <div className="bg-white dark:bg-[#1a1a1a] rounded-xl border border-gray-100 dark:border-white/[0.06] p-4">
            <div className="grid grid-cols-3 gap-4">
              <StatBlock
                label="Total gastado"
                value={fmtShort(totalSpend)}
                sub={currency(totalSpend)}
              />
              <StatBlock
                label="Presupuesto"
                value={fmtShort(totalBudget)}
                sub={totalBudget > 0 ? `${activeBudgets.length} campaña${activeBudgets.length !== 1 ? 's' : ''} activa${activeBudgets.length !== 1 ? 's' : ''}` : 'Sin presupuesto'}
              />
              <StatBlock
                label="Pacing"
                value={pctConsumed != null ? `${pctConsumed.toFixed(1)}%` : '—'}
                sub={`esperado ${pctExpected.toFixed(0)}%`}
                highlight={deviation != null ? `${deviation > 0 ? '+' : ''}${deviation.toFixed(1)}% · ${dc.label}` : undefined}
              />
            </div>

            {/* Progress bar */}
            {totalBudget > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100 dark:border-white/[0.05] space-y-1.5">
                <div className="relative h-2 bg-gray-100 dark:bg-white/[0.06] rounded-full overflow-hidden">
                  <div
                    className="absolute top-0 bottom-0 w-px bg-gray-400 dark:bg-gray-500 z-10"
                    style={{ left: `${Math.min(pctExpected, 100)}%` }}
                  />
                  <div className={`h-full rounded-full ${dc.bar}`} style={{ width: `${Math.min(pctConsumed ?? 0, 100)}%` }} />
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-gray-400 dark:text-gray-500">Restante: {fmtShort(remainingBudget)} · {remainingDays}d</span>
                  {pausedBudgets.length > 0 && (
                    <span className="text-gray-400 dark:text-gray-500">{pausedBudgets.length} campaña{pausedBudgets.length !== 1 ? 's' : ''} pausada{pausedBudgets.length !== 1 ? 's' : ''}</span>
                  )}
                  <span className={`font-semibold ${dc.text}`}>{dc.label}</span>
                </div>
              </div>
            )}
          </div>

          {/* Row 2: Platform breakdown */}
          {(hasMeta || hasGoogle) && (
            <div className="bg-white dark:bg-[#1a1a1a] rounded-xl border border-gray-100 dark:border-white/[0.06] p-4 space-y-3">
              <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">Desglose por plataforma</p>
              {hasMeta && (
                <PlatformRow
                  label="Meta" color="#1877F2"
                  spend={metaSpend} budget={metaBudget}
                  recentSpend={metaRecent} pctExpected={pctExpected}
                />
              )}
              {hasGoogle && (
                <PlatformRow
                  label="Google" color="#4285F4"
                  spend={googleSpend} budget={googleBudget}
                  recentSpend={googleRecent} pctExpected={pctExpected}
                />
              )}
            </div>
          )}

          {/* Row 3: Performance metrics */}
          {audit && (
            <div>
              <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2 px-0.5">Rendimiento del mes</p>
              <div className="flex gap-3">
                <MetricPill
                  label="Mensajes"
                  value={Math.round(audit.messaging_total).toLocaleString('es-AR')}
                  sub="iniciados"
                />
                <MetricPill
                  label="CTR"
                  value={`${audit.ctr.toFixed(2)}%`}
                  sub="click-through rate"
                />
                <MetricPill
                  label="CPL"
                  value={audit.cpl > 0 ? fmtShort(audit.cpl) : '—'}
                  sub="costo por lead"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
