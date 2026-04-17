'use client'

import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, Plus, Pencil, AlertTriangle, UserPlus, Clock } from 'lucide-react'
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

function formatCountdown(s: number) {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

// Normalize campaign name for fuzzy matching (remove accents, lowercase, unify separators)
function normName(s: string): string {
  return s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[|\-_]+/g, ' ')
    .replace(/\s+/g, ' ').trim()
}

// Deduplicate budget entries by normalized campaign name within the same account+source.
// Prefers manually-created entries (non-auto_ IDs) and higher budget_total when colliding.
function deduplicateBudgets(entries: BudgetEntry[]): BudgetEntry[] {
  const seen = new Map<string, BudgetEntry>()
  for (const b of entries) {
    const key = `${b.account_id}|${b.source}|${normName(b.campaign_name)}`
    const existing = seen.get(key)
    if (!existing) {
      seen.set(key, b)
    } else {
      const bIsAuto       = b.campaign_id.startsWith('auto_')
      const existingIsAuto = existing.campaign_id.startsWith('auto_')
      if (!bIsAuto && existingIsAuto) {
        seen.set(key, b) // prefer manually-created entry
      } else if (bIsAuto === existingIsAuto && b.budget_total > existing.budget_total) {
        seen.set(key, b) // prefer entry with higher budget set
      }
    }
  }
  return Array.from(seen.values())
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

// ── Full Windsor sync ────────────────────────────────────────────────────────────
// Runs every hour. Compares Windsor campaigns (+ adsets) against app entries and:
//   ADDS    new active campaigns not yet in the app
//   PAUSES  entries whose Windsor campaign had no spend on the last day of data
//   UNPAUSES entries whose Windsor campaign resumed spending
//   DELETES auto-added entries that are redundant (same Windsor campaign already
//           represented by a real/manual entry, e.g. campaign-level vs adset-level)
async function autoSyncCampaigns(
  windsorCampaigns: CampaignSpend[],
  windsorAdsets: CampaignSpend[],
  allBudgets: BudgetEntry[],
  year: number,
  month: number,
  onDone: (added: BudgetEntry[], updated: BudgetEntry[], deleted: string[]) => void
) {
  const monthBudgets = allBudgets.filter(b => b.year === year && b.month === month)

  // account → client map (only accounts already tracked in the app)
  const accountToClient = new Map<string, { client: string; source: string }>()
  for (const b of monthBudgets) {
    accountToClient.set(`${b.account_id}|${b.source}`, { client: b.client_name, source: b.source })
  }

  // Index Windsor campaigns: "account_id|source|normName" → CampaignSpend
  const wcIndex = new Map<string, CampaignSpend>()
  for (const wc of windsorCampaigns) {
    if (!wc.account_id) continue
    wcIndex.set(`${wc.account_id}|${wc.source}|${normName(wc.campaign_name)}`, wc)
  }

  // Index Windsor adsets → their parent CampaignSpend: "account_id|source|normAdsetName" → parent
  const waIndex = new Map<string, CampaignSpend>()
  for (const wa of windsorAdsets) {
    if (!wa.account_id || !wa.adset_name) continue
    const parentKey = `${wa.account_id}|${wa.source}|${normName(wa.campaign_name)}`
    const parent = wcIndex.get(parentKey)
    if (!parent) continue
    waIndex.set(`${wa.account_id}|${wa.source}|${normName(wa.adset_name)}`, parent)
  }

  // Find the Windsor CampaignSpend that best matches a budget entry (campaign OR adset name)
  function findMatch(b: BudgetEntry): CampaignSpend | undefined {
    const as   = `${b.account_id}|${b.source}`
    const bNorm = normName(b.campaign_name)
    // Exact campaign name
    const ce = wcIndex.get(`${as}|${bNorm}`)
    if (ce) return ce
    // Fuzzy campaign name
    for (const [k, wc] of wcIndex) {
      if (!k.startsWith(as + '|')) continue
      const wcN = k.slice(as.length + 1)
      if (wcN.includes(bNorm) || bNorm.includes(wcN)) return wc
    }
    // Exact adset name
    const ae = waIndex.get(`${as}|${bNorm}`)
    if (ae) return ae
    // Fuzzy adset name
    for (const [k, wc] of waIndex) {
      if (!k.startsWith(as + '|')) continue
      const waN = k.slice(as.length + 1)
      if (waN.includes(bNorm) || bNorm.includes(waN)) return wc
    }
    return undefined
  }

  // ── Phase 1: map every existing entry to its Windsor campaign ─────────────────
  const entryToWc = new Map<string, CampaignSpend>()
  for (const b of monthBudgets) {
    const wc = findMatch(b)
    if (wc) entryToWc.set(b.campaign_id, wc)
  }

  // ── Phase 2: resolve conflicts ────────────────────────────────────────────────
  // If multiple entries point to the same Windsor campaign, delete auto-adds that
  // have no budget set (they're redundant campaign-level duplicates of adset entries).
  const wcToEntries = new Map<string, BudgetEntry[]>()
  for (const b of monthBudgets) {
    const wc = entryToWc.get(b.campaign_id)
    if (!wc) continue
    const k = `${wc.account_id}|${wc.source}|${normName(wc.campaign_name)}`
    if (!wcToEntries.has(k)) wcToEntries.set(k, [])
    wcToEntries.get(k)!.push(b)
  }

  const deleteSet = new Set<string>()
  for (const entries of wcToEntries.values()) {
    if (entries.length <= 1) continue
    const realEntries = entries.filter(b => !b.campaign_id.startsWith('auto_') || b.budget_total > 0)
    const autoZero    = entries.filter(b =>  b.campaign_id.startsWith('auto_') && b.budget_total === 0)
    if (realEntries.length > 0) autoZero.forEach(b => deleteSet.add(b.campaign_id))
  }

  // ── Phase 3: sync paused/active status ───────────────────────────────────────
  const toUpdate: BudgetEntry[] = []
  for (const b of monthBudgets) {
    if (deleteSet.has(b.campaign_id)) continue
    const wc = entryToWc.get(b.campaign_id)
    if (!wc) continue  // no Windsor data at all — leave user's setting intact
    const activeInWindsor = (wc.today_spend ?? 0) > 0
    if (activeInWindsor && b.paused)  toUpdate.push({ ...b, paused: false })
    if (!activeInWindsor && !b.paused) toUpdate.push({ ...b, paused: true })
  }

  // ── Phase 4: add new active campaigns ────────────────────────────────────────
  // Build the set of Windsor campaign keys already represented by surviving entries
  const matchedKeys = new Set<string>()
  for (const b of monthBudgets) {
    if (deleteSet.has(b.campaign_id)) continue
    const wc = entryToWc.get(b.campaign_id)
    if (wc) matchedKeys.add(`${wc.account_id}|${wc.source}|${normName(wc.campaign_name)}`)
  }

  // Group unmatched Windsor campaigns (active today) by account
  const unmatchedWcByAcct = new Map<string, CampaignSpend[]>()
  const addSeen = new Set<string>()
  for (const wc of windsorCampaigns) {
    if (!wc.account_id || (wc.today_spend ?? 0) <= 0) continue
    const wcKey = `${wc.account_id}|${wc.source}|${normName(wc.campaign_name)}`
    if (matchedKeys.has(wcKey) || addSeen.has(wcKey)) continue
    if (!accountToClient.has(`${wc.account_id}|${wc.source}`)) continue
    addSeen.add(wcKey)
    const acctKey = `${wc.account_id}|${wc.source}`
    if (!unmatchedWcByAcct.has(acctKey)) unmatchedWcByAcct.set(acctKey, [])
    unmatchedWcByAcct.get(acctKey)!.push(wc)
  }

  const toAdd: BudgetEntry[] = []
  for (const [acctKey, unmatchedWc] of unmatchedWcByAcct) {
    // Count surviving active Supabase entries that ALSO have no Windsor match (name mismatch)
    // These are existing campaigns that are already set up but Windsor uses different names.
    // We only add the EXCESS — campaigns beyond what existing entries already cover.
    const [acctId, acctSource] = acctKey.split('|')
    const unmatchedExistingCount = monthBudgets.filter(b =>
      b.account_id === acctId && b.source === acctSource &&
      !b.paused && !deleteSet.has(b.campaign_id) && !entryToWc.has(b.campaign_id)
    ).length

    // Sort by spend descending so we prefer the highest-spending genuinely new campaigns
    const sorted = [...unmatchedWc].sort((a, b) => (b.today_spend ?? 0) - (a.today_spend ?? 0))
    const numToAdd = Math.max(0, sorted.length - unmatchedExistingCount)
    const mapping = accountToClient.get(acctKey)!

    for (let i = 0; i < numToAdd; i++) {
      const wc = sorted[i]
      const suffix = wc.source === 'facebook' ? 'fb' : 'gg'
      toAdd.push({
        campaign_id:   `auto_${suffix}_${wc.account_id.slice(-5)}_${Date.now()}_${toAdd.length}`,
        campaign_name: wc.campaign_name,
        client_name:   mapping.client,
        source:        wc.source,
        account_id:    wc.account_id,
        year, month,
        budget_total:  0,
        paused:        false,
      })
    }
  }

  // ── Execute all changes ───────────────────────────────────────────────────────
  const toDelete = Array.from(deleteSet)
  const promises: Promise<unknown>[] = [
    ...[...toAdd, ...toUpdate].map(e => fetch('/api/budgets', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(e),
    })),
    ...toDelete.map(id => fetch('/api/budgets', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaign_id: id, year, month }),
    })),
  ]
  if (promises.length > 0) await Promise.all(promises)
  onDone(toAdd, toUpdate, toDelete)
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
  const [countdown, setCountdown] = useState(3600)

  const fetchData = useCallback(async (force = false) => {
    setLoading(true)
    setError(null)
    try {
      const [windsorRes, budgetRes] = await Promise.all([
        fetch(`/api/windsor?year=${year}&month=${month}${force ? '&force=true' : ''}`),
        fetch('/api/budgets'),
      ])
      if (!windsorRes.ok) throw new Error('Error al conectar con Windsor')
      const windsorJson = await windsorRes.json()
      const accs: AccountData[]    = windsorJson.data      ?? []
      const bs:   BudgetEntry[]    = await budgetRes.json()
      const wCampaigns: CampaignSpend[] = windsorJson.campaigns ?? []
      const wAdsets:    CampaignSpend[] = windsorJson.adsets    ?? []

      setAccounts(accs)
      setWindsorCampaigns(wCampaigns)
      setWindsorAdsets(wAdsets)
      setBudgets(bs)

      // Auto-select from URL param (on first load) or default to first Meta client
      if (!selected) {
        const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '')
        const preClient = params.get('client')
        const preSrc    = params.get('source') as Source | null
        if (preClient && preSrc) {
          setSelected({ client: preClient, source: preSrc })
        } else {
          const mb = bs.filter((b) => b.year === year && b.month === month)
          const firstMeta = Array.from(new Set(mb.filter(b => b.source === 'facebook').map(b => b.client_name))).sort()[0]
          if (firstMeta) setSelected({ client: firstMeta, source: 'facebook' })
        }
      }

      // Full Windsor sync: adds new, pauses inactive, unpauses resumed, removes redundant duplicates
      await autoSyncCampaigns(wCampaigns, wAdsets, bs, year, month, (added, updated, deleted) => {
        setBudgets(prev => {
          let next = [...prev, ...added]
          for (const u of updated) {
            const idx = next.findIndex(b => b.campaign_id === u.campaign_id && b.year === u.year && b.month === u.month)
            if (idx >= 0) next[idx] = u
          }
          next = next.filter(b => !(deleted.includes(b.campaign_id) && b.year === year && b.month === month))
          return next
        })
      })
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [year, month]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchData() }, [fetchData])

  // Countdown timer: ticks every second, triggers forced sync when it reaches 0
  useEffect(() => {
    const id = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          fetchData(true)
          return 3600
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [fetchData])

  const monthBudgets = budgets.filter((b) => b.year === year && b.month === month)

  const daysInMonth = new Date(year, month, 0).getDate()
  // Data from Windsor is through yesterday — align pacing to match
  const daysPassed =
    year === today.getFullYear() && month === today.getMonth() + 1
      ? Math.max(1, today.getDate() - 1)
      : daysInMonth
  const pctExpected = (daysPassed / daysInMonth) * 100

  function getClients(source: Source): string[] {
    const all = Array.from(new Set(
      monthBudgets.filter((b) => b.source === source).map((b) => b.client_name)
    ))
    return all.sort((a, b) => {
      const aCampaigns = monthBudgets.filter(e => e.client_name === a && e.source === source)
      const bCampaigns = monthBudgets.filter(e => e.client_name === b && e.source === source)
      const aAllPaused = aCampaigns.length > 0 && aCampaigns.every(e => e.paused)
      const bAllPaused = bCampaigns.length > 0 && bCampaigns.every(e => e.paused)
      if (aAllPaused && !bAllPaused) return 1
      if (!aAllPaused && bAllPaused) return -1
      return a.localeCompare(b)
    })
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

  // Selected client's campaigns — deduplicated by normalized name to prevent double rows
  const clientBudgets = selected
    ? deduplicateBudgets(monthBudgets.filter((b) => b.client_name === selected.client && b.source === selected.source))
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
          const campaigns  = monthBudgets.filter(e => e.client_name === client && e.source === source)
          const allPaused  = campaigns.length > 0 && campaigns.every(e => e.paused)
          return (
            <button
              key={client}
              onClick={() => { setSelected({ client, source }); setEditingTotal(false) }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-left transition ${
                isSelected ? `${color} text-white font-semibold` : allPaused ? 'text-gray-400 hover:bg-gray-50' : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <span className={`w-2 h-2 rounded-full shrink-0 ${isSelected ? 'bg-white/60' : clientDotColor(client, source)}`} />
              <span className="flex-1 truncate">{client}</span>
              {allPaused && !isSelected && (
                <span className="text-[9px] font-semibold text-gray-400 bg-gray-100 px-1 py-0.5 rounded shrink-0">PAUSA</span>
              )}
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
          <div className="flex items-center gap-1.5 text-xs text-gray-400 border border-gray-200 rounded-lg px-3 py-2 bg-white font-mono" title="Próxima sincronización automática">
            <Clock size={12} className="shrink-0" />
            {formatCountdown(countdown)}
          </div>
          <button
            onClick={() => { fetchData(true); setCountdown(3600) }}
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
