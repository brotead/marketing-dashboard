'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import type { GoalEntry } from '@/lib/types'

interface Props {
  existing: GoalEntry | null
  defaultClient?: string
  year: number
  month: number
  existingClients: string[]
  onSave: (entry: GoalEntry) => void
  onClose: () => void
}

const MONTHS = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
]

const KPI_OPTIONS: { value: GoalEntry['kpi']; label: string; desc: string }[] = [
  { value: 'mensajes',     label: 'Mensajes WA',   desc: 'Conversaciones iniciadas (manual)' },
  { value: 'seguidores',   label: 'Seguidores IG', desc: 'Nuevos seguidores (manual)' },
  { value: 'conversiones', label: 'Conversiones',  desc: 'Google Ads (automático)' },
  { value: 'alcance',      label: 'Alcance',        desc: 'Alcance mensual (manual)' },
  { value: 'formularios',  label: 'Formularios',    desc: 'Formularios completados (manual)' },
  { value: 'compras',      label: 'Compras',        desc: 'Compras / conversiones (manual)' },
]

export default function GoalModal({ existing, defaultClient, year, month, existingClients, onSave, onClose }: Props) {
  const [clientName, setClientName] = useState(existing?.client_name ?? defaultClient ?? '')
  const [kpi, setKpi] = useState<GoalEntry['kpi']>(existing?.kpi ?? 'mensajes')
  const [goalValue, setGoalValue] = useState(String(existing?.goal_value ?? ''))
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!clientName.trim() || !goalValue) return
    setSaving(true)
    await onSave({
      client_name: clientName.trim().toUpperCase(),
      kpi,
      year,
      month,
      goal_value: Number(goalValue),
      current_override: existing?.current_override ?? null,
    })
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a2a]">
          <h2 className="font-bold text-gray-100">
            {existing ? 'Editar objetivo' : 'Nuevo objetivo'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300 p-1 rounded-lg hover:bg-[#252525] transition"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          {/* Client */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Cliente <span className="text-red-500">*</span>
            </label>
            <input
              list="goal-clients"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Nombre del cliente"
              className="w-full bg-[#1a1a1a] border border-[#333] rounded-xl px-4 py-2.5 text-sm text-gray-100 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              required
            />
            <datalist id="goal-clients">
              {existingClients.map((c) => <option key={c} value={c} />)}
            </datalist>
          </div>

          {/* KPI selector */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">KPI</label>
            <div className="flex flex-col gap-2">
              {KPI_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${
                    kpi === opt.value
                      ? 'border-blue-500 bg-blue-600/10'
                      : 'border-[#333] hover:border-[#444]'
                  }`}
                >
                  <input
                    type="radio"
                    name="kpi"
                    value={opt.value}
                    checked={kpi === opt.value}
                    onChange={() => setKpi(opt.value)}
                    className="mt-0.5"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-100">{opt.label}</p>
                    <p className="text-xs text-gray-400">{opt.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Goal value */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Meta mensual — {MONTHS[month - 1]} {year} <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={goalValue}
              onChange={(e) => setGoalValue(e.target.value)}
              placeholder="Ej: 300"
              className="w-full bg-[#1a1a1a] border border-[#333] rounded-xl px-4 py-2.5 text-sm text-gray-100 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              required
              min="1"
            />
          </div>

          {kpi === 'conversiones' && (
            <div className="bg-blue-600/10 border border-blue-500/30 rounded-xl p-3 text-xs text-blue-400">
              Las conversiones se obtienen automáticamente desde Windsor cuando asignás un presupuesto a las campañas de este cliente.
            </div>
          )}

          {kpi !== 'conversiones' && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-xs text-amber-400">
              Este KPI requiere ingreso manual. Podés actualizarlo directamente desde la tarjeta del cliente.
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-[#333] rounded-xl py-2.5 text-sm font-medium text-gray-400 hover:bg-[#252525] transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-blue-600 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50"
            >
              {saving ? 'Guardando...' : 'Guardar objetivo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
