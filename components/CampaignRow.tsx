'use client'

import { memo, useState } from 'react'
import { Settings, Trash2, PauseCircle, PlayCircle, Pencil, X } from 'lucide-react'
import type { BudgetEntry, CashflowResult } from '@/lib/types'

interface Props {
  budget: BudgetEntry
  cashflow: CashflowResult
  isNew?: boolean
  onEdit: () => void
  onDelete: () => void
  onPause: () => void
  onSpendOverride: (val: number | null) => void
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
  on_track:     'text-green-600 dark:text-green-400',
  overspending: 'text-red-600 dark:text-red-400',
  underspending:'text-amber-600 dark:text-amber-400',
}
const DEVIATION_TEXT: Record<CashflowResult['status'], string> = {
  on_track:     'text-green-600 dark:text-green-500',
  overspending: 'text-red-600 dark:text-red-500',
  underspending:'text-amber-600 dark:text-amber-500',
}

const CampaignRow = memo(function CampaignRow({ budget, cashflow, isNew, onEdit, onDelete, onPause, onSpendOverride }: Props) {
  const [editingSpend, setEditingSpend] = useState(false)
  const [spendInput, setSpendInput] = useState('')

  const isManualSpend = budget.spend_override != null
  const barW = Math.min(cashflow.pctConsumed, 100)
  const expW = Math.min(cashflow.pctExpected, 100)

  const handleSpendSave = () => {
    const val = parseFloat(spendInput.replace(/\./g, '').replace(',', '.'))
    if (!isNaN(val) && val >= 0) onSpendOverride(val)
    setEditingSpend(false)
  }

  if (budget.paused) {
    return (
      <div className="bg-gray-50 dark:bg-[#141414] border border-dashed border-gray-200 dark:border-[#2a2a2a] rounded-xl px-4 py-3 flex items-center gap-3 opacity-60">
        <span className="w-2 h-2 rounded-full shrink-0 bg-gray-400 dark:bg-gray-600" />
        <p className="flex-1 text-sm text-gray-400 dark:text-gray-500 truncate min-w-0">{budget.campaign_name}</p>
        <span className="text-xs bg-gray-100 dark:bg-[#2a2a2a] text-gray-500 px-2 py-0.5 rounded-full font-medium">Pausada</span>
        <span className="text-xs text-gray-500 font-medium">{currency(budget.budget_total)}</span>
        <div className="flex items-center gap-0.5 shrink-0">
          <button onClick={onPause} className="text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 p-1 rounded hover:bg-black/[0.05] dark:hover:bg-[#252525] transition" title="Reactivar campaña">
            <PlayCircle size={13} />
          </button>
          <button onClick={onDelete} className="text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 p-1 rounded hover:bg-black/[0.05] dark:hover:bg-[#252525] transition" title="Eliminar campaña">
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#2a2a2a] rounded-xl px-4 py-3.5 hover:border-gray-300 dark:hover:border-[#333] hover:shadow-sm transition">
      {/* Row 1: name + actions */}
      <div className="flex items-center gap-2 mb-3">
        <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[cashflow.status]}`} />
        <p className="flex-1 text-sm font-medium text-gray-800 dark:text-gray-200 truncate min-w-0">{budget.campaign_name}</p>
        {isNew && (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-500 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
            Nueva
          </span>
        )}
        {isManualSpend && (
          <span className="text-xs bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-500/30 px-2 py-0.5 rounded-full font-medium shrink-0">
            Gasto manual
          </span>
        )}
        <div className="flex items-center gap-0.5 shrink-0">
          <button onClick={onEdit} className="text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 p-1 rounded hover:bg-black/[0.05] dark:hover:bg-[#252525] transition" title="Editar campaña">
            <Settings size={13} />
          </button>
          <button onClick={onPause} className="text-gray-400 dark:text-gray-500 hover:text-amber-600 dark:hover:text-amber-400 p-1 rounded hover:bg-black/[0.05] dark:hover:bg-[#252525] transition" title="Pausar campaña">
            <PauseCircle size={13} />
          </button>
          <button onClick={onDelete} className="text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 p-1 rounded hover:bg-black/[0.05] dark:hover:bg-[#252525] transition" title="Eliminar campaña">
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Row 2: metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3 mb-3 text-sm">
        <div>
          <p className="text-[11px] font-medium text-gray-400 dark:text-gray-500 mb-1">Presupuesto</p>
          <p className="font-semibold text-gray-900 dark:text-white tabular-nums">{currency(cashflow.budgetTotal)}</p>
        </div>

        {/* Gasto — editable */}
        <div>
          <p className="text-[11px] font-medium text-gray-400 dark:text-gray-500 mb-1">Gasto real</p>
          {editingSpend ? (
            <div className="flex items-center gap-1">
              <input
                autoFocus
                type="number"
                value={spendInput}
                onChange={(e) => setSpendInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSpendSave(); if (e.key === 'Escape') setEditingSpend(false) }}
                className="w-full text-xs font-bold bg-gray-50 dark:bg-[#252525] border border-blue-500 rounded px-1.5 py-0.5 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="0"
              />
              <button onClick={handleSpendSave} className="text-blue-600 dark:text-blue-400 text-xs font-semibold hover:text-blue-700 dark:hover:text-blue-300 shrink-0">OK</button>
              <button onClick={() => setEditingSpend(false)} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 shrink-0">
                <X size={11} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1 group">
              <p className={`font-semibold tabular-nums ${isManualSpend ? 'text-orange-600 dark:text-orange-400' : 'text-gray-900 dark:text-white'}`}>
                {currency(cashflow.spendToDate)}
              </p>
              <button
                onClick={() => { setSpendInput(String(cashflow.spendToDate)); setEditingSpend(true) }}
                className="text-gray-300 dark:text-gray-600 hover:text-blue-600 dark:hover:text-blue-400 opacity-0 group-hover:opacity-100 transition"
                title="Editar gasto manualmente"
              >
                <Pencil size={10} />
              </button>
              {isManualSpend && (
                <button
                  onClick={() => onSpendOverride(null)}
                  className="text-orange-400/50 hover:text-orange-500 dark:hover:text-orange-400 transition"
                  title="Quitar override y volver a Windsor"
                >
                  <X size={10} />
                </button>
              )}
            </div>
          )}
        </div>

        <div>
          <p className="text-[11px] font-medium text-gray-400 dark:text-gray-500 mb-1">Restante</p>
          <p className={`font-semibold tabular-nums ${cashflow.budgetRemaining < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
            {currency(cashflow.budgetRemaining)}
          </p>
        </div>
        <div>
          <p className="text-[11px] font-medium text-gray-400 dark:text-gray-500 mb-1">Diario recomendado</p>
          <p className={`font-bold tabular-nums ${STATUS_TEXT[cashflow.status]}`}>
            {currency(Math.max(cashflow.dailyRecommended, 0))}
            <span className="text-[11px] font-normal text-gray-400 dark:text-gray-500 ml-0.5">/día</span>
          </p>
        </div>
      </div>

      {/* Row 3: progress bar */}
      <div>
        <div className="relative h-1.5 bg-gray-200 dark:bg-[#2d2d2d] rounded-full overflow-hidden mb-1">
          <div className="absolute top-0 bottom-0 w-px bg-gray-400 dark:bg-gray-500 z-10" style={{ left: `${expW}%` }} />
          <div className={`h-full rounded-full ${STATUS_BAR[cashflow.status]}`} style={{ width: `${barW}%` }} />
        </div>
        <div className="flex items-center justify-between text-xs text-gray-400 dark:text-gray-600">
          <span className="tabular-nums">
            <span className="font-semibold text-gray-600 dark:text-gray-400">{cashflow.pctConsumed.toFixed(1)}%</span>
            {' consumido · '}esperado {cashflow.pctExpected.toFixed(1)}%
            {' · '}
            <span className={`font-medium ${DEVIATION_TEXT[cashflow.status]}`}>
              {cashflow.deviation > 0 ? '+' : ''}{cashflow.deviation.toFixed(1)}% desvío
            </span>
          </span>
          <span className="text-gray-400 dark:text-gray-500">{cashflow.daysLeft}d restantes</span>
        </div>
      </div>
    </div>
  )
})

export default CampaignRow
