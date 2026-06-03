'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw, AlertCircle, Plus } from 'lucide-react'
import DashboardCard from '@/components/DashboardCard'
import DashboardSidebar from '@/components/DashboardSidebar'
import NewClientModal from '@/components/NewClientModal'
import type { AccountData, BudgetEntry } from '@/lib/types'
import { checklistProgress, trackingProgress } from '@/lib/onboarding'
import type { OnboardingClient } from '@/lib/onboarding'
import type { AuditData, ClientAudit } from '@/lib/audit'
import { useAuth } from '@/contexts/AuthContext'
import { appCache, TTL } from '@/lib/appCache'
import { deduplicateBudgets } from '@/lib/calculations'

function countIncomplete(clients: OnboardingClient[]): number {
  return clients.filter(c => {
    const acc = checklistProgress(c.platform, c.checklist)
    const trk = trackingProgress(c.checklist)
    return acc.checked < acc.total || trk.checked < trk.total
  }).length
}

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
  const _today = new Date()
  const _initYear  = _today.getFullYear()
  const _initMonth = _today.getMonth() + 1

  const today  = _today
  const router = useRouter()
  const { canEdit, isAdmin, profile } = useAuth()
  const [year,     setYear]     = useState(_initYear)
  const [month,    setMonth]    = useState(_initMonth)
  const [accounts, setAccounts] = useState<AccountData[]>(() =>
    appCache.peek<{ data: AccountData[] }>(`windsor-${_initYear}-${_initMonth}`)?.data ?? [])
  const [budgets,  setBudgets]  = useState<BudgetEntry[]>(() =>
    appCache.peek<BudgetEntry[]>('budgets') ?? [])
  const [onboardingNames, setOnboardingNames] = useState<string[]>(() => {
    const cached = appCache.peek<OnboardingClient[]>('onboarding')
    return Array.isArray(cached) ? cached.map(c => c.name).filter(Boolean) : []
  })
  const [loading,          setLoading]          = useState(() =>
    !appCache.has(`windsor-${_initYear}-${_initMonth}`) || !appCache.has('budgets'))
  const [error,            setError]            = useState<string | null>(null)
  const [onboardingCount,  setOnboardingCount]  = useState(() => {
    const cached = appCache.peek<OnboardingClient[]>('onboarding')
    return Array.isArray(cached) ? countIncomplete(cached) : 0
  })
  const [showNewClient,    setShowNewClient]    = useState(false)
  const [auditClients,     setAuditClients]     = useState<ClientAudit[] | null>(null)
  const [auditLoading,     setAuditLoading]     = useState(true)
  type SortOrder = 'priority' | 'spend_high' | 'spend_low'
  const [sortOrder, setSortOrder] = useState<SortOrder>('priority')

  useEffect(() => {
    appCache.fetch<OnboardingClient[]>('onboarding', () =>
      fetch('/api/onboarding').then(r => r.json()), TTL.MIN5)
      .then((clients) => {
        if (!Array.isArray(clients)) return
        setOnboardingCount(countIncomplete(clients))
        setOnboardingNames(clients.map(c => c.name).filter(Boolean))
      })
      .catch(() => {})
  }, [])

  const fetchData = useCallback(async (force = false, silent = false) => {
    if (force) {
      appCache.invalidateHard(`windsor-${year}-${month}`)
      appCache.invalidateHard('budgets')
      appCache.invalidateHard('meta-accounts')
    }
    const hasCached = appCache.has(`windsor-${year}-${month}`) && appCache.has('budgets')
    if (!hasCached && !silent) setLoading(true)
    setError(null)
    try {
      const [windsorJson, bs, metaApiJson] = await Promise.all([
        appCache.fetch(`windsor-${year}-${month}`, async () => {
          const r = await fetch(`/api/windsor?year=${year}&month=${month}`)
          if (!r.ok) throw new Error('Error al conectar con Windsor')
          return r.json()
        }, TTL.HOUR),
        appCache.fetch('budgets', () =>
          fetch('/api/budgets').then(r => r.json()), TTL.MIN1),
        appCache.fetch('meta-accounts', () =>
          fetch('/api/meta/accounts').then(r => r.ok ? r.json() : { accounts: [] }).catch(() => ({ accounts: [] })), TTL.MIN15),
      ])
      const windsorAccounts: AccountData[] = windsorJson.data ?? []
      const windsorIds = new Set(windsorAccounts.filter(a => a.source === 'facebook').map(a => a.account_id))
      const metaOnlyAccounts: AccountData[] = (metaApiJson.accounts ?? []).filter((a: AccountData) => !windsorIds.has(a.account_id))
      setAccounts([...windsorAccounts, ...metaOnlyAccounts])
      setBudgets(bs)

      // ── Monthly rollover ────────────────────────────────────────────────────
      // If clients exist in previous months but have no entries in the current
      // month, copy them forward automatically (once per month, keyed by year+month).
      const rolloverKey = `rollover_done_${year}_${month}`
      if (!localStorage.getItem(rolloverKey)) {
        const allBudgets: BudgetEntry[] = Array.isArray(bs) ? bs : []
        const currentMonthClients = new Set(
          allBudgets.filter(b => b.year === year && b.month === month).map(b => b.client_name)
        )
        const prevMonth = month === 1 ? 12 : month - 1
        const prevYear  = month === 1 ? year - 1 : year
        const prevMonthClients = new Set(
          allBudgets.filter(b => b.year === prevYear && b.month === prevMonth).map(b => b.client_name)
        )
        const needsRollover = [...prevMonthClients].some(c => !currentMonthClients.has(c))
        if (needsRollover) {
          try {
            const res = await fetch('/api/budgets/rollover', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ year, month }),
            })
            if (res.ok) {
              localStorage.setItem(rolloverKey, '1')
              // Reload budgets to reflect new entries
              appCache.invalidate('budgets')
              const freshBudgets = await fetch('/api/budgets').then(r => r.json())
              setBudgets(freshBudgets)
            }
          } catch { /* non-critical — rollover is best-effort */ }
        } else {
          // No rollover needed — mark as done so we don't check again this month
          localStorage.setItem(rolloverKey, '1')
        }
      }
      // ── End rollover ────────────────────────────────────────────────────────
    } catch (e) {
      if (!silent) setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [year, month])

  useEffect(() => { fetchData() }, [fetchData])

  // Fetch audit data independently — non-blocking, cached 5 min
  useEffect(() => {
    setAuditLoading(true)
    appCache.fetch<AuditData>('audit', () =>
      fetch('/api/audit').then(r => r.json()), TTL.MIN5)
      .then(data => { if (data?.results) setAuditClients(data.results) })
      .catch(() => {})
      .finally(() => setAuditLoading(false))
  }, [])

  // Auto-refresh every 2 minutes so assignment changes from admin appear automatically
  useEffect(() => {
    const id = setInterval(() => { fetchData(false, true) }, 2 * 60 * 1000)
    return () => clearInterval(id)
  }, [fetchData])

  // Hourly Meta campaign sync — auto-creates budget entries for new Meta campaigns
  useEffect(() => {
    const SYNC_KEY = 'meta_sync_last_run'
    const ONE_HOUR = 60 * 60 * 1000

    async function runSync() {
      try {
        const res = await fetch('/api/meta/sync-campaigns', { method: 'POST' })
        if (!res.ok) return
        const data = await res.json()
        localStorage.setItem(SYNC_KEY, String(Date.now()))
        if ((data.synced?.new ?? 0) > 0) {
          fetchData(true)
        }
      } catch { /* non-critical background task */ }
    }

    const lastSync = parseInt(localStorage.getItem(SYNC_KEY) ?? '0')
    if (Date.now() - lastSync > ONE_HOUR) runSync()

    const id = setInterval(() => {
      const last = parseInt(localStorage.getItem(SYNC_KEY) ?? '0')
      if (Date.now() - last > ONE_HOUR) runSync()
    }, 5 * 60 * 1000)

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

  // All unique clients visible this month.
  // Source of truth: current-month entries. Clients from prior months that don't
  // have current-month entries yet are also included (the rollover will create them;
  // until then they still need to be visible so the user doesn't think they vanished).
  // Onboarding-only clients (no budget entries at all) are also shown.
  const { allClients, activeClients, pausedClients } = useMemo(() => {
    // Clients that have entries this month
    const thisMonthClients = new Set(monthBudgets.map(b => b.client_name))
    // Clients from the immediately prior month (rollover candidates)
    const prevMonth = month === 1 ? 12 : month - 1
    const prevYear  = month === 1 ? year - 1 : year
    const priorMonthClients = new Set(
      budgets.filter(b => b.year === prevYear && b.month === prevMonth).map(b => b.client_name)
    )
    // Merge: current month + prior month + onboarding
    const allClients = Array.from(new Set([
      ...thisMonthClients,
      ...priorMonthClients,
      ...onboardingNames,
    ]))

    const activeClients = allClients.filter(client => {
      const cb = monthBudgets.filter(b => b.client_name === client)
      if (cb.length === 0) return true   // rollover pending — still show
      return cb.some(b => !b.paused)
    })
    const pausedClients = allClients.filter(client => {
      const cb = monthBudgets.filter(b => b.client_name === client)
      return cb.length > 0 && cb.every(b => b.paused)
    })
    return { allClients, activeClients, pausedClients }
  }, [budgets, monthBudgets, onboardingNames, month, year])

  // For each client: resolve account IDs from current month, falling back to any prior month.
  // This ensures clients that exist but have no budget entry yet this month still show real spend.
  const clientAccountIds = useMemo(() => {
    const map: Record<string, { metaId?: string; googleId?: string }> = {}
    for (const client of allClients) {
      // Prefer current month; fall back to most recent prior month
      const thisMonth = monthBudgets.filter(b => b.client_name === client)
      const ref = thisMonth.length > 0
        ? thisMonth
        : [...budgets.filter(b => b.client_name === client)]
            .sort((a, b) => b.year - a.year || b.month - a.month)
      map[client] = {
        metaId:   ref.find(b => b.source === 'facebook')?.account_id,
        googleId: ref.find(b => b.source === 'google')?.account_id,
      }
    }
    return map
  }, [allClients, monthBudgets, budgets])

  // Precompute all per-client metrics once — eliminates O(n²) on every sort/render
  const clientMetrics = useMemo(() => {
    const map: Record<string, { spend: number; deviation: number }> = {}
    for (const client of allClients) {
      const cb = monthBudgets.filter(b => b.client_name === client)
      const totalBudget = cb.reduce((s, b) => s + b.budget_total, 0)
      const { metaId, googleId } = clientAccountIds[client] ?? {}
      const ms  = accounts.find(a => a.account_id === metaId   && a.source === 'facebook')?.spend ?? 0
      const gs  = accounts.find(a => a.account_id === googleId && a.source === 'google')?.spend ?? 0
      const spend = ms + gs
      map[client] = {
        spend,
        deviation: totalBudget > 0 ? (spend / totalBudget) * 100 - pctExpected : 0,
      }
    }
    return map
  }, [allClients, monthBudgets, clientAccountIds, accounts, pctExpected])

  const sortedActiveClients = useMemo(() => [...activeClients].sort((a, b) => {
    switch (sortOrder) {
      case 'spend_high': return (clientMetrics[b]?.spend ?? 0) - (clientMetrics[a]?.spend ?? 0)
      case 'spend_low':  return (clientMetrics[a]?.spend ?? 0) - (clientMetrics[b]?.spend ?? 0)
      default:           return (clientMetrics[a]?.deviation ?? 0) - (clientMetrics[b]?.deviation ?? 0)
    }
  }), [activeClients, sortOrder, clientMetrics])

  // Summary totals — include paused campaigns (their budget and spend still count)
  const {
    totalMetaSpend, totalGoogleSpend, totalSpend,
    totalMetaBudget, totalGoogleBudget, totalBudget,
  } = useMemo(() => {
    const configuredMetaIds   = new Set(monthBudgets.filter(b => b.source === 'facebook').map(b => b.account_id))
    const configuredGoogleIds = new Set(monthBudgets.filter(b => b.source === 'google').map(b => b.account_id))
    const totalMetaSpend   = accounts.filter(a => a.source === 'facebook' && configuredMetaIds.has(a.account_id)).reduce((s, a) => s + a.spend, 0)
    const totalGoogleSpend = accounts.filter(a => a.source === 'google'   && configuredGoogleIds.has(a.account_id)).reduce((s, a) => s + a.spend, 0)
    const totalSpend       = totalMetaSpend + totalGoogleSpend
    const totalMetaBudget   = monthBudgets.filter(b => b.source === 'facebook').reduce((s, b) => s + b.budget_total, 0)
    const totalGoogleBudget = monthBudgets.filter(b => b.source === 'google').reduce((s, b) => s + b.budget_total, 0)
    const totalBudget       = totalMetaBudget + totalGoogleBudget
    return { totalMetaSpend, totalGoogleSpend, totalSpend, totalMetaBudget, totalGoogleBudget, totalBudget }
  }, [monthBudgets, accounts])

  // Use precomputed metrics — O(n) lookup instead of O(n²)
  const activeCount = useMemo(
    () => activeClients.filter(c => (clientMetrics[c]?.spend ?? 0) > 0).length,
    [activeClients, clientMetrics],
  )

  const handleClientClick = useCallback((client: string) => {
    const cb = monthBudgets.filter(b => b.client_name === client)
    const source = cb.find(b => b.source === 'facebook') ? 'facebook' : 'google'
    router.push(`/cashflow?client=${encodeURIComponent(client)}&source=${source}`)
  }, [monthBudgets, router])

  const handleRename = useCallback(async (oldName: string, newName: string) => {
    const res = await fetch('/api/clients/rename', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oldName, newName }),
    })
    if (!res.ok) throw new Error('Error al renombrar')
    appCache.invalidate('budgets')
    setBudgets(prev => prev.map(b =>
      b.client_name === oldName ? { ...b, client_name: newName } : b
    ))
  }, [])

  const renderCard = useCallback((client: string) => {
    const clientBudgets   = deduplicateBudgets(monthBudgets.filter(b => b.client_name === client))
    // Use pre-resolved account IDs (with fallback to prior months)
    const { metaId, googleId } = clientAccountIds[client] ?? {}
    const metaAccount     = accounts.find(a => a.account_id === metaId   && a.source === 'facebook')
    const googleAccount   = accounts.find(a => a.account_id === googleId && a.source === 'google')
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
        onRename={(newName) => handleRename(client, newName)}
      />
    )
  }, [monthBudgets, accounts, clientAccountIds, daysPassed, daysInMonth, handleClientClick, handleRename])

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Dashboard General</h1>
          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            <p className="text-gray-500 text-sm">
              Meta Ads + Google Ads · {MONTHS[month - 1]} {year} · Día {daysPassed} de {daysInMonth}
            </p>
            {onboardingCount > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-400 text-xs font-semibold">
                <AlertCircle size={11} />
                Tenés {onboardingCount} cliente{onboardingCount > 1 ? 's' : ''} nuevo{onboardingCount > 1 ? 's' : ''} por terminar de crear
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            className="border border-gray-200 dark:border-white/[0.08] rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-[#161616] text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all duration-150 cursor-pointer shadow-sm dark:shadow-none"
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
          >
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select
            className="border border-gray-200 dark:border-white/[0.08] rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-[#161616] text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all duration-150 cursor-pointer shadow-sm dark:shadow-none"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          >
            {[2025, 2026, 2027].map((y) => <option key={y}>{y}</option>)}
          </select>
          {isAdmin && (
            <button
              onClick={() => setShowNewClient(true)}
              className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 shadow-sm shadow-violet-500/20"
            >
              <Plus size={14} /> Nuevo cliente
            </button>
          )}
          <button
            onClick={() => fetchData(true)}
            disabled={loading}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 shadow-sm disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Actualizar
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-500/15 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 rounded-xl p-3 mb-4 text-sm">{error}</div>
      )}

      {/* Summary strip */}
      {!loading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <div className="bg-white dark:bg-[#111111] rounded-2xl border border-gray-100 dark:border-white/[0.06] px-5 py-5 shadow-sm">
            <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">Gasto total</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums tracking-tight">{currency(totalSpend)}</p>
            {totalBudget > 0 && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5 tabular-nums">{((totalSpend / totalBudget) * 100).toFixed(1)}% del presupuesto</p>
            )}
          </div>
          <div className="bg-white dark:bg-[#111111] rounded-2xl border border-gray-100 dark:border-white/[0.06] px-5 py-5 shadow-sm">
            <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">Presupuesto total</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums tracking-tight">{totalBudget > 0 ? currency(totalBudget) : '—'}</p>
            <div className="flex gap-3 mt-1.5">
              <span className="text-[11px] text-gray-400 dark:text-gray-500 tabular-nums">
                <span className="text-[#1877F2] font-semibold">M</span> {currency(totalMetaBudget)}
              </span>
              <span className="text-[11px] text-gray-400 dark:text-gray-500 tabular-nums">
                <span className="text-[#4285F4] font-semibold">G</span> {currency(totalGoogleBudget)}
              </span>
            </div>
          </div>
          <div className="bg-white dark:bg-[#111111] rounded-2xl border border-gray-100 dark:border-white/[0.06] px-5 py-5 shadow-sm">
            <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">Restante</p>
            <p className={`text-2xl font-bold tabular-nums tracking-tight ${totalBudget - totalSpend < 0 ? 'text-red-500 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
              {totalBudget > 0 ? currency(totalBudget - totalSpend) : '—'}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">{activeClients.length} clientes activos</p>
          </div>
          <div className="bg-white dark:bg-[#111111] rounded-2xl border border-gray-100 dark:border-white/[0.06] px-5 py-5 shadow-sm">
            <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">Clientes activos</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums tracking-tight">{activeCount}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">de {activeClients.length} configurados</p>
          </div>
        </div>
      )}

      {/* Main body: 3-col cards + sticky sidebar */}
      <div className="flex gap-6 items-start">

        {/* Cards column */}
        <div className="flex-1 min-w-0">

          {/* Skeleton */}
          {loading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {[1,2,3,4,5,6].map((i) => (
                <div key={i} className="h-56 bg-gray-100 dark:bg-[#1a1a1a] rounded-2xl border border-gray-200 dark:border-[#2a2a2a] animate-pulse" />
              ))}
            </div>
          )}

          {/* Sort bar */}
          {!loading && sortedActiveClients.length > 0 && (() => {
            const opts: { key: typeof sortOrder; label: string }[] = [
              { key: 'priority',   label: 'Prioridad'   },
              { key: 'spend_high', label: 'Mayor gasto' },
              { key: 'spend_low',  label: 'Menor gasto' },
            ]
            return (
              <div className="flex items-center gap-2 mb-5 flex-wrap">
                <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-600 uppercase tracking-widest mr-1">Ordenar:</span>
                {opts.map(o => (
                  <button
                    key={o.key}
                    onClick={() => setSortOrder(o.key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 ${
                      sortOrder === o.key
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-white dark:bg-white/[0.03] text-gray-500 border border-gray-200 dark:border-white/[0.06] hover:border-gray-300 dark:hover:border-white/[0.12] hover:text-gray-700 dark:hover:text-gray-300 shadow-sm dark:shadow-none'
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            )
          })()}

          {/* Active client cards */}
          {!loading && sortedActiveClients.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {sortedActiveClients.map(renderCard)}
            </div>
          )}

          {/* Paused clients separator + cards */}
          {!loading && pausedClients.length > 0 && (
            <>
              <div className="flex items-center gap-3 mt-8 mb-4">
                <div className="flex-1 border-t border-gray-200 dark:border-[#2a2a2a]" />
                <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider px-1">
                  Clientes pausados
                </span>
                <div className="flex-1 border-t border-gray-200 dark:border-[#2a2a2a]" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 opacity-60">
                {pausedClients.map(renderCard)}
              </div>
            </>
          )}

          {/* Empty workspace state */}
          {!loading && budgets.length === 0 && (
            <div className="flex items-center justify-center py-24">
              <p className="text-gray-400 dark:text-gray-500 text-sm">
                No hay clientes cargados. Usá el botón <span className="text-gray-600 dark:text-gray-300 font-semibold">Nuevo cliente</span> para empezar.
              </p>
            </div>
          )}

          {/* No clients for selected period */}
          {!loading && budgets.length > 0 && allClients.length === 0 && (
            <div className="flex items-center justify-center h-48 text-gray-500 text-sm">
              No hay clientes configurados para este período
            </div>
          )}
        </div>

        {/* Sticky sidebar — hidden on small screens */}
        <div className="hidden xl:block w-[272px] shrink-0 sticky top-8 self-start mt-[54px]">
          <DashboardSidebar
            auditClients={auditClients}
            activeClients={activeClients}
            loading={auditLoading}
            month={month}
            year={year}
          />
        </div>
      </div>

      {showNewClient && (
        <NewClientModal
          onClose={() => setShowNewClient(false)}
          onCreated={() => { setShowNewClient(false); fetchData(true) }}
        />
      )}
    </div>
  )
}
