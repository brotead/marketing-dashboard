'use client'

import type { AccountData, BudgetEntry } from '@/lib/types'

interface Props {
  clientName: string
  metaAccount: AccountData | undefined
  googleAccount: AccountData | undefined
  budgets: BudgetEntry[]   // all budgets for this client+month
  daysPassed: number
  daysInMonth: number
}

function currency(n: number) {
  return n.toLocaleString('es-AR', {
    style: 'currency', currency: 'ARS', maximumFractionDigits: 0,
  })
}

export default function DashboardCard({
  clientName, metaAccount, googleAccount, budgets, daysPassed, daysInMonth,
}: Props) {
  const metaBudgets   = budgets.filter((b) => b.source === 'facebook'   && !b.paused)
  const googleBudgets = budgets.filter((b) => b.source === 'google' && !b.paused)

  const metaBudget   = metaBudgets.reduce((s, b) => s + b.budget_total, 0)
  const googleBudget = googleBudgets.reduce((s, b) => s + b.budget_total, 0)
  const totalBudget  = metaBudget + googleBudget

  const metaSpend   = metaAccount?.spend   ?? 0
  const googleSpend = googleAccount?.spend ?? 0
  const totalSpend  = metaSpend + googleSpend

  const metaRecent   = metaAccount?.recent_spend   ?? 0
  const googleRecent = googleAccount?.recent_spend ?? 0
  const totalRecent  = metaRecent + googleRecent

  const pctExpected = (daysPassed / daysInMonth) * 100
  const pctConsumed = totalBudget > 0 ? (totalSpend / totalBudget) * 100 : null
  const deviation   = pctConsumed != null ? pctConsumed - pctExpected : null

  // Health: based on recent spend across all platforms
  let healthDot = 'bg-green-500'
  let healthLabel = 'Activo'
  let borderColor = 'border-green-100'

  if (totalRecent > 0) {
    healthDot = 'bg-green-500'; healthLabel = 'Activo'; borderColor = 'border-green-100'
  } else if (totalSpend > 0) {
    healthDot = 'bg-amber-400'; healthLabel = 'Sin actividad reciente'; borderColor = 'border-amber-100'
  } else {
    healthDot = 'bg-red-400'; healthLabel = 'Sin gasto'; borderColor = 'border-red-100'
  }

  let pacingColor = 'text-gray-400'
  let pacingLabel = '—'
  if (deviation != null) {
    if (Math.abs(deviation) <= 5) { pacingColor = 'text-green-600'; pacingLabel = 'En ritmo' }
    else if (deviation > 5)       { pacingColor = 'text-red-600';   pacingLabel = 'Excediendo' }
    else                          { pacingColor = 'text-amber-600'; pacingLabel = 'Bajo ritmo' }
  }

  const barColor = deviation == null ? 'bg-gray-300'
    : Math.abs(deviation) <= 5 ? 'bg-green-500'
    : deviation > 5 ? 'bg-red-500' : 'bg-amber-400'

  const hasMeta   = !!metaAccount   || metaBudget > 0
  const hasGoogle = !!googleAccount || googleBudget > 0

  return (
    <div className={`bg-white rounded-xl border ${borderColor} p-4 flex flex-col gap-3 hover:shadow-sm transition`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-bold text-gray-900 text-sm">{clientName}</p>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            {hasMeta && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#1877F2] text-white">Meta</span>
            )}
            {hasGoogle && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#4285F4] text-white">Google</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`w-2 h-2 rounded-full ${healthDot}`} />
          <span className="text-xs text-gray-500">{healthLabel}</span>
        </div>
      </div>

      {/* Platform breakdown */}
      <div className="space-y-1.5">
        {hasMeta && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-400 w-14">Meta</span>
            <span className="font-medium text-gray-700">{currency(metaSpend)}</span>
            <span className="text-gray-300 mx-1">/</span>
            <span className="text-gray-500">{metaBudget > 0 ? currency(metaBudget) : '—'}</span>
            {metaBudget > 0 && (
              <span className={`ml-auto text-[10px] font-medium ${
                metaAccount?.recent_spend ?? 0 > 0 ? 'text-green-500' : 'text-amber-500'
              }`}>
                {((metaSpend / metaBudget) * 100).toFixed(0)}%
              </span>
            )}
          </div>
        )}
        {hasGoogle && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-400 w-14">Google</span>
            <span className="font-medium text-gray-700">{currency(googleSpend)}</span>
            <span className="text-gray-300 mx-1">/</span>
            <span className="text-gray-500">{googleBudget > 0 ? currency(googleBudget) : '—'}</span>
            {googleBudget > 0 && (
              <span className={`ml-auto text-[10px] font-medium ${
                googleAccount?.recent_spend ?? 0 > 0 ? 'text-green-500' : 'text-amber-500'
              }`}>
                {((googleSpend / googleBudget) * 100).toFixed(0)}%
              </span>
            )}
          </div>
        )}
      </div>

      {/* Total + progress */}
      {totalBudget > 0 && (
        <div className="border-t border-gray-50 pt-2.5">
          <div className="flex items-center justify-between mb-1.5">
            <div>
              <p className="text-xs text-gray-400">Total gastado</p>
              <p className="font-bold text-gray-900 text-sm">{currency(totalSpend)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400">Presupuesto</p>
              <p className="font-bold text-gray-900 text-sm">{currency(totalBudget)}</p>
            </div>
          </div>
          <div className="relative h-1.5 bg-gray-100 rounded-full overflow-hidden mb-1">
            <div
              className="absolute top-0 bottom-0 w-px bg-gray-300 z-10"
              style={{ left: `${Math.min(pctExpected, 100)}%` }}
            />
            <div
              className={`h-full rounded-full ${barColor}`}
              style={{ width: `${Math.min(pctConsumed ?? 0, 100)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-400">
              {pctConsumed?.toFixed(1)}% · esperado {pctExpected.toFixed(0)}%
            </span>
            <span className={`font-medium ${pacingColor}`}>{pacingLabel}</span>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-gray-300 pt-0.5 border-t border-gray-50">
        <span>{budgets.filter(b => !b.paused).length} campaña{budgets.filter(b => !b.paused).length !== 1 ? 's' : ''} activas</span>
        <span>{currency(totalRecent)} últimos 7d</span>
      </div>
    </div>
  )
}
