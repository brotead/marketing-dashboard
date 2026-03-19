'use client'

import type { AccountData, BudgetEntry } from '@/lib/types'

interface Props {
  account: AccountData
  budgets: BudgetEntry[]  // all budgets for this account+month
  year: number
  month: number
  daysPassed: number
  daysInMonth: number
}

function currency(n: number) {
  return n.toLocaleString('es-AR', {
    style: 'currency', currency: 'ARS', maximumFractionDigits: 0,
  })
}

export default function DashboardCard({ account, budgets, year, month, daysPassed, daysInMonth }: Props) {
  const totalBudget = budgets.reduce((s, b) => s + b.budget_total, 0)
  const configured = budgets.length > 0
  const clientName = budgets[0]?.client_name ?? null

  // Health status based on recent spend (last 7 days)
  let healthDot = ''
  let healthLabel = ''
  let healthBg = ''
  if (!configured) {
    healthDot = 'bg-gray-300'
    healthLabel = 'Sin configurar'
    healthBg = 'border-gray-100'
  } else if (account.recent_spend > 0) {
    healthDot = 'bg-green-500'
    healthLabel = 'Activo'
    healthBg = 'border-green-100'
  } else if (account.spend > 0) {
    healthDot = 'bg-amber-400'
    healthLabel = 'Sin actividad reciente'
    healthBg = 'border-amber-100'
  } else {
    healthDot = 'bg-red-500'
    healthLabel = 'Sin gasto'
    healthBg = 'border-red-100'
  }

  // Pacing vs expected
  const pctExpected = (daysPassed / daysInMonth) * 100
  const pctConsumed = totalBudget > 0 ? (account.spend / totalBudget) * 100 : null
  const deviation = pctConsumed != null ? pctConsumed - pctExpected : null

  let pacingColor = 'text-gray-400'
  let pacingLabel = ''
  if (deviation != null) {
    if (Math.abs(deviation) <= 5) { pacingColor = 'text-green-600'; pacingLabel = 'En ritmo' }
    else if (deviation > 5) { pacingColor = 'text-red-600'; pacingLabel = 'Excediendo' }
    else { pacingColor = 'text-amber-600'; pacingLabel = 'Bajo ritmo' }
  }

  return (
    <div className={`bg-white rounded-xl border ${healthBg} p-4 flex flex-col gap-3 hover:shadow-sm transition`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-gray-900 text-sm truncate">{account.account_name}</p>
          {clientName && (
            <p className="text-xs text-gray-400 mt-0.5">{clientName}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`w-2 h-2 rounded-full ${healthDot}`} />
          <span className="text-xs text-gray-500">{healthLabel}</span>
        </div>
      </div>

      {/* Spend metrics */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <p className="text-xs text-gray-400 mb-0.5">Gasto del mes</p>
          <p className="font-bold text-gray-900 text-sm">{currency(account.spend)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 mb-0.5">Últimos 7 días</p>
          <p className="font-bold text-gray-700 text-sm">{currency(account.recent_spend)}</p>
        </div>
        {configured && (
          <>
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Presupuesto</p>
              <p className="font-bold text-gray-900 text-sm">{currency(totalBudget)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Ritmo</p>
              <p className={`font-bold text-sm ${pacingColor}`}>{pacingLabel}</p>
            </div>
          </>
        )}
      </div>

      {/* Progress bar */}
      {configured && pctConsumed != null && (
        <div>
          <div className="relative h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="absolute top-0 bottom-0 w-px bg-gray-300 z-10"
              style={{ left: `${Math.min(pctExpected, 100)}%` }}
            />
            <div
              className={`h-full rounded-full ${
                deviation == null ? 'bg-gray-300' :
                Math.abs(deviation) <= 5 ? 'bg-green-500' :
                deviation > 5 ? 'bg-red-500' : 'bg-amber-400'
              }`}
              style={{ width: `${Math.min(pctConsumed, 100)}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-1">
            {pctConsumed.toFixed(1)}% consumido · esperado {pctExpected.toFixed(1)}%
          </p>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-gray-400 pt-0.5 border-t border-gray-50">
        <span>{account.campaign_count} campaña{account.campaign_count !== 1 ? 's' : ''}</span>
        <span className="font-mono text-gray-300">{account.account_id}</span>
      </div>
    </div>
  )
}
