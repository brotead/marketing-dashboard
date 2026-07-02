'use client'

import { memo, useState } from 'react'
import { Settings, Trash2, CheckCircle2, XCircle, AlertCircle, Edit3, Zap, Plus } from 'lucide-react'
import type { GoalEntry, PacingResult } from '@/lib/types'

const KPI_LABEL: Record<GoalEntry['kpi'], string> = {
  mensajes:    'Mensajes WA',
  seguidores:  'Seguidores IG',
  conversiones:'Conversiones',
  alcance:     'Alcance',
  formularios: 'Formularios',
  compras:     'Compras',
}

const STATUS = {
  on_track: {
    bg: 'bg-emerald-500/10', border: 'border-emerald-500/20',
    badge: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30',
    label: 'En objetivo', bar: 'bg-green-500', Icon: CheckCircle2,
  },
  warning: {
    bg: 'bg-amber-500/10', border: 'border-amber-500/20',
    badge: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30',
    label: 'Revisar', bar: 'bg-amber-400', Icon: AlertCircle,
  },
  behind: {
    bg: 'bg-red-500/10', border: 'border-red-500/20',
    badge: 'bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30',
    label: 'Prioridad', bar: 'bg-red-500', Icon: XCircle,
  },
}

export interface GoalRowData {
  goal: GoalEntry
  pacing: PacingResult
  autoValue: number | null
  autoSource: string | null
  onEdit: () => void
  onDelete: () => void
  onUpdateOverride: (val: number | null) => void
}

interface Props {
  clientName: string
  goals: GoalRowData[]
  canEdit: boolean
  onAddGoal: (clientName: string) => void
}

function GoalRow({ goal, pacing, autoValue, autoSource, onEdit, onDelete, onUpdateOverride }: GoalRowData) {
  const [editing, setEditing] = useState(false)
  const [tempVal, setTempVal] = useState(String(goal.current_override ?? ''))

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

  const displayValue = isAuto
    ? autoValue?.toLocaleString()
    : isManual
    ? goal.current_override?.toLocaleString()
    : '—'

  return (
    <div className="flex flex-col gap-2 pt-3 border-t border-gray-200 dark:border-[#2a2a2a]">
      {/* KPI chips + actions */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`${cfg.badge} text-[10px] px-1.5 py-0.5 rounded-full font-medium flex items-center gap-0.5`}>
            <cfg.Icon size={9} />
            {cfg.label}
          </span>
          <span className="bg-gray-100 dark:bg-[#252525] text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-[#333] text-[10px] px-1.5 py-0.5 rounded-full font-medium">
            {KPI_LABEL[goal.kpi]}
          </span>
          {isAuto && (
            <span className="bg-blue-600/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 text-[10px] px-1.5 py-0.5 rounded-full font-medium flex items-center gap-0.5">
              <Zap size={8} />Auto
            </span>
          )}
        </div>
        <div className="flex items-center gap-0 shrink-0">
          <button onClick={onEdit} className="text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 p-1 rounded-lg hover:bg-black/[0.05] dark:hover:bg-white/5 transition">
            <Settings size={12} />
          </button>
          <button onClick={onDelete} className="text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 p-1 rounded-lg hover:bg-black/[0.05] dark:hover:bg-white/5 transition">
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Numbers — compact inline */}
      <div className="flex items-baseline gap-4 text-xs">
        <span className="text-gray-400 dark:text-gray-500">
          Meta <strong className="text-gray-900 dark:text-white tabular-nums">{pacing.goalValue.toLocaleString()}</strong>
        </span>
        <span className="text-gray-400 dark:text-gray-500">
          Esp. <strong className="text-gray-600 dark:text-gray-300 tabular-nums">{pacing.expectedToDate.toLocaleString()}</strong>
        </span>
        <span className={`font-bold tabular-nums ${pacing.diff >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
          {pacing.currentValue.toLocaleString()}
          <span className="font-normal text-[10px] ml-0.5">({pacing.diff >= 0 ? '+' : ''}{pacing.diff})</span>
        </span>
      </div>

      {/* Progress bar */}
      <div>
        <div className="relative h-1.5 bg-gray-200 dark:bg-[#2d2d2d] rounded-full overflow-hidden">
          <div
            className="absolute top-0 bottom-0 w-px bg-gray-400 dark:bg-gray-500/60 z-10"
            style={{ left: `${expectedBarWidth}%` }}
          />
          <div
            className={`h-full rounded-full transition-all duration-500 ${cfg.bar}`}
            style={{ width: `${barWidth}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
          <span className="tabular-nums">{pacing.pctVsExpected.toFixed(0)}% del esperado</span>
          <span className="tabular-nums">Proy: {pacing.projectedEOM.toLocaleString()}</span>
        </div>
      </div>

      {/* Value / edit */}
      {!editing ? (
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-gray-700 dark:text-gray-200 tabular-nums">
            {displayValue}
          </span>
          <button
            onClick={() => { setTempVal(String(goal.current_override ?? '')); setEditing(true) }}
            className="flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium shrink-0"
          >
            <Edit3 size={9} />
            {isManual ? 'Editar' : 'Ingresar'}
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            value={tempVal}
            onChange={(e) => setTempVal(e.target.value)}
            placeholder="Valor real"
            className="flex-1 min-w-0 bg-white dark:bg-[#1a1a1a] border border-gray-300 dark:border-[#333] rounded-lg px-2.5 py-1 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false) }}
          />
          {isManual && (
            <button onClick={() => { onUpdateOverride(null); setEditing(false) }} className="text-[10px] text-gray-400 dark:text-gray-500 hover:text-red-400 shrink-0">
              Limpiar
            </button>
          )}
          <button onClick={handleSave} className="bg-blue-600 text-white px-2.5 py-1 rounded-lg text-[10px] font-medium hover:bg-blue-700 shrink-0">OK</button>
          <button onClick={() => setEditing(false)} className="text-gray-400 dark:text-gray-500 text-[10px] shrink-0">✕</button>
        </div>
      )}
    </div>
  )
}

