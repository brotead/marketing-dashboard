'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import type { CampaignData, BudgetEntry } from '@/lib/types'

interface Props {
  campaign: CampaignData
  existing: BudgetEntry | null
  year: number
  month: number
  onSave: (entry: BudgetEntry) => void
  onClose: () => void
}

const MONTHS = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
]

export default function BudgetModal({ campaign, existing, year, month, onSave, onClose }: Props) {
  const [clientName, setClientName] = useState(existing?.client_name ?? '')
  const [campaignName, setCampaignName] = useState(
    existing?.campaign_name ?? campaign.campaign_name ?? ''
  )
  const [budgetTotal, setBudgetTotal] = useState(String(existing?.budget_total ?? ''))
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!clientName.trim() || !budgetTotal) return
    setSaving(true)
    await onSave({
      campaign_id: campaign.campaign_id,
      campaign_name: campaignName.trim() || campaign.campaign_name || campaign.campaign_id,
      client_name: clientName.trim().toUpperCase(),
      source: campaign.source,
      account_id: existing?.account_id ?? '',
      year,
      month,
      budget_total: Number(budgetTotal),
    })
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">Configurar presupuesto</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          {/* Campaign info */}
          <div className="bg-gray-50 rounded-xl p-3.5">
            <p className="text-xs text-gray-400 mb-0.5">
              {campaign.source === 'google' ? 'Google Ads' : 'Meta Ads'} · ID: {campaign.campaign_id}
            </p>
            <p className="font-medium text-gray-800 text-sm">
              {campaign.campaign_name ?? 'Sin nombre en Windsor'}
            </p>
          </div>

          {/* Client name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Cliente <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Ej: AMIPACK, HSF, MAFRALAC..."
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* Campaign name (only if null from Windsor) */}
          {!campaign.campaign_name && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Nombre de campaña
              </label>
              <input
                type="text"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                placeholder="Nombre descriptivo para esta campaña"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-amber-600 mt-1">
                Esta campaña de Meta no tiene nombre en Windsor. Podés ingresarlo manualmente.
              </p>
            </div>
          )}

          {/* Budget */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Presupuesto mensual — {MONTHS[month - 1]} {year}{' '}
              <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">
                $
              </span>
              <input
                type="number"
                value={budgetTotal}
                onChange={(e) => setBudgetTotal(e.target.value)}
                placeholder="0"
                className="w-full border border-gray-200 rounded-xl pl-8 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
                min="0"
                step="any"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-blue-600 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50"
            >
              {saving ? 'Guardando...' : 'Guardar presupuesto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
