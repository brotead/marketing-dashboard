'use client'

import { memo, useState } from 'react'
import { Settings, Trash2, CheckCircle2, XCircle, AlertCircle, Edit3, Zap } from 'lucide-react'
import type { GoalEntry, PacingResult } from '@/lib/types'

interface Props {
  goal: GoalEntry
  pacing: PacingResult
  autoValue: number | null
  autoSource: string | null
  onEdit: () => void
  onDelete: () => void
  onUpdateOverride: (val: number | null) => void
}

const KPI_LABEL: Record<GoalEntry['kpi'], string> = {
  mensajes:    'Mensajes WA',
  seguidores:  'Seguidores IG',
  conversiones:'Conversiones Google',
}

const STATUS = {
  on_track: {
    bg: 'bg-emerald-500/10', border: 'border-emerald-500/20',
    badge: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30', label: 'En objetivo',
    bar: 'bg-green-500', Icon: CheckCircle2,
  },
  warning: {
    bg: 'bg-amber-500/10', border: 'border-amber-500/20',
    badge: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30', label: 'Revisar',
    bar: 'bg-amber-400', Icon: AlertCircle,
  },
  behind: {
    bg: 'bg-red-500/10', border: 'border-red-500/20',
    badge: 'bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30', label: 'Prioridad',
    bar: 'bg-red-500', Icon: XCircle,
  },
}

const PacingCard = memo(function PacingCard({
  goal, pacing, autoValue, autoSource, onEdit, onDelete, onUpdateOverride,
}: Props) {
  const [editing,  setEditing]  = useState(false)
  const [tempVal,  setTempVal]  = useState(String(goal.current_override ?? ''))

  const cfg      = STATUS[pacing.status]
  const isManual = goal.current_override != null
  const isAuto   = !isManual && autoValue !== null

  const barWidth         = Math.min(pacing.goalValue > 0 ? (pacing.currentValue / pacing.goalValue) * 100 : 0, 100)
  const expectedBarWidth = Math.min(pacing.goalValue > 0 ? (pacing.expectedToDate / pacing.goalValue) * 100 : 0, 100)

  const handleSave = () => {
    const val = tempVal === '' ? null : Number(tempVal)
    onUpdateOverride(val)
    setEditing(false)
  }

  return (
    <div className={`${cfg.bg} bg-white dark:bg-[#1a1a1a] rounded-2xl border ${cfg.border} p-5 flex flex-col gap-4 shadow-sm`}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`${cfg.badge} text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1`}>
              <cfg.Icon size={10} />
              {cfg.label}
            </span>
            <span className="bg-gray-100 dark:bg-[#252525] text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-[#333] text-xs px-2 py-0.5 rounded-full font-medium">
              {KPI_LABEL[goal.kpi]}
            </span>
            {isAuto && (
              <span className="bg-blue-600/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                <Zap size={9} />
                Auto
              </span>
            )}
            {isManual && (
              <span className="bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-500/30 text-xs px-2 py-0.5 rounded-full font-medium">
                Manual
              </span>
            )}
          </div>
          <p className="font-bold text-gray-900 dark:text-white text-lg tracking-tight">{goal.client_name}</p>
        </div>
        <div className="flex items-center gap-0.5">
          <button onClick={onEdit} className="text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 p-1.5 rounded-lg hover:bg-black/[0.05] dark:hover:bg-white/5 transition">
            <Settings size={14} />
          </button>
          <button onClick={onDelete} className="text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 p-1.5 rounded-lg hover:bg-black/[0.05] dark:hover:bg-white/5 transition">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Numbers */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <p className="text-[11px] font-medium text-gray-400 dark:text-gray-500 mb-1">Meta mensual</p>
          <p className="font-bold text-gray-900 dark:text-white text-base tabular-nums tracking-tight">{pacing.goalValue.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-[11px] font-medium text-gray-400 dark:text-gray-500 mb-1">Esperado hoy</p>
          <p className="font-bold text-gray-600 dark:text-gray-300 text-base tabular-nums tracking-tight">{pacing.expectedToDate.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-[11px] font-medium text-gray-400 dark:text-gray-500 mb-1">Real hoy</p>
          <div className="flex items-baseline gap-1">
            <p className={`font-bold text-base tabular-nums tracking-tight ${pacing.diff >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
              {pacing.currentValue.toLocaleString()}
            </p>
            <span className={`text-xs tabular-nums ${pacing.diff >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
              ({pacing.diff >= 0 ? '+' : ''}{pacing.diff})
            </span>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500 mb-1.5">
          <span className="tabular-nums">
            Avance: <strong className="text-gray-700 dark:text-gray-200 font-semibold">{pacing.pctVsExpected.toFixed(0)}%</strong> del esperado
          </span>
          <span className="tabular-nums">Proyección: {pacing.projectedEOM.toLocaleString()}</span>
        </div>
        <div className="relative h-2.5 bg-gray-200 dark:bg-[#2d2d2d] rounded-full overflow-hidden">
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-gray-400 dark:bg-gray-500/60 z-10"
            style={{ left: `${expectedBarWidth}%` }}
          />
          <div
            className={`h-full rounded-full transition-all duration-500 ${cfg.bar}`}
            style={{ width: `${barWidth}%` }}
          />
        </div>
      </div>

      {/* Value source / manual input */}
      <div className="bg-gray-50 dark:bg-[#252525] rounded-xl p-3">
        {!editing ? (
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                {isAuto
                  ? `${autoSource} (automático)`
                  : isManual
                  ? 'Valor ingresado manualmente'
                  : 'Sin datos — ingresá el valor manualmente'}
              </p>
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                {isAuto
                  ? `${autoValue?.toLocaleString()} ${KPI_LABEL[goal.kpi].toLowerCase()}`
                  : isManual
                  ? goal.current_override?.toLocaleString()
                  : '—'}
              </p>
            </div>
            <button
              onClick={() => { setTempVal(String(goal.current_override ?? '')); setEditing(true) }}
              className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium shrink-0"
            >
              <Edit3 size={11} />
              {isManual ? 'Editar' : 'Forzar valor'}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={tempVal}
              onChange={(e) => setTempVal(e.target.value)}
              placeholder="Valor real actual"
              className="flex-1 min-w-0 bg-white dark:bg-[#1a1a1a] border border-gray-300 dark:border-[#333] rounded-lg px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false) }}
            />
            {isManual && (
              <button
                onClick={() => { onUpdateOverride(null); setEditing(false) }}
                className="text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 text-xs px-2 py-1.5 shrink-0"
              >
                Limpiar
              </button>
            )}
            <button onClick={handleSave} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-blue-700 shrink-0">
              OK
            </button>
            <button onClick={() => setEditing(false)} className="text-gray-400 dark:text-gray-500 text-xs px-1 py-1.5 shrink-0">✕</button>
          </div>
        )}
      </div>
    </div>
  )
})

export default PacingCard
