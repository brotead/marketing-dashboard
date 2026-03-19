'use client'

import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, CheckCircle, AlertTriangle, XCircle } from 'lucide-react'
import DashboardCard from '@/components/DashboardCard'
import type { AccountData, BudgetEntry } from '@/lib/types'

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

function currency(n: number) {
  return n.toLocaleString('es-AR', {
    style: 'currency', currency: 'ARS', maximumFractionDigits: 0,
  })
}

export default function DashboardPage() {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [accounts, setAccounts] = useState<AccountData[]>([])
  const [budgets, setBudgets] = useState<BudgetEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [windsorRes, budgetRes] = await Promise.all([
        fetch(`/api/windsor?year=${year}&month=${month}`),
        fetch('/api/budgets'),
      ])
      if (!windsorRes.ok) throw new Error('Error al conectar con Windsor')
      const windsorJson = await windsorRes.json()
      setAccounts(windsorJson.data ?? [])
      setBudgets(await budgetRes.json())
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [year, month])

  useEffect(() => { fetchData() }, [fetchData])

  const monthBudgets = budgets.filter((b) => b.year === year && b.month === month)

  const daysInMonth = new Date(year, month, 0).getDate()
  const daysPassed =
    year === today.getFullYear() && month === today.getMonth() + 1
      ? today.getDate()
      : daysInMonth

  // Aggregate totals
  const totalSpend = accounts.reduce((s, a) => s + a.spend, 0)
  const totalBudget = monthBudgets.reduce((s, b) => s + b.budget_total, 0)
  const activeAccounts = accounts.filter((a) => a.recent_spend > 0).length
  const pausedAccounts = accounts.filter((a) => a.spend > 0 && a.recent_spend === 0).length
  const inactiveAccounts = accounts.filter((a) => a.spend === 0).length

  // Separate configured vs unconfigured
  const configuredAccounts = accounts.filter(
    (a) => monthBudgets.some((b) => b.account_id === a.account_id)
  )

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard General</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Paneo de todas las cuentas Meta · {MONTHS[month - 1]} {year}
          </p>
        </div>
        <div className="flex items-center gap-2">
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
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 transition disabled:opacity-60"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Actualizar
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 mb-4 text-sm">
          {error}
        </div>
      )}

      {/* Summary strip */}
      {!loading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
            <p className="text-xs text-gray-400 mb-0.5">Gasto total</p>
            <p className="text-lg font-bold text-gray-900">{currency(totalSpend)}</p>
            {totalBudget > 0 && (
              <p className="text-xs text-gray-400">{((totalSpend / totalBudget) * 100).toFixed(1)}% del presupuesto</p>
            )}
          </div>
          <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
            <p className="text-xs text-gray-400 mb-0.5">Presupuesto total</p>
            <p className="text-lg font-bold text-gray-900">{totalBudget > 0 ? currency(totalBudget) : '—'}</p>
            {totalBudget > 0 && (
              <p className="text-xs text-gray-400">{currency(totalBudget - totalSpend)} restante</p>
            )}
          </div>
          <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
            <p className="text-xs text-gray-400 mb-1">Estado de cuentas</p>
            <div className="flex items-center gap-2 flex-wrap">
              {activeAccounts > 0 && (
                <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                  <CheckCircle size={11} /> {activeAccounts} activas
                </span>
              )}
              {pausedAccounts > 0 && (
                <span className="flex items-center gap-1 text-xs text-amber-600 font-medium">
                  <AlertTriangle size={11} /> {pausedAccounts} pausadas
                </span>
              )}
              {inactiveAccounts > 0 && (
                <span className="flex items-center gap-1 text-xs text-red-600 font-medium">
                  <XCircle size={11} /> {inactiveAccounts} sin gasto
                </span>
              )}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
            <p className="text-xs text-gray-400 mb-0.5">Cuentas activas</p>
            <p className="text-lg font-bold text-gray-900">{configuredAccounts.length}</p>
          </div>
        </div>
      )}

      {/* Skeleton */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3,4,5,6].map((i) => (
            <div key={i} className="h-44 bg-white rounded-xl border border-gray-100 animate-pulse" />
          ))}
        </div>
      )}

      {/* Configured accounts */}
      {!loading && configuredAccounts.length > 0 && (
        <div className="mb-6">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Cuentas configuradas · {configuredAccounts.length}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {configuredAccounts.map((account) => (
              <DashboardCard
                key={account.account_id}
                account={account}
                budgets={monthBudgets.filter((b) => b.account_id === account.account_id)}
                year={year}
                month={month}
                daysPassed={daysPassed}
                daysInMonth={daysInMonth}
              />
            ))}
          </div>
        </div>
      )}

      {/* Unconfigured accounts */}
      {!loading && configuredAccounts.length === 0 && (
        <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
          No hay cuentas Meta disponibles en Windsor para este período
        </div>
      )}
    </div>
  )
}
