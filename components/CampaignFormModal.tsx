'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import type { BudgetEntry } from '@/lib/types'

interface Props {
  entry: BudgetEntry | null  // null = adding new campaign
  clientName: string
  accountId: string
  source: string
  year: number
  month: number
  existingIds: string[]
  onSave: (entry: BudgetEntry) => void
  onClose: () => void
}

const MONTHS = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
]

function generateId(clientName: string, existingIds: string[]): string {
  const prefix = clientName.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 4)
  let n = 1
  while (existingIds.includes(`${prefix}_${n}`)) n++
  return `${prefix}_${n}`
}

export default function CampaignFormModal({
  entry, clientName, accountId, source, year, month, existingIds, onSave, onClose,
}: Props) {
  const [campaignName, setCampaignName] = useState(entry?.campaign_name ?? '')
  const [budgetTotal, setBudgetTotal] = useState(String(entry?.budget_total ?? ''))
  const [saving, setSaving] = useState(false)

  const isNew = entry === null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!campaignName.trim() || !budgetTotal) return
    setSaving(true)
    const newEntry: BudgetEntry = {
      campaign_id: entry?.campaign_id ?? generateId(clientName, existingIds),
      campaign_name: campaignName.trim(),
      client_name: clientName,
      source,
      account_id: accountId,
      year,
      month,
      budget_total: Number(budgetTotal),
    }
    await onSave(newEntry)
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a2a]">
          <h2 className="font-bold text-gray-100">
            {isNew ? 'Agregar campaña' : 'Editar campaña'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300 p-1 rounded-lg hover:bg-[#252525] transition"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          {/* Context */}
          <div className="bg-[#252525] rounded-xl p-3.5">
            <p className="text-xs text-gray-400 mb-0.5">Cliente · {source === 'facebook' ? 'Meta Ads' : 'Google Ads'}</p>
            <p className="font-medium text-gray-200 text-sm">{clientName}</p>
          </div>

          {/* Campaign name */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Nombre de campaña <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              placeholder="Ej: BB | AO | Interacción | Rotomoldeo"
              className="w-full bg-[#1a1a1a] border border-[#333] rounded-xl px-4 py-2.5 text-sm text-gray-100 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              required
              autoFocus
            />
          </div>

          {/* Budget */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Presupuesto — {MONTHS[month - 1]} {year}{' '}
              <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-medium">
                $
              </span>
              <input
                type="number"
                value={budgetTotal}
                onChange={(e) => setBudgetTotal(e.target.value)}
                placeholder="0"
                className="w-full bg-[#1a1a1a] border border-[#333] rounded-xl pl-8 pr-4 py-2.5 text-sm text-gray-100 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                required
                min="0"
              />
            </div>
          </div>

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
              {saving ? 'Guardando...' : isNew ? 'Agregar campaña' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
