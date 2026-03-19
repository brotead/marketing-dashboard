'use client'

import { Settings, Trash2 } from 'lucide-react'
import type { BudgetEntry, CashflowResult } from '@/lib/types'

interface Props {
  budget: BudgetEntry
  cashflow: CashflowResult
  onEdit: () => void
  onDelete: () => void
}

function currency(n: number) {
  return n.toLocaleString('es-AR', {
    style: 'currency', currency: 'ARS', maximumFractionDigits: 0,
  })
}

const STATUS_DOT: Record<CashflowResult['status'], string> = {
  on_track:     'bg-green-500',
  overspending: 'bg-red-500',
  underspending:'bg-amber-400',
}
const STATUS_BAR: Record<CashflowResult['status'], string> = {
  on_track:     'bg-green-500',
  overspending: 'bg-red-500',
  underspending:'bg-amber-400',
}
const STATUS_TEXT: Record<CashflowResult['status'], string> = {
  on_track:     'text-green-700',
  overspending: 'text-red-700',
  underspending:'text-amber-700',
}
const DEVIATION_TEXT: Record<CashflowResult['status'], string> = {
  on_track:     'text-green-500',
  overspending: 'text-red-500',
  underspending:'text-amber-500',
}

export default function CampaignRow({ budget, cashflow, onEdit, onDelete }: Props) {
  const barW = Math.min(cashflow.pctConsumed, 100)
  const expW = Math.min(cashflow.pctExpected, 100)

  return (
    <div className="bg-white border border-gray-100 rounded-xl px-4 py-3.5 hover:border-gray-200 transition">
      {/* Row 1: name + actions */}
      <div className="flex items-center gap-2 mb-3">
        <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[cashflow.status]}`} />
        <p className="flex-1 text-sm font-medium text-gray-800 truncate min-w-0">{budget.campaign_name}</p>
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={onEdit}
            className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100 transition"
            title="Editar presupuesto"
          >
            <Settings size={13} />
          </button>
          <button
            onClick={onDelete}
            className="text-gray-400 hover:text-red-500 p-1 rounded hover:bg-gray-100 transition"
            title="Eliminar campaña"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Row 2: metrics */}
      <div className="grid grid-cols-4 gap-x-4 gap-y-1 mb-3 text-sm">
        <div>
          <p className="text-xs text-gray-400 mb-0.5">Presupuesto</p>
          <p className="font-semibold text-gray-900">{currency(cashflow.budgetTotal)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 mb-0.5">Gasto estimado</p>
          <p className="font-semibold text-gray-900">{currency(cashflow.spendToDate)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 mb-0.5">Restante</p>
          <p className={`font-semibold ${cashflow.budgetRemaining < 0 ? 'text-red-600' : 'text-gray-900'}`}>
            {currency(cashflow.budgetRemaining)}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-400 mb-0.5">Diario recomendado</p>
          <p className={`font-bold ${STATUS_TEXT[cashflow.status]}`}>
            {currency(Math.max(cashflow.dailyRecommended, 0))}
            <span className="text-xs font-normal text-gray-400">/día</span>
          </p>
        </div>
      </div>

      {/* Row 3: progress bar */}
      <div>
        <div className="relative h-1.5 bg-gray-100 rounded-full overflow-hidden mb-1">
          <div
            className="absolute top-0 bottom-0 w-px bg-gray-400 z-10"
            style={{ left: `${expW}%` }}
          />
          <div
            className={`h-full rounded-full ${STATUS_BAR[cashflow.status]}`}
            style={{ width: `${barW}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span>
            <span className="font-medium text-gray-600">{cashflow.pctConsumed.toFixed(1)}%</span>
            {' consumido · '}esperado {cashflow.pctExpected.toFixed(1)}%
            {' · '}
            <span className={DEVIATION_TEXT[cashflow.status]}>
              {cashflow.deviation > 0 ? '+' : ''}{cashflow.deviation.toFixed(1)}% desvío
            </span>
          </span>
          <span>{cashflow.daysLeft}d restantes</span>
        </div>
      </div>
    </div>
  )
}
