'use client'

import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, Plus } from 'lucide-react'
import CampaignRow from '@/components/CampaignRow'
import CampaignFormModal from '@/components/CampaignFormModal'
import type { AccountData, BudgetEntry } from '@/lib/types'
import { calcCashflow } from '@/lib/calculations'

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

function currency(n: number) {
  return n.toLocaleString('es-AR', {
    style: 'currency', currency: 'ARS', maximumFractionDigits: 0,
  })
}

// Proportional spend for a campaign based on its account's real spend
function campaignSpend(
  budget: BudgetEntry,
  monthBudgets: BudgetEntry[],
  accounts: AccountData[]
): number {
  const account = accounts.find((a) => a.account_id === budget.account_id)
  if (!account) return 0
  const accountBudgets = monthBudgets.filter((b) => b.account_id === budget.account_id)
  const accountTotalBudget = accountBudgets.reduce((s, b) => s + b.budget_total, 0)
  if (accountTotalBudget === 0) return 0
  return (budget.budget_total / accountTotalBudget) * account.spend
}

interface ModalState {
  entry: BudgetEntry | null
  clientName: string
  accountId: string
}

export default function CashflowPage() {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [accounts, setAccounts] = useState<AccountData[]>([])
  const [budgets, setBudgets] = useState<BudgetEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedClient, setSelectedClient] = useState<string | null>(null)
  const [modal, setModal] = useState<ModalState | null>(null)

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
      const accs: AccountData[] = windsorJson.data ?? []
      const bs: BudgetEntry[] = await budgetRes.json()
      setAccounts(accs)
      setBudgets(bs)
      // Auto-select first client on first load
      const clients = getClients(bs.filter((b) => b.year === year && b.month === month))
      setSelectedClient((prev) => prev ?? clients[0] ?? null)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [year, month])

  useEffect(() => { fetchData() }, [fetchData])

  function getClients(mb: BudgetEntry[]): string[] {
    return Array.from(new Set(mb.map((b) => b.client_name))).sort()
  }

  const monthBudgets = budgets.filter((b) => b.year === year && b.month === month)
  const clients = getClients(monthBudgets)
  const clientBudgets = monthBudgets.filter((b) => b.client_name === selectedClient)

  const daysInMonth = new Date(year, month, 0).getDate()
  const daysPassed =
    year === today.getFullYear() && month === today.getMonth() + 1
      ? today.getDate()
      : daysInMonth
  const pctExpected = ((daysPassed / daysInMonth) * 100)

  // Client-level summary
  const clientSummary = clientBudgets.reduce(
    (acc, b) => {
      const spend = campaignSpend(b, monthBudgets, accounts)
      const cf = calcCashflow(b.budget_total, spend, year, month)
      acc.budget += cf.budgetTotal
      acc.spend += cf.spendToDate
      acc.daily += Math.max(cf.dailyRecommended, 0)
      return acc
    },
    { budget: 0, spend: 0, daily: 0 }
  )

  // Status dot color per client in sidebar
  function clientDotColor(clientName: string): string {
    const cb = monthBudgets.filter((b) => b.client_name === clientName)
    if (cb.length === 0) return 'bg-gray-300'
    const totalBudget = cb.reduce((s, b) => s + b.budget_total, 0)
    const totalSpend = cb.reduce((s, b) => s + campaignSpend(b, monthBudgets, accounts), 0)
    const pct = totalBudget > 0 ? (totalSpend / totalBudget) * 100 : 0
    if (Math.abs(pct - pctExpected) <= 5) return 'bg-green-500'
    if (pct > pctExpected + 5) return 'bg-red-500'
    return 'bg-amber-400'
  }

  const handleSave = async (entry: BudgetEntry) => {
    await fetch('/api/budgets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    })
    setBudgets((prev) => {
      const idx = prev.findIndex(
        (b) => b.campaign_id === entry.campaign_id && b.year === entry.year && b.month === entry.month
      )
      if (idx >= 0) { const next = [...prev]; next[idx] = entry; return next }
      return [...prev, entry]
    })
    setModal(null)
  }

  const handleDelete = async (campaignId: string) => {
    await fetch('/api/budgets', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaign_id: campaignId, year, month }),
    })
    setBudgets((prev) =>
      prev.filter((b) => !(b.campaign_id === campaignId && b.year === year && b.month === month))
    )
  }

  // For add modal: get account_id from existing campaigns of the client
  function getClientAccountId(clientName: string): string {
    return monthBudgets.find((b) => b.client_name === clientName)?.account_id ?? ''
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Control de Cashflow</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Día {daysPassed} de {daysInMonth} · Consumo ideal: {pctExpected.toFixed(0)}% · {MONTHS[month - 1]} {year}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
            value={month}
            onChange={(e) => { setMonth(Number(e.target.value)); setSelectedClient(null) }}
          >
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
            value={year}
            onChange={(e) => { setYear(Number(e.target.value)); setSelectedClient(null) }}
          >
            {[2025, 2026, 2027].map((y) => <option key={y}>{y}</option>)}
          </select>
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 transition disabled:opacity-60"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Sincronizar
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 mb-4 text-sm">
          {error}
        </div>
      )}

      <div className="flex gap-5">
        {/* Sidebar */}
        <div className="w-44 shrink-0">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">
            Clientes · {clients.length}
          </p>

          {loading ? (
            <div className="space-y-1.5">
              {[1,2,3,4,5].map((i) => (
                <div key={i} className="h-9 bg-gray-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-0.5">
              {clients.map((client) => {
                const isSelected = selectedClient === client
                return (
                  <button
                    key={client}
                    onClick={() => setSelectedClient(client)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-left transition ${
                      isSelected
                        ? 'bg-blue-600 text-white font-semibold'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full shrink-0 ${
                      isSelected ? 'bg-white/60' : clientDotColor(client)
                    }`} />
                    <span className="truncate">{client}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Main panel */}
        <div className="flex-1 min-w-0">

          {loading && (
            <div className="space-y-3">
              {[1,2,3].map((i) => (
                <div key={i} className="h-20 bg-white rounded-xl border border-gray-100 animate-pulse" />
              ))}
            </div>
          )}

          {!loading && selectedClient && (
            <>
              {/* Client summary */}
              {clientBudgets.length > 0 && (
                <div className="grid grid-cols-3 gap-3 mb-5">
                  <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
                    <p className="text-xs text-gray-400 mb-0.5">Presupuesto total</p>
                    <p className="text-base font-bold text-gray-900">{currency(clientSummary.budget)}</p>
                  </div>
                  <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
                    <p className="text-xs text-gray-400 mb-0.5">Gasto acumulado</p>
                    <p className="text-base font-bold text-gray-900">{currency(clientSummary.spend)}</p>
                    {clientSummary.budget > 0 && (
                      <p className="text-xs text-gray-400">
                        {((clientSummary.spend / clientSummary.budget) * 100).toFixed(1)}% del total
                      </p>
                    )}
                  </div>
                  <div className="bg-blue-50 rounded-xl border border-blue-100 px-4 py-3">
                    <p className="text-xs text-blue-500 mb-0.5">Diario recomendado</p>
                    <p className="text-base font-bold text-blue-700">
                      {currency(clientSummary.daily)}<span className="text-xs font-normal text-blue-400">/día</span>
                    </p>
                    <p className="text-xs text-blue-400">{daysInMonth - daysPassed}d restantes</p>
                  </div>
                </div>
              )}

              {/* Section header */}
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#1877F2] text-white">
                    Meta Ads
                  </span>
                  <span className="text-xs text-gray-400">
                    {clientBudgets.length} campaña{clientBudgets.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <button
                  onClick={() => setModal({
                    entry: null,
                    clientName: selectedClient,
                    accountId: getClientAccountId(selectedClient),
                  })}
                  className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition"
                >
                  <Plus size={12} />
                  Agregar campaña
                </button>
              </div>

              {/* Campaign rows */}
              <div className="space-y-2 mb-3">
                {clientBudgets.map((b) => {
                  const spend = campaignSpend(b, monthBudgets, accounts)
                  const cf = calcCashflow(b.budget_total, spend, year, month)
                  return (
                    <CampaignRow
                      key={b.campaign_id}
                      budget={b}
                      cashflow={cf}
                      onEdit={() => setModal({ entry: b, clientName: b.client_name, accountId: b.account_id })}
                      onDelete={() => handleDelete(b.campaign_id)}
                    />
                  )
                })}
              </div>

              {/* Totals footer */}
              {clientBudgets.length >= 2 && (
                <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 grid grid-cols-4 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">Total presupuesto</p>
                    <p className="font-bold text-gray-800">{currency(clientSummary.budget)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">Total gastado</p>
                    <p className="font-bold text-gray-800">{currency(clientSummary.spend)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">Restante</p>
                    <p className={`font-bold ${clientSummary.budget - clientSummary.spend < 0 ? 'text-red-600' : 'text-gray-800'}`}>
                      {currency(clientSummary.budget - clientSummary.spend)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">Diario total</p>
                    <p className="font-bold text-gray-800">{currency(clientSummary.daily)}/día</p>
                  </div>
                </div>
              )}

              {clientBudgets.length === 0 && (
                <div className="flex flex-col items-center justify-center h-40 text-gray-400 text-sm border border-dashed border-gray-200 rounded-xl">
                  <p>Sin campañas configuradas</p>
                  <button
                    onClick={() => setModal({
                      entry: null,
                      clientName: selectedClient,
                      accountId: getClientAccountId(selectedClient),
                    })}
                    className="mt-2 text-blue-500 hover:text-blue-600 font-medium text-xs"
                  >
                    Agregar primera campaña
                  </button>
                </div>
              )}
            </>
          )}

          {!loading && !selectedClient && (
            <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
              Seleccioná un cliente del panel izquierdo
            </div>
          )}
        </div>
      </div>

      {modal && (
        <CampaignFormModal
          entry={modal.entry}
          clientName={modal.clientName}
          accountId={modal.accountId}
          source="facebook"
          year={year}
          month={month}
          existingIds={budgets.map((b) => b.campaign_id)}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
