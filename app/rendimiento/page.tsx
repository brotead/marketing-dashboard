'use client'

import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, Plus } from 'lucide-react'
import PacingCard from '@/components/PacingCard'
import GoalModal from '@/components/GoalModal'
import type { CampaignData, GoalEntry, BudgetEntry } from '@/lib/types'
import { calcPacing } from '@/lib/calculations'

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

export default function RendimientoPage() {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [goals, setGoals] = useState<GoalEntry[]>([])
  const [windsorData, setWindsorData] = useState<CampaignData[]>([])
  const [budgets, setBudgets] = useState<BudgetEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [editingGoal, setEditingGoal] = useState<GoalEntry | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [windsorRes, goalsRes, budgetsRes] = await Promise.all([
        fetch(`/api/windsor?year=${year}&month=${month}`),
        fetch('/api/goals'),
        fetch('/api/budgets'),
      ])
      const windsorJson = await windsorRes.json()
      setWindsorData(windsorJson.data ?? [])
      setGoals(await goalsRes.json())
      setBudgets(await budgetsRes.json())
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [year, month])

  useEffect(() => { fetchData() }, [fetchData])

  // Google conversions grouped by client (via budget mappings)
  const getGoogleConversions = (clientName: string) => {
    const clientCampaignIds = budgets
      .filter((b) => b.client_name === clientName && b.year === year && b.month === month)
      .map((b) => b.campaign_id)
    return windsorData
      .filter((c) => clientCampaignIds.includes(c.campaign_id) && c.source === 'google')
      .reduce((sum, c) => sum + c.conversions, 0)
  }

  const currentGoals = goals.filter((g) => g.year === year && g.month === month)

  // All known clients from goals + budgets
  const allClients = Array.from(new Set([
    ...currentGoals.map((g) => g.client_name),
    ...budgets
      .filter((b) => b.year === year && b.month === month)
      .map((b) => b.client_name),
  ])).sort()

  const handleSaveGoal = async (entry: GoalEntry) => {
    await fetch('/api/goals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    })
    setGoals((prev) => {
      const idx = prev.findIndex(
        (g) =>
          g.client_name === entry.client_name &&
          g.year === entry.year &&
          g.month === entry.month &&
          g.kpi === entry.kpi
      )
      if (idx >= 0) { const next = [...prev]; next[idx] = entry; return next }
      return [...prev, entry]
    })
    setShowModal(false)
    setEditingGoal(null)
  }

  const handleDeleteGoal = async (goal: GoalEntry) => {
    await fetch('/api/goals', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_name: goal.client_name, year, month, kpi: goal.kpi }),
    })
    setGoals((prev) =>
      prev.filter(
        (g) =>
          !(
            g.client_name === goal.client_name &&
            g.year === goal.year &&
            g.month === goal.month &&
            g.kpi === goal.kpi
          )
      )
    )
  }

  // Summary counts
  const statusCounts = currentGoals.reduce(
    (acc, g) => {
      const current =
        g.current_override != null
          ? g.current_override
          : g.kpi === 'conversiones'
          ? getGoogleConversions(g.client_name)
          : 0
      const s = calcPacing(g.goal_value, current, year, month).status
      acc[s] = (acc[s] ?? 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  const daysInMonth = new Date(year, month, 0).getDate()
  const daysPassed =
    year === today.getFullYear() && month === today.getMonth() + 1
      ? today.getDate()
      : daysInMonth

  const priorityOrder: Record<string, number> = { behind: 0, warning: 1, on_track: 2 }

  const sortedGoals = [...currentGoals].sort((a, b) => {
    const getCurrent = (g: GoalEntry) =>
      g.current_override != null
        ? g.current_override
        : g.kpi === 'conversiones'
        ? getGoogleConversions(g.client_name)
        : 0
    const aStatus = calcPacing(a.goal_value, getCurrent(a), year, month).status
    const bStatus = calcPacing(b.goal_value, getCurrent(b), year, month).status
    return (priorityOrder[aStatus] ?? 3) - (priorityOrder[bStatus] ?? 3)
  })

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Seguimiento de Objetivos</h1>
          <p className="text-gray-500 text-sm mt-1">
            Día {daysPassed} de {daysInMonth} · {MONTHS[month - 1]} {year}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
          >
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          >
            {[2025, 2026, 2027].map((y) => <option key={y}>{y}</option>)}
          </select>
          <button
            onClick={() => { setEditingGoal(null); setShowModal(true) }}
            className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-800 transition"
          >
            <Plus size={14} /> Agregar objetivo
          </button>
          <button
            onClick={fetchData}
            className="flex items-center gap-2 bg-blue-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-blue-700 transition"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Windsor Meta warning */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6 text-sm text-amber-800">
        <strong>⚠ Aviso Windsor:</strong> Los campos <em>conversaciones iniciadas</em> y{' '}
        <em>seguimientos de Instagram</em> no están disponibles vía API con la configuración actual.
        Las conversiones de Google Ads se calculan automáticamente. Para Meta Ads (Mensajes / Seguidores),
        ingresá el valor manualmente desde cada tarjeta.
      </div>

      {/* Summary */}
      {!loading && currentGoals.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Total clientes</p>
            <p className="text-2xl font-bold text-gray-900">{currentGoals.length}</p>
          </div>
          <div className="bg-green-50 rounded-2xl p-5 border border-green-100">
            <p className="text-xs text-green-700 uppercase tracking-wide mb-1">En objetivo</p>
            <p className="text-2xl font-bold text-green-700">{statusCounts['on_track'] ?? 0}</p>
          </div>
          <div className="bg-red-50 rounded-2xl p-5 border border-red-100">
            <p className="text-xs text-red-700 uppercase tracking-wide mb-1">Por debajo</p>
            <p className="text-2xl font-bold text-red-700">
              {(statusCounts['behind'] ?? 0) + (statusCounts['warning'] ?? 0)}
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl p-4 mb-6 text-sm">
          {error}
        </div>
      )}

      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-2xl h-52 animate-pulse border border-gray-100" />
          ))}
        </div>
      )}

      {!loading && !error && currentGoals.length === 0 && (
        <div className="text-center py-20 text-gray-400">
          <p className="text-lg mb-2">Sin objetivos configurados</p>
          <p className="text-sm">Hacé clic en &ldquo;Agregar objetivo&rdquo; para empezar</p>
        </div>
      )}

      {!loading && !error && sortedGoals.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sortedGoals.map((goal) => {
            const autoValue = getGoogleConversions(goal.client_name)
            const currentValue =
              goal.current_override != null
                ? goal.current_override
                : goal.kpi === 'conversiones'
                ? autoValue
                : 0
            const pacing = calcPacing(goal.goal_value, currentValue, year, month)
            return (
              <PacingCard
                key={`${goal.client_name}-${goal.kpi}`}
                goal={goal}
                pacing={pacing}
                autoValue={autoValue}
                onEdit={() => { setEditingGoal(goal); setShowModal(true) }}
                onDelete={() => handleDeleteGoal(goal)}
                onUpdateOverride={async (val) => {
                  await handleSaveGoal({ ...goal, current_override: val })
                }}
              />
            )
          })}
        </div>
      )}

      {(showModal || editingGoal != null) && (
        <GoalModal
          existing={editingGoal}
          year={year}
          month={month}
          existingClients={allClients}
          onSave={handleSaveGoal}
          onClose={() => { setShowModal(false); setEditingGoal(null) }}
        />
      )}
    </div>
  )
}
