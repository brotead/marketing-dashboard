'use client'

import { useState } from 'react'
import { Settings, Trash2, CheckCircle2, XCircle, AlertCircle, Edit3, Zap } from 'lucide-react'
import type { GoalEntry, PacingResult } from '@/lib/types'

interface Props {
  goal: GoalEntry
  pacing: PacingResult
  autoValue: number | null   // null = no auto source available
  autoSource: string | null  // e.g. 'Windsor Meta', 'Windsor IG', 'Google Ads'
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
    bg: 'bg-green-50', border: 'border-green-100',
    badge: 'bg-green-100 text-green-700', label: 'En objetivo',
    bar: 'bg-green-500', Icon: CheckCircle2,
  },
  warning: {
    bg: 'bg-amber-50', border: 'border-amber-100',
    badge: 'bg-amber-100 text-amber-700', label: 'Revisar',
    bar: 'bg-amber-400', Icon: AlertCircle,
  },
  behind: {
    bg: 'bg-red-50', border: 'border-red-100',
    badge: 'bg-red-100 text-red-700', label: 'Prioridad',
    bar: 'bg-red-500', Icon: XCircle,
  },
}

export default function PacingCard({
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
    <div className={`${cfg.bg} rounded-2xl border ${cfg.border} p-5 flex flex-col gap-4`}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`${cfg.badge} text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1`}>
              <cfg.Icon size={10} />
              {cfg.label}
            </span>
            <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full font-medium">
              {KPI_LABEL[goal.kpi]}
            </span>
            {isAuto && (
              <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                <Zap size={9} />
                Auto
              </span>
            )}
            {isManual && (
              <span className="bg-orange-100 text-orange-600 text-xs px-2 py-0.5 rounded-full font-medium">
                Manual
              </span>
            )}
          </div>
          <p className="font-bold text-gray-900 text-base">{goal.client_name}</p>
        </div>
        <div className="flex items-center gap-0.5">
          <button onClick={onEdit} className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-white/60 transition">
            <Settings size={14} />
          </button>
          <button onClick={onDelete} className="text-gray-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-white/60 transition">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Numbers */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <p className="text-xs text-gray-500 mb-0.5">Meta mensual</p>
          <p className="font-bold text-gray-900 text-sm">{pacing.goalValue.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-0.5">Esperado hoy</p>
          <p className="font-bold text-gray-900 text-sm">{pacing.expectedToDate.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-0.5">Real hoy</p>
          <div className="flex items-baseline gap-1">
            <p className={`font-bold text-sm ${pacing.diff >= 0 ? 'text-green-700' : 'text-red-700'}`}>
              {pacing.currentValue.toLocaleString()}
            </p>
            <span className={`text-xs ${pacing.diff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              ({pacing.diff >= 0 ? '+' : ''}{pacing.diff})
            </span>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex justify-between text-xs text-gray-500 mb-1.5">
          <span>
            Avance: <strong>{pacing.pctVsExpected.toFixed(0)}%</strong> del esperado
          </span>
          <span>Proyección: {pacing.projectedEOM.toLocaleString()}</span>
        </div>
        <div className="relative h-2.5 bg-white/70 rounded-full overflow-hidden">
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-gray-400/60 z-10"
            style={{ left: `${expectedBarWidth}%` }}
          />
          <div
            className={`h-full rounded-full transition-all duration-500 ${cfg.bar}`}
            style={{ width: `${barWidth}%` }}
          />
        </div>
      </div>

      {/* Value source / manual input */}
      <div className="bg-white/70 rounded-xl p-3">
        {!editing ? (
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-xs text-gray-500">
                {isAuto
                  ? `${autoSource} (automático)`
                  : isManual
                  ? 'Valor ingresado manualmente'
                  : 'Sin datos — ingresá el valor manualmente'}
              </p>
              <p className="text-sm font-semibold text-gray-900">
                {isAuto
                  ? `${autoValue?.toLocaleString()} ${KPI_LABEL[goal.kpi].toLowerCase()}`
                  : isManual
                  ? goal.current_override?.toLocaleString()
                  : '—'}
              </p>
            </div>
            <button
              onClick={() => { setTempVal(String(goal.current_override ?? '')); setEditing(true) }}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium shrink-0"
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
              className="flex-1 min-w-0 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false) }}
            />
            {isManual && (
              <button
                onClick={() => { onUpdateOverride(null); setEditing(false) }}
                className="text-gray-400 hover:text-red-500 text-xs px-2 py-1.5 shrink-0"
              >
                Limpiar
              </button>
            )}
            <button onClick={handleSave} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-blue-700 shrink-0">
              OK
            </button>
            <button onClick={() => setEditing(false)} className="text-gray-400 text-xs px-1 py-1.5 shrink-0">✕</button>
          </div>
        )}
      </div>
    </div>
  )
}
