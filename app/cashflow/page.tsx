'use client'

import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, Plus, Pencil, AlertTriangle, UserPlus } from 'lucide-react'
import CampaignRow from '@/components/CampaignRow'
import CampaignFormModal from '@/components/CampaignFormModal'
import ClientFormModal from '@/components/ClientFormModal'
import type { AccountData, BudgetEntry, CampaignSpend } from '@/lib/types'
import { calcCashflow } from '@/lib/calculations'

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

type Source = 'facebook' | 'google'

interface Selection {
  client: string
  source: Source
}

interface ModalState {
  entry: BudgetEntry | null
  clientName: string
  accountId: string
  source: Source
}

function currency(n: number) {
  return n.toLocaleString('es-AR', {
    style: 'currency', currency: 'ARS', maximumFractionDigits: 0,
  })
}

// Normalize campaign name for fuzzy matching (remove accents, lowercase, unify separators)
function normName(s: string): string {
  return s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[|\-_]+/g, ' ')
    .replace(/\s+/g, ' ').trim()
}

function tryMatchAll(
  accountBudgets: BudgetEntry[],
  windsorEntries: CampaignSpend[],
  useAdset: boolean
): Map<string, number> | null {
  const matchMap = new Map<string, number>()
  for (const ab of accountBudgets) {
    const abNorm = normName(ab.campaign_name)
    const match = windsorEntries.find((wc) => {
      const wcName = useAdset
        ? (wc.adset_name ? normName(wc.adset_name) : normName(wc.campaign_name))
        : normName(wc.campaign_name)
      return wcName === abNorm || wcName.includes(abNorm) || abNorm.includes(wcName)
    })
    if (!match) return null
    matchMap.set(ab.campaign_id, match.spend)
  }
  return matchMap
}

function campaignSpend(
  budget: BudgetEntry,
  monthBudgets: BudgetEntry[],
  accounts: AccountData[],
  windsorCampaigns: CampaignSpend[],
  windsorAdsets: CampaignSpend[]
): number {
  // Manual override has priority
  if (budget.spend_override != null) return budget.spend_override

  const accountBudgets = monthBudgets.filter(
    (b) => b.account_id === budget.account_id && b.source === budget.source && !b.paused
  )
  const accCampaigns = windsorCampaigns.filter(
    (c) => c.account_id === budget.account_id && c.source === budget.source
  )
  const accAdsets = windsorAdsets.filter(
    (c) => c.account_id === budget.account_id && c.source === budget.source
  )

  // 1. Try campaign-level matching first
  if (accCampaigns.length > 0) {
    const m = tryMatchAll(accountBudgets, accCampaigns, false)
    if (m) return m.get(budget.campaign_id) ?? 0
  }

  // 2. Try adset-level matching (for clients where Supabase campaigns = Meta ad sets)
  if (accAdsets.length > 0) {
    const m = tryMatchAll(accountBudgets, accAdsets, true)
    if (m) return m.get(budget.campaign_id) ?? 0
  }

  // 3. Fall back to proportional distribution from account total
  const account = accounts.find((a) => a.account_id === budget.account_id && a.source === budget.source)
  if (!account) return 0
  const activeBudgets = monthBudgets.filter((b) => b.account_id === budget.account_id && b.source === budget.source && !b.paused)
  const accountTotalBudget = activeBudgets.reduce((s, b) => s + b.budget_total, 0)
  if (accountTotalBudget === 0) return activeBudgets.length > 0 ? account.spend / activeBudgets.length : 0
  return (budget.budget_total / accountTotalBudget) * account.spend
}