const ClientGoalCard = memo(function ClientGoalCard({ clientName, goals, canEdit, onAddGoal }: Props) {
  const overallStatus: 'on_track' | 'warning' | 'behind' = goals.reduce(
    (worst, g) => {
      if (g.pacing.status === 'behind') return 'behind'
      if (g.pacing.status === 'warning' && worst !== 'behind') return 'warning'
      return worst
    },
    'on_track' as 'on_track' | 'warning' | 'behind'
  )

  const cfg = STATUS[overallStatus]

  return (
    <div className={`${cfg.bg} bg-white dark:bg-[#1a1a1a] rounded-2xl border ${cfg.border} px-4 py-4 flex flex-col shadow-sm`}>
      {/* Client header */}
      <div className="flex items-center justify-between mb-1">
        <p className="font-bold text-gray-900 dark:text-white text-base tracking-tight">{clientName}</p>
        <span className={`${cfg.badge} text-[10px] px-1.5 py-0.5 rounded-full font-medium flex items-center gap-0.5 shrink-0`}>
          <cfg.Icon size={9} />
          {cfg.label}
        </span>
      </div>

      {/* Goal rows */}
      {goals.map(g => (
        <GoalRow key={g.goal.kpi} {...g} />
      ))}

      {/* Add another goal */}
      {canEdit && (
        <div className="pt-2 mt-1 border-t border-gray-200 dark:border-[#2a2a2a]">
          <button
            onClick={() => onAddGoal(clientName)}
            className="text-[10px] text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium flex items-center gap-0.5"
          >
            <Plus size={10} />
            Agregar otro objetivo
          </button>
        </div>
      )}
    </div>
  )
})

export default ClientGoalCard
