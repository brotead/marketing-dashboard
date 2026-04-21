'use client'

import { useState } from 'react'
import { X } from 'lucide-react'

interface Props {
  onSave: (clientName: string) => void
  onClose: () => void
}

export default function ClientFormModal({ onSave, onClose }: Props) {
  const [clientName, setClientName] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!clientName.trim()) return
    onSave(clientName.trim())
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#2a2a2a] rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-[#2a2a2a]">
          <h2 className="font-bold text-gray-900 dark:text-gray-100">Agregar cliente</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-[#252525] transition">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Nombre del cliente
            </label>
            <input
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Ej: DURAPLAS"
              className="w-full bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#333] rounded-xl px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              required
              autoFocus
            />
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">
              El sistema buscará automáticamente las cuentas y campañas en Meta y Google.
            </p>
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 border border-gray-200 dark:border-[#333] rounded-xl py-2.5 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-[#252525] transition">
              Cancelar
            </button>
            <button type="submit"
              className="flex-1 bg-blue-600 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-blue-700 transition">
              Agregar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
