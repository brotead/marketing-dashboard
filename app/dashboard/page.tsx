'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
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
  const today  = new Date()
  const router = useRouter()
  const [year,     setYear]     = useState(today.getFullYear())
  const [month,    setMonth]    = useState(today.getMonth() + 1)
  const [accounts, setAccounts] = useState<AccountData[]>([])
  const [budgets,  setBudgets]  = useState<BudgetEntry[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)

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

  // Auto-refresh every hour so budget/campaign changes made in Cashflow are reflected here
  useEffect(() => {
    const id = setInterval(() => { fetchData() }, 60 * 60 * 1000)
    return () => clearInterval(id)
  }, [fetchData])

  const monthBudgets = budgets.filter((b) => b.year === year && b.month === month)

  const daysInMonth = new Date(year, month, 0).getDate()
  // Data from Windsor is through yesterday — align pacing to match
  const daysPassed  =
    year === today.getFullYear() && month === today.getMonth() + 1
      ? Math.max(1, today.getDate() - 1)
      : daysInMonth
  const pctExpected = (daysPassed / daysInMonth) * 100

  // All unique clients in this month
  const allClients = Array.from(new Set(monthBudgets.map((b) => b.client_name)))

  // Separate paused (all campaigns paused) from active
  const activeClients = allClients.filter(client => {
    const cb = monthBudgets.filter(b => b.client_name === client)
    return cb.some(b => !b.paused)
  })
  const pausedClients = allClients.filter(client => {
    const cb = monthBudgets.filter(b => b.client_name === client)
    return cb.length > 0 && cb.every(b => b.paused)
  })

  // Helper to compute pacing deviation for a client
  function clientDeviation(client: string): number {
    const cb = monthBudgets.filter(b => b.client_name === client && !b.paused)
    const totalBudget = cb.reduce((s, b) => s + b.budget_total, 0)
    if (totalBudget === 0) return 0

    const metaAccountId   = cb.find(b => b.source === 'facebook')?.account_id
    const googleAccountId = cb.find(b => b.source === 'google')?.account_id
    const metaSpend   = accounts.find(a => a.account_id === metaAccountId && a.source === 'facebook')?.spend ?? 0
    const googleSpend = accounts.find(a => a.account_id === googleAccountId && a.source === 'google')?.spend ?? 0
    const totalSpend  = metaSpend + googleSpend
    const pctConsumed = (totalSpend / totalBudget) * 100
    return pctConsumed - pctExpected
  }

  // Sort active clients: bajo ritmo (most negative deviation) first → en ritmo last
  const sortedActiveClients = [...activeClients].sort((a, b) => clientDeviation(a) - clientDeviation(b))

  // Summary totals — only active (non-paused) accounts
  const configuredMetaIds   = new Set(monthBudgets.filter(b => b.source === 'facebook' && !b.paused).map(b => b.account_id))
  const configuredGoogleIds = new Set(monthBudgets.filter(b => b.source === 'google'   && !b.paused).map(b => b.account_id))
  const totalMetaSpend   = accounts.filter(a => a.source === 'facebook' && configuredMetaIds.has(a.account_id)).reduce((s, a) => s + a.spend, 0)
  const totalGoogleSpend = accounts.filter(a => a.source === 'google'   && configuredGoogleIds.has(a.account_id)).reduce((s, a) => s + a.spend, 0)
  const totalSpend       = totalMetaSpend + totalGoogleSpend

  const totalMetaBudget   = monthBudgets.filter(b => b.source === 'facebook' && !b.paused).reduce((s, b) => s + b.budget_total, 0)
  const totalGoogleBudget = monthBudgets.filter(b => b.source === 'google'   && !b.paused).reduce((s, b) => s + b.budget_total, 0)
  const totalBudget       = totalMetaBudget + totalGoogleBudget

  // Active client count = clients with at least one non-paused campaign with some spend
  const activeCount = activeClients.filter(client => {
    const cb = monthBudgets.filter(b => b.client_name === client && !b.paused)
    const metaAccountId   = cb.find(b => b.source === 'facebook')?.account_id
    const googleAccountId = cb.find(b => b.source === 'google')?.account_id
    const metaSpend   = accounts.find(a => a.account_id === metaAccountId)?.spend ?? 0
    const googleSpend = accounts.find(a => a.account_id === googleAccountId)?.spend ?? 0
    return metaSpend + googleSpend > 0
  }).length

  function handleClientClick(client: string) {
    const cb = monthBudgets.filter(b => b.client_name === client && !b.paused)
    const source = cb.find(b => b.source === 'facebook') ? 'facebook' : 'google'
    router.push(`/cashflow?client=${encodeURIComponent(client)}&source=${source}`)
  }

  function renderCard(client: string) {
    const clientBudgets   = monthBudgets.filter(b => b.client_name === client)
    const metaAccountId   = clientBudgets.find(b => b.source === 'facebook')?.account_id
    const googleAccountId = clientBudgets.find(b => b.source === 'google')?.account_id
    const metaAccount     = accounts.find(a => a.account_id === metaAccountId && a.source === 'facebook')
    const googleAccount   = accounts.find(a => a.account_id === googleAccountId && a.source === 'google')
    return (
      <DashboardCard
        key={client}
        clientName={client}
        metaAccount={metaAccount}
        googleAccount={googleAccount}
        budgets={clientBudgets}
        daysPassed={daysPassed}
        daysInMonth={daysInMonth}
        onClick={() => handleClientClick(client)}
      />
    )
  }

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
            <p className="text-xs text-gray-400">{activeClients.length} clientes activos</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
            <p className="text-xs text-gray-400 mb-1">Clientes activos</p>
            <p className="text-lg font-bold text-gray-900">{activeCount}</p>
            <p className="text-xs text-gray-400">de {activeClients.length} configurados</p>
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

      {/* Active client cards — sorted by pacing (bajo ritmo first) */}
      {!loading && sortedActiveClients.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedActiveClients.map(renderCard)}
        </div>
      )}

      {/* Paused clients separator + cards */}
      {!loading && pausedClients.length > 0 && (
        <>
          <div className="flex items-center gap-3 mt-8 mb-4">
            <div className="flex-1 border-t border-gray-200" />
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1">
              Clientes pausados
            </span>
            <div className="flex-1 border-t border-gray-200" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 opacity-60">
            {pausedClients.map(renderCard)}
          </div>
        </>
      )}

      {!loading && allClients.length === 0 && (
        <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
          No hay clientes configurados para este período
        </div>
      )}
    </div>
  )
}
