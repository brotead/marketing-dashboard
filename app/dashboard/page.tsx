'use client'

import { useState, useEffect, useCallback } from 'react'
import { RefreshCw } from 'lucide-react'
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
  const [year, setYear]     = useState(today.getFullYear())
  const [month, setMonth]   = useState(today.getMonth() + 1)
  const [accounts, setAccounts] = useState<AccountData[]>([])
  const [budgets, setBudgets]   = useState<BudgetEntry[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)

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
  const daysPassed  =
    year === today.getFullYear() && month === today.getMonth() + 1
      ? today.getDate()
      : daysInMonth

  // Group budgets by client
  const clients = Array.from(new Set(monthBudgets.map((b) => b.client_name))).sort()

  // Summary totals — only accounts mapped to configured clients
  const configuredMetaIds   = new Set(monthBudgets.filter(b => b.source === 'facebook').map(b => b.account_id))
  const configuredGoogleIds = new Set(monthBudgets.filter(b => b.source === 'google').map(b => b.account_id))
  const totalMetaSpend   = accounts.filter(a => a.source === 'facebook' && configuredMetaIds.has(a.account_id)).reduce((s, a) => s + a.spend, 0)
  const totalGoogleSpend = accounts.filter(a => a.source === 'google'   && configuredGoogleIds.has(a.account_id)).reduce((s, a) => s + a.spend, 0)
  const totalSpend       = totalMetaSpend + totalGoogleSpend

  const totalMetaBudget   = monthBudgets.filter(b => b.source === 'facebook'   && !b.paused).reduce((s, b) => s + b.budget_total, 0)
  const totalGoogleBudget = monthBudgets.filter(b => b.source === 'google' && !b.paused).reduce((s, b) => s + b.budget_total, 0)
  const totalBudget       = totalMetaBudget + totalGoogleBudget

  // Active client count: clients that have any Meta or Google spend this period
  const activeCount = clients.filter((client) => {
    const clientBudgets = monthBudgets.filter(b => b.client_name === client)
    const metaAccountId   = clientBudgets.find(b => b.source === 'facebook')?.account_id
    const googleAccountId = clientBudgets.find(b => b.source === 'google')?.account_id
    const metaSpend   = accounts.find(a => a.account_id === metaAccountId)?.spend ?? 0
    const googleSpend = accounts.find(a => a.account_id === googleAccountId)?.spend ?? 0
    return metaSpend + googleSpend > 0
  }).length

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard General</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Meta Ads + Google Ads · {MONTHS[month - 1]} {year} · Día {daysPassed} de {daysInMonth}
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
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 mb-4 text-sm">{error}</div>
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
            <div className="flex gap-2 mt-0.5">
              <span className="text-[10px] text-gray-400">
                <span className="text-[#1877F2] font-medium">M</span> {currency(totalMetaBudget)}
              </span>
              <span className="text-[10px] text-gray-400">
                <span className="text-[#4285F4] font-medium">G</span> {currency(totalGoogleBudget)}
              </span>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
            <p className="text-xs text-gray-400 mb-0.5">Restante</p>
            <p className={`text-lg font-bold ${totalBudget - totalSpend < 0 ? 'text-red-600' : 'text-gray-900'}`}>
              {totalBudget > 0 ? currency(totalBudget - totalSpend) : '—'}
            </p>
            <p className="text-xs text-gray-400">{clients.length} clientes</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
            <p className="text-xs text-gray-400 mb-1">Clientes activos</p>
            <p className="text-lg font-bold text-gray-900">{activeCount}</p>
            <p className="text-xs text-gray-400">de {clients.length} configurados</p>
          </div>
        </div>
      )}

      {/* Skeleton */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3,4,5,6].map((i) => (
            <div key={i} className="h-52 bg-white rounded-xl border border-gray-100 animate-pulse" />
          ))}
        </div>
      )}

      {/* Client cards */}
      {!loading && clients.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {clients.map((client) => {
            const clientBudgets = monthBudgets.filter((b) => b.client_name === client)
            const metaAccountId   = clientBudgets.find(b => b.source === 'facebook')?.account_id
            const googleAccountId = clientBudgets.find(b => b.source === 'google')?.account_id
            const metaAccount   = accounts.find(a => a.account_id === metaAccountId && a.source === 'facebook')
            const googleAccount = accounts.find(a => a.account_id === googleAccountId && a.source === 'google')
            return (
              <DashboardCard
                key={client}
                clientName={client}
                metaAccount={metaAccount}
                googleAccount={googleAccount}
                budgets={clientBudgets}
                daysPassed={daysPassed}
                daysInMonth={daysInMonth}
              />
            )
          })}
        </div>
      )}

      {!loading && clients.length === 0 && (
        <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
          No hay clientes configurados para este período
        </div>
      )}
    </div>
  )
}