export default function CashflowPage() {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [accounts, setAccounts] = useState<AccountData[]>([])
  const [windsorCampaigns, setWindsorCampaigns] = useState<CampaignSpend[]>([])
  const [windsorAdsets, setWindsorAdsets] = useState<CampaignSpend[]>([])
  const [budgets, setBudgets] = useState<BudgetEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Selection | null>(null)
  const [modal, setModal] = useState<ModalState | null>(null)
  const [clientModal, setClientModal] = useState<Source | null>(null)
  const [editingTotal, setEditingTotal] = useState(false)
  const [totalInput, setTotalInput] = useState('')

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
      setWindsorCampaigns(windsorJson.campaigns ?? [])
      setWindsorAdsets(windsorJson.adsets ?? [])
      setBudgets(bs)
      if (!selected) {
        const mb = bs.filter((b) => b.year === year && b.month === month)
        const firstMeta = Array.from(new Set(mb.filter(b => b.source === 'facebook').map(b => b.client_name))).sort()[0]
        if (firstMeta) setSelected({ client: firstMeta, source: 'facebook' })
      }
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
  const pctExpected = (daysPassed / daysInMonth) * 100

  function getClients(source: Source): string[] {
    return Array.from(new Set(
      monthBudgets.filter((b) => b.source === source).map((b) => b.client_name)
    )).sort()
  }

  function clientDotColor(clientName: string, source: Source): string {
    const cb = monthBudgets.filter((b) => b.client_name === clientName && b.source === source && !b.paused)
    if (cb.length === 0) return 'bg-gray-300'
    const totalBudget = cb.reduce((s, b) => s + b.budget_total, 0)
    const totalSpend = cb.reduce((s, b) => s + campaignSpend(b, monthBudgets, accounts, windsorCampaigns, windsorAdsets), 0)
    const pct = totalBudget > 0 ? (totalSpend / totalBudget) * 100 : 0
    if (Math.abs(pct - pctExpected) <= 5) return 'bg-green-500'
    if (pct > pctExpected + 5) return 'bg-red-500'
    return 'bg-amber-400'
  }

  // Selected client's campaigns
  const clientBudgets = selected
    ? monthBudgets.filter((b) => b.client_name === selected.client && b.source === selected.source)
    : []
  const activeBudgets = clientBudgets.filter((b) => !b.paused)
  const pausedBudgets = clientBudgets.filter((b) => b.paused)

  const clientSummary = activeBudgets.reduce(
    (acc, b) => {
      const spend = campaignSpend(b, monthBudgets, accounts, windsorCampaigns, windsorAdsets)
      const cf = calcCashflow(b.budget_total, spend, year, month)
      acc.budget += cf.budgetTotal
      acc.spend += cf.spendToDate
      acc.daily += Math.max(cf.dailyRecommended, 0)
      return acc
    },
    { budget: 0, spend: 0, daily: 0 }
  )

  const currentDailyRate = daysPassed > 0 ? clientSummary.spend / daysPassed : 0
  const projectedEOM = currentDailyRate * daysInMonth
  const isOverspending = clientSummary.budget > 0 && clientSummary.spend > clientSummary.budget
  const projectionExceeds = clientSummary.budget > 0 && projectedEOM > clientSummary.budget * 1.05

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
    setClientModal(null)
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

  const handlePause = async (entry: BudgetEntry) => {
    const updated = { ...entry, paused: !entry.paused }
    await fetch('/api/budgets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    })
    setBudgets((prev) => prev.map((b) =>
      b.campaign_id === entry.campaign_id && b.year === year && b.month === month ? updated : b
    ))
  }

  const handleSpendOverride = async (entry: BudgetEntry, val: number | null) => {
    const updated = { ...entry, spend_override: val }
    await fetch('/api/budgets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    })
    setBudgets((prev) => prev.map((b) =>
      b.campaign_id === entry.campaign_id && b.year === entry.year && b.month === entry.month ? updated : b
    ))
  }

  const handleTotalSave = async () => {
    const newTotal = parseFloat(totalInput.replace(/\./g, '').replace(',', '.'))
    if (isNaN(newTotal) || newTotal <= 0) { setEditingTotal(false); return }
    const currentTotal = activeBudgets.reduce((s, b) => s + b.budget_total, 0)
    if (currentTotal === 0) { setEditingTotal(false); return }
    const ratio = newTotal / currentTotal
    const updated = activeBudgets.map((b) => ({ ...b, budget_total: Math.round(b.budget_total * ratio) }))
    await Promise.all(updated.map((entry) =>
      fetch('/api/budgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
      })
    ))
    setBudgets((prev) => prev.map((b) => {
      const u = updated.find((u) => u.campaign_id === b.campaign_id && u.year === b.year && u.month === b.month)
      return u ?? b
    }))
    setEditingTotal(false)
  }

  function getClientAccountId(clientName: string, source: Source): string {
    return monthBudgets.find((b) => b.client_name === clientName && b.source === source)?.account_id ?? ''
  }

  const metaClients = getClients('facebook')
  const googleClients = getClients('google')

  function ClientList({ source, clients, color }: { source: Source; clients: string[]; color: string }) {
    return (
      <div className="space-y-0.5">
        {clients.map((client) => {
          const isSelected = selected?.client === client && selected?.source === source
          return (
            <button
              key={client}
              onClick={() => { setSelected({ client, source }); setEditingTotal(false) }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-left transition ${
                isSelected ? `${color} text-white font-semibold` : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <span className={`w-2 h-2 rounded-full shrink-0 ${isSelected ? 'bg-white/60' : clientDotColor(client, source)}`} />
              <span className="truncate">{client}</span>
            </button>
          )
        })}
      </div>
    )
  }

  const platformLabel = selected?.source === 'facebook' ? 'Meta Ads' : 'Google Ads'
  const platformBadgeColor = selected?.source === 'facebook' ? 'bg-[#1877F2]' : 'bg-[#4285F4]'

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
            onChange={(e) => { setMonth(Number(e.target.value)); setSelected(null) }}
          >
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
            value={year}
            onChange={(e) => { setYear(Number(e.target.value)); setSelected(null) }}
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
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 mb-4 text-sm">{error}</div>
      )}

      <div className="flex gap-5">
        {/* Sidebar */}
        <div className="w-48 shrink-0 space-y-4">

          {loading ? (
            <div className="space-y-1.5">
              {[1,2,3,4,5,6].map((i) => <div key={i} className="h-9 bg-gray-100 rounded-lg animate-pulse" />)}
            </div>
          ) : (
            <>
              {/* Meta Ads section */}
              <div>
                <div className="flex items-center justify-between mb-1.5 px-1">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#1877F2]" />
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Meta Ads</p>
                  </div>
                  <button
                    onClick={() => setClientModal('facebook')}
                    className="text-gray-400 hover:text-blue-500 transition"
                    title="Agregar cliente Meta"
                  >
                    <UserPlus size={13} />
                  </button>
                </div>
                {metaClients.length > 0
                  ? <ClientList source="facebook" clients={metaClients} color="bg-[#1877F2]" />
                  : <p className="text-xs text-gray-400 px-3">Sin clientes</p>
                }
              </div>

              {/* Divider */}
              <div className="border-t border-gray-100" />

              {/* Google Ads section */}
              <div>
                <div className="flex items-center justify-between mb-1.5 px-1">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#4285F4]" />
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Google Ads</p>
                  </div>
                  <button
                    onClick={() => setClientModal('google')}
                    className="text-gray-400 hover:text-blue-500 transition"
                    title="Agregar cliente Google"
                  >
                    <UserPlus size={13} />
                  </button>
                </div>
                {googleClients.length > 0
                  ? <ClientList source="google" clients={googleClients} color="bg-[#4285F4]" />
                  : <p className="text-xs text-gray-400 px-3">Sin clientes</p>
                }
              </div>
            </>
          )}
        </div>

        {/* Main panel */}
        <div className="flex-1 min-w-0">
          {loading && (
            <div className="space-y-3">
              {[1,2,3].map((i) => <div key={i} className="h-20 bg-white rounded-xl border border-gray-100 animate-pulse" />)}
            </div>
          )}

          {!loading && selected && (
            <>
              {isOverspending && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-2.5 mb-4 text-sm">
                  <AlertTriangle size={15} className="shrink-0" />
                  <span><strong>¡Atención!</strong> El gasto ya superó el presupuesto total del mes.</span>
                </div>
              )}
              {!isOverspending && projectionExceeds && (
                <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 rounded-xl px-4 py-2.5 mb-4 text-sm">
                  <AlertTriangle size={15} className="shrink-0" />
                  <span>Al ritmo actual, la proyección al cierre es <strong>{currency(projectedEOM)}</strong> — podría superar el presupuesto.</span>
                </div>
              )}

              {/* Summary cards */}
              {activeBudgets.length > 0 && (
                <div className="grid grid-cols-4 gap-3 mb-5">
                  <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
                    <p className="text-xs text-gray-400 mb-0.5">Presupuesto total</p>
                    {editingTotal ? (
                      <div className="flex items-center gap-1 mt-0.5">
                        <input
                          autoFocus
                          type="text"
                          value={totalInput}
                          onChange={(e) => setTotalInput(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleTotalSave(); if (e.key === 'Escape') setEditingTotal(false) }}
                          className="w-full text-sm font-bold border border-blue-300 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                        />
                        <button onClick={handleTotalSave} className="text-blue-600 text-xs font-semibold hover:text-blue-700 shrink-0">OK</button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <p className="text-base font-bold text-gray-900">{currency(clientSummary.budget)}</p>
                        <button
                          onClick={() => { setTotalInput(String(clientSummary.budget)); setEditingTotal(true) }}
                          className="text-gray-300 hover:text-gray-500 transition"
                          title="Editar presupuesto total"
                        >
                          <Pencil size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
                    <p className="text-xs text-gray-400 mb-0.5">Gasto acumulado</p>
                    <p className="text-base font-bold text-gray-900">{currency(clientSummary.spend)}</p>
                    {clientSummary.budget > 0 && (
                      <p className="text-xs text-gray-400">{((clientSummary.spend / clientSummary.budget) * 100).toFixed(1)}% del total</p>
                    )}
                  </div>
                  <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
                    <p className="text-xs text-gray-400 mb-0.5">Ritmo actual</p>
                    <p className="text-base font-bold text-gray-900">{currency(currentDailyRate)}<span className="text-xs font-normal text-gray-400">/día</span></p>
                    <p className="text-xs text-gray-400">Proyección: {currency(projectedEOM)}</p>
                  </div>
                  <div className="bg-blue-50 rounded-xl border border-blue-100 px-4 py-3">
                    <p className="text-xs text-blue-500 mb-0.5">Diario recomendado</p>
                    <p className="text-base font-bold text-blue-700">
                      {currency(clientSummary.daily)}<span className="text-xs font-normal text-blue-400">/día</span>
                    </p>
                    <p className="text-xs text-blue-400">{daysInMonth - daysPassed + 1}d restantes</p>
                  </div>
                </div>
              )}

              {/* Section header */}
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full text-white ${platformBadgeColor}`}>
                    {platformLabel}
                  </span>
                  <span className="text-sm font-semibold text-gray-800">{selected.client}</span>
                  <span className="text-xs text-gray-400">
                    {activeBudgets.length} activa{activeBudgets.length !== 1 ? 's' : ''}
                    {pausedBudgets.length > 0 && ` · ${pausedBudgets.length} pausada${pausedBudgets.length !== 1 ? 's' : ''}`}
                  </span>
                </div>
                <button
                  onClick={() => setModal({
                    entry: null,
                    clientName: selected.client,
                    accountId: getClientAccountId(selected.client, selected.source),
                    source: selected.source,
                  })}
                  className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition"
                >
                  <Plus size={12} />
                  Agregar campaña
                </button>
              </div>

              {/* Active campaigns */}
              <div className="space-y-2 mb-3">
                {activeBudgets.map((b) => {
                  const spend = campaignSpend(b, monthBudgets, accounts, windsorCampaigns, windsorAdsets)
                  const cf = calcCashflow(b.budget_total, spend, year, month)
                  return (
                    <CampaignRow
                      key={b.campaign_id}
                      budget={b}
                      cashflow={cf}
                      onEdit={() => setModal({ entry: b, clientName: b.client_name, accountId: b.account_id, source: b.source as Source })}
                      onDelete={() => handleDelete(b.campaign_id)}
                      onPause={() => handlePause(b)}
                      onSpendOverride={(val) => handleSpendOverride(b, val)}
                    />
                  )
                })}
              </div>

              {/* Totals footer */}
              {activeBudgets.length >= 2 && (
                <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 grid grid-cols-4 gap-3 text-sm mb-4">
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

              {/* Paused campaigns */}
              {pausedBudgets.length > 0 && (
                <>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5 px-1">Pausadas</p>
                  <div className="space-y-1.5">
                    {pausedBudgets.map((b) => {
                      const spend = campaignSpend(b, monthBudgets, accounts, windsorCampaigns, windsorAdsets)
                      const cf = calcCashflow(b.budget_total, spend, year, month)
                      return (
                        <CampaignRow
                          key={b.campaign_id}
                          budget={b}
                          cashflow={cf}
                          onEdit={() => setModal({ entry: b, clientName: b.client_name, accountId: b.account_id, source: b.source as Source })}
                          onDelete={() => handleDelete(b.campaign_id)}
                          onPause={() => handlePause(b)}
                          onSpendOverride={(val) => handleSpendOverride(b, val)}
                        />
                      )
                    })}
                  </div>
                </>
              )}

              {clientBudgets.length === 0 && (
                <div className="flex flex-col items-center justify-center h-40 text-gray-400 text-sm border border-dashed border-gray-200 rounded-xl">
                  <p>Sin campañas configuradas</p>
                  <button
                    onClick={() => setModal({
                      entry: null,
                      clientName: selected.client,
                      accountId: getClientAccountId(selected.client, selected.source),
                      source: selected.source,
                    })}
                    className="mt-2 text-blue-500 hover:text-blue-600 font-medium text-xs"
                  >
                    Agregar primera campaña
                  </button>
                </div>
              )}
            </>
          )}

          {!loading && !selected && (
            <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
              Seleccioná un cliente del panel izquierdo
            </div>
          )}
        </div>
      </div>

      {/* Edit/add campaign modal */}
      {modal && (
        <CampaignFormModal
          entry={modal.entry}
          clientName={modal.clientName}
          accountId={modal.accountId}
          source={modal.source}
          year={year}
          month={month}
          existingIds={budgets.map((b) => b.campaign_id)}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}

      {/* Add client modal */}
      {clientModal && (
        <ClientFormModal
          source={clientModal}
          year={year}
          month={month}
          existingIds={budgets.map((b) => b.campaign_id)}
          onSave={async (entry) => {
            await handleSave(entry)
            setSelected({ client: entry.client_name, source: entry.source as Source })
          }}
          onClose={() => setClientModal(null)}
        />
      )}
    </div>
  )
}
