'use client'

import { memo, useState, useRef, useCallback } from 'react'
import { Pencil, Check, X } from 'lucide-react'
import type { AccountData, BudgetEntry } from '@/lib/types'
import { getDeviationClasses } from '@/lib/deviationColor'

interface Props {
  clientName: string
  metaAccount: AccountData | undefined
  googleAccount: AccountData | undefined
  budgets: BudgetEntry[]
  daysPassed: number
  daysInMonth: number
  onClick?: () => void
  onRename?: (newName: string) => Promise<void>
}

function currency(n: number) {
  return n.toLocaleString('es-AR', {
    style: 'currency', currency: 'ARS', maximumFractionDigits: 0,
  })
}

const DashboardCard = memo(function DashboardCard({
  clientName, metaAccount, googleAccount, budgets, daysPassed, daysInMonth, onClick, onRename,
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

  let healthDot = 'bg-green-500'
  let healthLabel = 'Activo'
  let borderColor = 'border-green-500/20'

  if (totalRecent > 0) {
    healthDot = 'bg-green-500'; healthLabel = 'Activo'; borderColor = 'border-green-500/20'
  } else if (totalSpend > 0) {
    healthDot = 'bg-amber-400'; healthLabel = 'Sin actividad reciente'; borderColor = 'border-amber-500/20'
  } else {
    healthDot = 'bg-red-400'; healthLabel = 'Sin gasto'; borderColor = 'border-red-500/20'
  }

  const dc = getDeviationClasses(deviation)
  const barColor = deviation == null ? 'bg-gray-300 dark:bg-gray-600' : dc.bar
  const pacingColor = dc.text
  const pacingLabel = dc.label

  const hasMeta   = !!metaAccount   || metaBudgets.length > 0
  const hasGoogle = !!googleAccount || googleBudgets.length > 0

  // ── Rename state ──────────────────────────────────────────────────────────
  const [renaming, setRenaming]   = useState(false)
  const [nameInput, setNameInput] = useState(clientName)
  const [saving, setSaving]       = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const startRename = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setNameInput(clientName)
    setRenaming(true)
    setTimeout(() => { inputRef.current?.select() }, 30)
  }, [clientName])

  const cancelRename = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation()
    setRenaming(false)
    setNameInput(clientName)
  }, [clientName])

  const confirmRename = useCallback(async (e?: React.MouseEvent) => {
    e?.stopPropagation()
    const trimmed = nameInput.trim()
    if (!trimmed || trimmed === clientName) { setRenaming(false); return }
    if (!onRename) { setRenaming(false); return }
    setSaving(true)
    try {
      await onRename(trimmed)
    } finally {
      setSaving(false)
      setRenaming(false)
    }
  }, [nameInput, clientName, onRename])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    e.stopPropagation()
    if (e.key === 'Enter') confirmRename()
    if (e.key === 'Escape') cancelRename()
  }, [confirmRename, cancelRename])

  return (
    <div
      className={`bg-white dark:bg-[#1a1a1a] rounded-2xl border ${borderColor} dark:${borderColor} p-5 flex flex-col gap-4 hover:shadow-md dark:hover:shadow-lg hover:bg-gray-50 dark:hover:bg-[#1e1e1e] transition shadow-sm ${onClick && !renaming ? 'cursor-pointer' : ''}`}
      onClick={!renaming ? onClick : undefined}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {renaming ? (
            <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
              <input
                ref={inputRef}
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={saving}
                className="flex-1 min-w-0 px-2 py-0.5 text-sm font-bold bg-white dark:bg-[#111] border border-violet-400 dark:border-violet-500 rounded-lg text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-violet-400/30"
                autoFocus
              />
              <button
                onClick={confirmRename}
                disabled={saving}
                className="p-1 rounded-md bg-violet-600 hover:bg-violet-700 text-white transition disabled:opacity-50 shrink-0"
                title="Guardar"
              >
                <Check size={12} strokeWidth={3} />
              </button>
              <button
                onClick={cancelRename}
                disabled={saving}
                className="p-1 rounded-md bg-gray-200 dark:bg-[#2a2a2a] hover:bg-gray-300 dark:hover:bg-[#333] text-gray-600 dark:text-gray-400 transition disabled:opacity-50 shrink-0"
                title="Cancelar"
              >
                <X size={12} strokeWidth={3} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 group/name">
              <p className="font-bold text-gray-900 dark:text-gray-100 text-sm truncate">{clientName}</p>
              {onRename && (
                <button
                  onClick={startRename}
                  className="opacity-0 group-hover/name:opacity-100 p-0.5 rounded text-gray-400 hover:text-violet-500 dark:hover:text-violet-400 transition-opacity"
                  title="Renombrar cliente"
                >
                  <Pencil size={11} />
                </button>
              )}
            </div>
          )}
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
          <span className="text-xs text-gray-500 dark:text-gray-500">{healthLabel}</span>
        </div>
      </div>

      {/* Platform breakdown */}
      <div className="space-y-2">
        {hasMeta && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500 w-14 font-medium">Meta</span>
            <span className="font-semibold text-gray-800 dark:text-gray-200 tabular-nums">{currency(metaSpend)}</span>
            <span className="text-gray-300 dark:text-gray-700 mx-1">/</span>
            <span className="text-gray-400 dark:text-gray-500 tabular-nums">{metaBudget > 0 ? currency(metaBudget) : '—'}</span>
            {metaBudget > 0 && (
              <span className={`ml-auto text-[10px] font-semibold tabular-nums ${
                (metaAccount?.recent_spend ?? 0) > 0 ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'
              }`}>
                {((metaSpend / metaBudget) * 100).toFixed(0)}%
              </span>
            )}
          </div>
        )}
        {hasGoogle && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500 w-14 font-medium">Google</span>
            <span className="font-semibold text-gray-800 dark:text-gray-200 tabular-nums">{currency(googleSpend)}</span>
            <span className="text-gray-300 dark:text-gray-700 mx-1">/</span>
            <span className="text-gray-400 dark:text-gray-500 tabular-nums">{googleBudget > 0 ? currency(googleBudget) : '—'}</span>
            {googleBudget > 0 && (
              <span className={`ml-auto text-[10px] font-semibold tabular-nums ${
                (googleAccount?.recent_spend ?? 0) > 0 ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'
              }`}>
                {((googleSpend / googleBudget) * 100).toFixed(0)}%
              </span>
            )}
          </div>
        )}
      </div>

      {/* Total + progress */}
      {totalBudget > 0 && (
        <div className="border-t border-gray-100 dark:border-[#2a2a2a] pt-3.5">
          <div className="flex items-center justify-between mb-2.5">
            <div>
              <p className="text-[11px] font-medium text-gray-400 dark:text-gray-500 mb-0.5">Total gastado</p>
              <p className="font-bold text-gray-900 dark:text-white text-base tabular-nums tracking-tight">{currency(totalSpend)}</p>
            </div>
            <div className="text-right">
              <p className="text-[11px] font-medium text-gray-400 dark:text-gray-500 mb-0.5">Presupuesto</p>
              <p className="font-bold text-gray-600 dark:text-gray-300 text-base tabular-nums tracking-tight">{currency(totalBudget)}</p>
            </div>
          </div>
          <div className="relative h-1.5 bg-gray-200 dark:bg-[#2d2d2d] rounded-full overflow-hidden mb-1">
            <div
              className="absolute top-0 bottom-0 w-px bg-gray-400 dark:bg-gray-500 z-10"
              style={{ left: `${Math.min(pctExpected, 100)}%` }}
            />
            <div
              className={`h-full rounded-full ${barColor}`}
              style={{ width: `${Math.min(pctConsumed ?? 0, 100)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-400 dark:text-gray-600 tabular-nums">
              {pctConsumed?.toFixed(1)}% · esperado {pctExpected.toFixed(0)}%
            </span>
            <span className={`font-semibold ${pacingColor}`}>{pacingLabel}</span>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-gray-400 dark:text-gray-600 pt-2 border-t border-gray-100 dark:border-[#2a2a2a]">
        <span>{budgets.filter(b => !b.paused).length} campaña{budgets.filter(b => !b.paused).length !== 1 ? 's' : ''} activas</span>
        <div className="flex items-center gap-2">
          {(() => {
            const recentDaily = totalRecent / 7
            const priorDays   = Math.max(1, daysPassed - 7)
            const priorDaily  = Math.max(0, totalSpend - totalRecent) / priorDays
            if (priorDaily < 100) return <span>{currency(totalRecent)} 7d</span>
            const t = recentDaily > priorDaily * 1.12 ? 'up' : recentDaily < priorDaily * 0.88 ? 'down' : 'stable'
            return (
              <span className={`font-semibold ${t === 'up' ? 'text-emerald-600 dark:text-emerald-500' : t === 'down' ? 'text-rose-500 dark:text-rose-400' : 'text-gray-500'}`}>
                {t === 'up' ? '↑ Mejorando' : t === 'down' ? '↓ Cayendo' : '→ Estable'}
              </span>
            )
          })()}
        </div>
      </div>
    </div>
  )
})

export default DashboardCard
