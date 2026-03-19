'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import type { BudgetEntry } from '@/lib/types'

interface Props {
  source: 'facebook' | 'google_ads'
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

export default function ClientFormModal({ source, year, month, existingIds, onSave, onClose }: Props) {
  const [clientName, setClientName] = useState('')
  const [accountId, setAccountId] = useState('')
  const [campaignName, setCampaignName] = useState('')
  const [budgetTotal, setBudgetTotal] = useState('')
  const [saving, setSaving] = useState(false)

  const platformLabel = source === 'facebook' ? 'Meta Ads' : 'Google Ads'
  const platformColor = source === 'facebook' ? 'bg-[#1877F2]' : 'bg-[#4285F4]'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!clientName.trim() || !accountId.trim() || !campaignName.trim() || !budgetTotal) return
    setSaving(true)
    const entry: BudgetEntry = {
      campaign_id: generateId(clientName, existingIds),
      campaign_name: campaignName.trim(),
      client_name: clientName.trim().toUpperCase(),
      source,
      account_id: accountId.trim(),
      year,
      month,
      budget_total: Number(budgetTotal),
    }
    await onSave(entry)
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full text-white ${platformColor}`}>
              {platformLabel}
            </span>
            <h2 className="font-bold text-gray-900">Agregar cliente</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Nombre del cliente <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Ej: DURAPLAS"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Account ID de {platformLabel} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              placeholder={source === 'facebook' ? 'Ej: 6060428597350960' : 'Ej: 959-198-0482'}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              required
            />
            <p className="text-xs text-gray-400 mt-1">Lo encontrás en el administrador de anuncios de {platformLabel}.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Primera campaña <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              placeholder="Ej: Búsqueda | Marca"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Presupuesto mensual — {MONTHS[month - 1]} {year} <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">$</span>
              <input
                type="number"
                value={budgetTotal}
                onChange={(e) => setBudgetTotal(e.target.value)}
                placeholder="0"
                className="w-full border border-gray-200 rounded-xl pl-8 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
                min="0"
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
              {saving ? 'Guardando...' : 'Agregar cliente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
