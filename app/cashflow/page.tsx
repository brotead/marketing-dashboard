'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { RefreshCw, Plus, Pencil, AlertTriangle, Clock, Trash2, X, Sparkles } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import CampaignRow from '@/components/CampaignRow'
import dynamic from 'next/dynamic'
const CampaignFormModal = dynamic(() => import('@/components/CampaignFormModal'), { ssr: false })
import type { AccountData, BudgetEntry, CampaignSpend } from '@/lib/types'
import { calcCashflow } from '@/lib/calculations'
import { appCache, TTL } from '@/lib/appCache'

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

function fuzzyMatch(a: string, b: string): boolean {
  const na = normName(a), nb = normName(b)
  return na === nb || na.includes(nb) || nb.includes(na)
}

async function resolvePendingClients(
  budgets: BudgetEntry[],
  wAccounts: AccountData[],
  wCampaigns: CampaignSpend[],
  year: number,
  month: number
): Promise<{ added: BudgetEntry[]; removedIds: string[] }> {
  const pending = budgets.filter(
    b => b.year === year && b.month === month && b.account_id === '__pending__'
  )
  if (pending.length === 0) return { added: [], removedIds: [] }

  const toAdd: BudgetEntry[] = []
  const removedIds: string[] = []

  for (const p of pending) {
    const source = p.source
    const match  = wAccounts.find(a => a.source === source && fuzzyMatch(p.client_name, a.account_name))
    if (!match) continue

    removedIds.push(p.campaign_id)

    const campaigns = wCampaigns.filter(
      wc => wc.account_id === match.account_id && wc.source === source
    )
    const suffix = source === 'facebook' ? 'fb' : 'gg'
    for (let i = 0; i < campaigns.length; i++) {
      toAdd.push({
        campaign_id:   `auto_${suffix}_${match.account_id.slice(-5)}_${Date.now()}_${toAdd.length}`,
        campaign_name: campaigns[i].campaign_name,
        client_name:   p.client_name,
        source,
        account_id:    match.account_id,
        year, month,
        budget_total:  0,
        paused:        false,
      })
    }
  }

  await Promise.all([
    ...toAdd.map(e => fetch('/api/budgets', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(e),
    })),
    ...removedIds.map(id => fetch('/api/budgets', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaign_id: id, year, month }),
    })),
  ])
  return { added: toAdd, removedIds }
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
    (b) => b.account_id === budget.account_id && b.source === budget.source
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
  const allAccountBudgets = monthBudgets.filter((b) => b.account_id === budget.account_id && b.source === budget.source)
  const accountTotalBudget = allAccountBudgets.reduce((s, b) => s + b.budget_total, 0)
  if (accountTotalBudget === 0) return allAccountBudgets.length > 0 ? account.spend / allAccountBudgets.length : 0
  return (budget.budget_total / accountTotalBudget) * account.spend
}

// ── Full Windsor sync ────────────────────────────────────────────────────────────
async function autoSyncCampaigns(
  windsorCampaigns: CampaignSpend[],
  windsorAdsets: CampaignSpend[],
  allBudgets: BudgetEntry[],
  year: number,
  month: number,
  onDone: (added: BudgetEntry[], updated: BudgetEntry[], deleted: string[]) => void,
) {
  const monthBudgets = allBudgets.filter(b => b.year === year && b.month === month)

  const accountToClient = new Map<string, { client: string; source: string }>()
  for (const b of monthBudgets) {
    if (b.account_id === '__pending__') continue
    accountToClient.set(`${b.account_id}|${b.source}`, { client: b.client_name, source: b.source })
  }

  const wcIndex = new Map<string, CampaignSpend>()
  for (const wc of windsorCampaigns) {
    if (!wc.account_id) continue
    wcIndex.set(`${wc.account_id}|${wc.source}|${normName(wc.campaign_name)}`, wc)
  }

  const waIndex = new Map<string, CampaignSpend>()
  for (const wa of windsorAdsets) {
    if (!wa.account_id || !wa.adset_name) continue
    const parentKey = `${wa.account_id}|${wa.source}|${normName(wa.campaign_name)}`
    const parent = wcIndex.get(parentKey)
    if (!parent) continue
    waIndex.set(`${wa.account_id}|${wa.source}|${normName(wa.adset_name)}`, parent)
  }

  function findMatch(b: BudgetEntry): CampaignSpend | undefined {
    const as   = `${b.account_id}|${b.source}`
    const bNorm = normName(b.campaign_name)
    const ce = wcIndex.get(`${as}|${bNorm}`)
    if (ce) return ce
    for (const [k, wc] of wcIndex) {
      if (!k.startsWith(as + '|')) continue
      const wcN = k.slice(as.length + 1)
      if (wcN.includes(bNorm) || bNorm.includes(wcN)) return wc
    }
    const ae = waIndex.get(`${as}|${bNorm}`)
    if (ae) return ae
    for (const [k, wc] of waIndex) {
      if (!k.startsWith(as + '|')) continue
      const waN = k.slice(as.length + 1)
      if (waN.includes(bNorm) || bNorm.includes(waN)) return wc
    }
    return undefined
  }

  const entryToWc = new Map<string, CampaignSpend>()
  for (const b of monthBudgets) {
    const wc = findMatch(b)
    if (wc) entryToWc.set(b.campaign_id, wc)
  }

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

  const toUpdate: BudgetEntry[] = []
  for (const b of monthBudgets) {
    if (deleteSet.has(b.campaign_id)) continue
  }

  const matchedKeys = new Set<string>()
  for (const b of monthBudgets) {
    if (deleteSet.has(b.campaign_id)) continue
    const wc = entryToWc.get(b.campaign_id)
    if (wc) matchedKeys.add(`${wc.account_id}|${wc.source}|${normName(wc.campaign_name)}`)
  }

  const unmatchedWcByAcct = new Map<string, CampaignSpend[]>()
  const addSeen = new Set<string>()
  for (const wc of windsorCampaigns) {
    if (!wc.account_id || wc.spend <= 0) continue
    const wcKey = `${wc.account_id}|${wc.source}|${normName(wc.campaign_name)}`
    if (matchedKeys.has(wcKey) || addSeen.has(wcKey)) continue
    const acctKey = `${wc.account_id}|${wc.source}`
    if (!accountToClient.has(acctKey)) continue
    addSeen.add(wcKey)
    if (!unmatchedWcByAcct.has(acctKey)) unmatchedWcByAcct.set(acctKey, [])
    unmatchedWcByAcct.get(acctKey)!.push(wc)
  }

  const toAdd: BudgetEntry[] = []
  for (const [acctKey, unmatchedWc] of unmatchedWcByAcct) {
    const [acctId, acctSource] = acctKey.split('|')
    const unmatchedExistingCount = monthBudgets.filter(b =>
      b.account_id === acctId && b.source === acctSource &&
      !b.paused && !deleteSet.has(b.campaign_id) && !entryToWc.has(b.campaign_id)
    ).length

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

function PendingClientPanel({ client, source, windsorCampaigns, year, month, onResolved }: {
  client: string
  source: Source
  windsorCampaigns: CampaignSpend[]
  year: number
  month: number
  onResolved: (entries: BudgetEntry[]) => void
}) {
  const [accountId, setAccountId] = useState('')
  const [error,     setError]     = useState('')
  const [loading,   setLoading]   = useState(false)

  async function resolve() {
    const id = accountId.trim()
    if (!id) { setError('Ingresá el Account ID'); return }

    // Try existing in-memory data first
    let campaigns = windsorCampaigns.filter(wc => wc.account_id === id && wc.source === source)

    // If not found, fetch fresh from Windsor (account may have no spend this month yet)
    if (campaigns.length === 0) {
      setLoading(true)
      try {
        const res  = await fetch(`/api/windsor?year=${year}&month=${month}&force=true`)
        const json = await res.json()
        const fresh: CampaignSpend[] = json.campaigns ?? []
        campaigns = fresh.filter(wc => wc.account_id === id && wc.source === source)
      } catch { /* ignore */ } finally {
        setLoading(false)
      }
    }

    if (campaigns.length === 0) {
      setError('No se encontraron campañas para ese Account ID. Verificá que el ID sea correcto y que la cuenta esté activa en Windsor.')
      return
    }

    const suffix = source === 'facebook' ? 'fb' : 'gg'
    const ts = Date.now()
    onResolved(campaigns.map((wc, i) => ({
      campaign_id:   `auto_${suffix}_${id.slice(-5)}_${ts}_${i}`,
      campaign_name: wc.campaign_name,
      client_name:   client,
      source,
      account_id:    id,
      year, month,
      budget_total:  0,
      paused:        false,
    })))
  }

  const platformLabel = source === 'facebook' ? 'Meta Ads' : 'Google Ads'
  const placeholder   = source === 'facebook' ? 'Ej: 606042859735' : 'Ej: 959-198-0482'

  return (
    <div className="border border-dashed border-orange-300 dark:border-orange-500/30 rounded-2xl bg-orange-50 dark:bg-orange-500/5 p-8">
      <p className="text-sm font-semibold text-orange-600 dark:text-orange-400 mb-1">No se encontró la cuenta en Windsor automáticamente</p>
      <p className="text-xs text-orange-500/70 dark:text-orange-400/60 mb-5">
        El nombre "{client}" no coincidió con ninguna cuenta de {platformLabel} en Windsor. Ingresá el Account ID para cargar las campañas.
      </p>
      <div className="flex gap-2 max-w-sm">
        <input
          value={accountId}
          onChange={e => { setAccountId(e.target.value); setError('') }}
          onKeyDown={e => { if (e.key === 'Enter') resolve() }}
          placeholder={placeholder}
          className="flex-1 px-3 py-2 text-sm bg-white dark:bg-[#1a1a1a] border border-orange-300 dark:border-orange-500/40 rounded-xl text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 font-mono"
          autoFocus
        />
        <button
          onClick={resolve}
          disabled={loading}
          className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-xl transition disabled:opacity-60 flex items-center gap-2"
        >
          {loading && <RefreshCw size={13} className="animate-spin" />}
          {loading ? 'Buscando...' : 'Cargar'}
        </button>
      </div>
      {error && <p className="text-xs text-rose-500 mt-2">{error}</p>}
    </div>
  )
}

export default function CashflowPage() {
  const today = new Date()
  const { canEdit } = useAuth()
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

  const [deleteConfirm,         setDeleteConfirm]         = useState<{ clientName: string; source: Source } | null>(null)
  const [campaignDeleteConfirm, setCampaignDeleteConfirm] = useState<BudgetEntry | null>(null)
  const [newToasts, setNewToasts] = useState<{ id: string; name: string; client: string }[]>([])
  const [newCampaignIds, setNewCampaignIds] = useState<Set<string>>(new Set())
  const [editingTotal, setEditingTotal] = useState(false)
  const [totalInput, setTotalInput] = useState('')
  const [countdown, setCountdown] = useState(3600)
  const [carryoverInfo, setCarryoverInfo] = useState<{ count: number; fromMonth: number } | null>(null)

  const fetchData = useCallback(async (force = false) => {
    if (force) {
      appCache.invalidateHard(`windsor-${year}-${month}`)
      appCache.invalidateHard('budgets')
    }
    const hasCached = appCache.has(`windsor-${year}-${month}`) && appCache.has('budgets')
    if (!hasCached) setLoading(true)
    setError(null)
    try {
      let [windsorJson, bs] = await Promise.all([
        appCache.fetch<{ data: AccountData[]; campaigns: CampaignSpend[]; adsets: CampaignSpend[] }>(
          `windsor-${year}-${month}`, async () => {
            const r = await fetch(`/api/windsor?year=${year}&month=${month}${force ? '&force=true' : ''}`)
            if (!r.ok) throw new Error('Error al conectar con Windsor')
            return r.json()
          }, TTL.HOUR),
        appCache.fetch<BudgetEntry[]>('budgets', () =>
          fetch('/api/budgets').then(r => r.json()), TTL.MIN5),
      ])
      const accs: AccountData[] = windsorJson.data ?? []
      const wCampaigns: CampaignSpend[] = windsorJson.campaigns ?? []
      const wAdsets:    CampaignSpend[] = windsorJson.adsets    ?? []

      // Auto-carryover: si el mes seleccionado no tiene entradas, copiar del mes anterior
      const hasCurrentMonth = bs.some(b => b.year === year && b.month === month)
      if (!hasCurrentMonth) {
        const prevYear  = month === 1 ? year - 1 : year
        const prevMonth = month === 1 ? 12 : month - 1
        const prevBudgets = bs.filter(b => b.year === prevYear && b.month === prevMonth)
        if (prevBudgets.length > 0) {
          const newEntries: BudgetEntry[] = prevBudgets.map(b => ({
            ...b,
            year,
            month,
            spend_override: null,
          }))
          await Promise.all(newEntries.map(e =>
            fetch('/api/budgets', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(e),
            })
          ))
          bs = [...bs, ...newEntries]
          setCarryoverInfo({ count: newEntries.length, fromMonth: prevMonth })
        }
      } else {
        setCarryoverInfo(null)
      }

      setAccounts(accs)
      setWindsorCampaigns(wCampaigns)
      setWindsorAdsets(wAdsets)
      setBudgets(bs)

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
      appCache.invalidate('budgets')
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [year, month]) // eslint-disable-line react-hooks/exhaustive-deps

  const syncCampaigns = useCallback(async () => {
    try {
      const [windsorRes, budgetRes] = await Promise.all([
        fetch(`/api/windsor?year=${year}&month=${month}&force=true`),
        fetch('/api/budgets', { cache: 'no-store' }),
      ])
      if (!windsorRes.ok) return
      const windsorJson  = await windsorRes.json()
      const bs: BudgetEntry[]           = await budgetRes.json()
      const wAccounts:  AccountData[]   = windsorJson.data      ?? []
      const wCampaigns: CampaignSpend[] = windsorJson.campaigns ?? []
      const wAdsets:    CampaignSpend[] = windsorJson.adsets    ?? []

      // Step 1: resolve pending clients (added by name only) → find Windsor account by fuzzy name
      const { added: resolved, removedIds } = await resolvePendingClients(bs, wAccounts, wCampaigns, year, month)
      if (resolved.length > 0 || removedIds.length > 0) {
        setBudgets(prev => [
          ...prev.filter(b => !removedIds.includes(b.campaign_id)),
          ...resolved,
        ])
      }

      // Step 2: sync new/deleted campaigns for all known accounts
      const allBudgets = [...bs.filter(b => !removedIds.includes(b.campaign_id)), ...resolved]
      await autoSyncCampaigns(wCampaigns, wAdsets, allBudgets, year, month, (added, updated, deleted) => {
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
    } catch { /* silent */ }
  }, [year, month])

  useEffect(() => { fetchData() }, [fetchData])

  // Load "nueva" campaign IDs from localStorage (persist 24h)
  useEffect(() => {
    try {
      const stored: Record<string, number> = JSON.parse(localStorage.getItem('brote_new_campaigns') ?? '{}')
      const DAY = 24 * 60 * 60 * 1000
      const now = Date.now()
      const active = new Set(Object.entries(stored).filter(([, ts]) => now - ts < DAY).map(([id]) => id))
      setNewCampaignIds(active)
      const cleaned = Object.fromEntries(Object.entries(stored).filter(([, ts]) => now - ts < DAY))
      localStorage.setItem('brote_new_campaigns', JSON.stringify(cleaned))
    } catch { /* silent */ }
  }, [])

  // Hourly: detect truly new campaigns (any spend, including $0) — never updates existing ones
  const checkNewCampaigns = useCallback(async () => {
    try {
      const [windsorRes, budgetRes, excludedRes] = await Promise.all([
        fetch(`/api/windsor?year=${year}&month=${month}&force=true`),
        fetch('/api/budgets', { cache: 'no-store' }),
        fetch('/api/excluded-campaigns', { cache: 'no-store' }),
      ])
      if (!windsorRes.ok) return
      const windsorJson  = await windsorRes.json()
      const bs: BudgetEntry[]            = await budgetRes.json()
      const wCampaigns: CampaignSpend[]  = windsorJson.campaigns ?? []
      const excluded: { account_id: string; source: string; campaign_name_norm: string }[] =
        excludedRes.ok ? await excludedRes.json() : []

      const monthBudgets = bs.filter(b => b.year === year && b.month === month)

      // account_id|source → client name (skip pending)
      const accountToClient = new Map<string, string>()
      for (const b of monthBudgets) {
        if (b.account_id === '__pending__') continue
        accountToClient.set(`${b.account_id}|${b.source}`, b.client_name)
      }

      // Build keys of campaigns already in our system
      const existingKeys = new Set<string>()
      for (const b of monthBudgets) {
        existingKeys.add(`${b.account_id}|${b.source}|${normName(b.campaign_name)}`)
      }
      // Also add manually-excluded campaigns so they are never re-added
      for (const ex of excluded) {
        existingKeys.add(`${ex.account_id}|${ex.source}|${ex.campaign_name_norm}`)
      }

      // Detect campaigns in Windsor but not in budgets
      const toAdd: BudgetEntry[] = []
      const seen = new Set<string>()
      for (const wc of wCampaigns) {
        if (!wc.account_id) continue
        const acctKey = `${wc.account_id}|${wc.source}`
        if (!accountToClient.has(acctKey)) continue          // account not linked to any client
        const wcKey = `${wc.account_id}|${wc.source}|${normName(wc.campaign_name)}`
        if (existingKeys.has(wcKey) || seen.has(wcKey)) continue  // already exists
        seen.add(wcKey)
        const suffix = wc.source === 'facebook' ? 'fb' : 'gg'
        toAdd.push({
          campaign_id:   `auto_${suffix}_${wc.account_id.slice(-5)}_${Date.now()}_${toAdd.length}`,
          campaign_name: wc.campaign_name,
          client_name:   accountToClient.get(acctKey)!,
          source:        wc.source as Source,
          account_id:    wc.account_id,
          year, month,
          budget_total:  0,
          paused:        false,
        })
      }

      if (toAdd.length === 0) return

      // Persist to DB — only new entries, never touches existing ones
      await Promise.all(toAdd.map(e => fetch('/api/budgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(e),
      })))

      setBudgets(prev => [...prev, ...toAdd])

      // Mark as new in localStorage (24h badge)
      const stored: Record<string, number> = JSON.parse(localStorage.getItem('brote_new_campaigns') ?? '{}')
      const now = Date.now()
      for (const e of toAdd) stored[e.campaign_id] = now
      localStorage.setItem('brote_new_campaigns', JSON.stringify(stored))
      setNewCampaignIds(prev => new Set([...prev, ...toAdd.map(e => e.campaign_id)]))

      // Show toast per new campaign
      const toasts = toAdd.map(e => ({ id: e.campaign_id, name: e.campaign_name, client: e.client_name }))
      setNewToasts(prev => [...prev, ...toasts])
      setTimeout(() => setNewToasts(prev => prev.filter(t => !toasts.some(x => x.id === t.id))), 7000)
    } catch { /* silent — background process */ }
  }, [year, month])

  // Run hourly in background
  useEffect(() => {
    const id = setInterval(checkNewCampaigns, 60 * 60 * 1000)
    return () => clearInterval(id)
  }, [checkNewCampaigns])

  useEffect(() => {
    const id = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 60) {
          syncCampaigns()
          return 3600
        }
        return prev - 60
      })
    }, 60000)
    return () => clearInterval(id)
  }, [syncCampaigns])

  const monthBudgets = budgets.filter((b) => b.year === year && b.month === month)

  const daysInMonth = new Date(year, month, 0).getDate()
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

  function isPendingClient(clientName: string, source: Source): boolean {
    const cb = monthBudgets.filter(b => b.client_name === clientName && b.source === source)
    return cb.length > 0 && cb.every(b => b.account_id === '__pending__')
  }

  function clientDotColor(clientName: string, source: Source): string {
    if (isPendingClient(clientName, source)) return 'bg-orange-400'
    const cb = monthBudgets.filter((b) => b.client_name === clientName && b.source === source && !b.paused)
    if (cb.length === 0) return 'bg-gray-600'
    const totalBudget = cb.reduce((s, b) => s + b.budget_total, 0)
    const totalSpend = cb.reduce((s, b) => s + campaignSpend(b, monthBudgets, accounts, windsorCampaigns, windsorAdsets), 0)
    const pct = totalBudget > 0 ? (totalSpend / totalBudget) * 100 : 0
    if (Math.abs(pct - pctExpected) <= 5) return 'bg-green-500'
    if (pct > pctExpected + 5) return 'bg-red-500'
    return 'bg-amber-400'
  }

  const {
    clientBudgets,
    activeBudgets,
    pausedBudgets,
    allCampaigns,
    clientSummary,
  } = useMemo(() => {
    const clientBudgets = selected
      ? deduplicateBudgets(monthBudgets.filter((b) => b.client_name === selected.client && b.source === selected.source))
      : []
    const activeBudgets = clientBudgets.filter((b) => !b.paused && b.campaign_name !== '__auto__')
    const pausedBudgets = clientBudgets.filter((b) =>  b.paused && b.campaign_name !== '__auto__')
    const allCampaigns  = clientBudgets.filter((b) => b.campaign_name !== '__auto__')

    const clientSummary = clientBudgets.filter(b => b.campaign_name !== '__auto__').reduce(
      (acc, b) => {
        const spend = campaignSpend(b, monthBudgets, accounts, windsorCampaigns, windsorAdsets)
        const cf = calcCashflow(b.budget_total, spend, year, month)
        acc.budget += cf.budgetTotal
        acc.spend += cf.spendToDate
        if (!b.paused) acc.daily += Math.max(cf.dailyRecommended, 0)
        return acc
      },
      { budget: 0, spend: 0, daily: 0 }
    )

    return { clientBudgets, activeBudgets, pausedBudgets, allCampaigns, clientSummary }
  }, [monthBudgets, selected, accounts, windsorCampaigns, windsorAdsets, year, month])

  const currentDailyRate = daysPassed > 0 ? clientSummary.spend / daysPassed : 0
  const projectedEOM = currentDailyRate * daysInMonth
  const isOverspending = clientSummary.budget > 0 && clientSummary.spend > clientSummary.budget
  const projectionExceeds = clientSummary.budget > 0 && projectedEOM > clientSummary.budget * 1.05

  const handleSave = useCallback(async (entry: BudgetEntry) => {
    await fetch('/api/budgets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    })
    appCache.invalidate('budgets')
    setBudgets((prev) => {
      const idx = prev.findIndex(
        (b) => b.campaign_id === entry.campaign_id && b.year === entry.year && b.month === entry.month
      )
      if (idx >= 0) { const next = [...prev]; next[idx] = entry; return next }
      return [...prev, entry]
    })
    setModal(null)
  }, [])


  const handleDelete = useCallback(async (entry: BudgetEntry) => {
    // Delete the budget entry for this month
    await fetch('/api/budgets', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaign_id: entry.campaign_id, year, month }),
    })
    // Add to excluded list so the hourly sync never re-adds it
    await fetch('/api/excluded-campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        account_id:        entry.account_id,
        source:            entry.source,
        campaign_name:     entry.campaign_name,
        campaign_name_norm: normName(entry.campaign_name),
      }),
    })
    appCache.invalidate('budgets')
    setBudgets((prev) =>
      prev.filter((b) => !(b.campaign_id === entry.campaign_id && b.year === year && b.month === month))
    )
    setCampaignDeleteConfirm(null)
  }, [year, month])

  const deleteClient = useCallback(async (clientName: string, source: Source) => {
    await fetch('/api/clients', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_name: clientName, source }),
    })
    appCache.invalidate('budgets')
    setBudgets(prev => prev.filter(b => !(b.client_name === clientName && b.source === source)))
    if (selected?.client === clientName && selected?.source === source) setSelected(null)
    setDeleteConfirm(null)
  }, [selected])

  const handlePause = useCallback(async (entry: BudgetEntry) => {
    const updated = { ...entry, paused: !entry.paused }
    await fetch('/api/budgets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    })
    appCache.invalidate('budgets')
    setBudgets((prev) => prev.map((b) =>
      b.campaign_id === entry.campaign_id && b.year === year && b.month === month ? updated : b
    ))
  }, [year, month])

  const handleSpendOverride = useCallback(async (entry: BudgetEntry, val: number | null) => {
    const updated = { ...entry, spend_override: val }
    await fetch('/api/budgets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    })
    appCache.invalidate('budgets')
    setBudgets((prev) => prev.map((b) =>
      b.campaign_id === entry.campaign_id && b.year === entry.year && b.month === entry.month ? updated : b
    ))
  }, [])

  const handleTotalSave = useCallback(async () => {
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
    appCache.invalidate('budgets')
    setBudgets((prev) => prev.map((b) => {
      const u = updated.find((u) => u.campaign_id === b.campaign_id && u.year === b.year && u.month === b.month)
      return u ?? b
    }))
    setEditingTotal(false)
  }, [activeBudgets, totalInput])

  function getClientAccountId(clientName: string, source: Source): string {
    return monthBudgets.find((b) => b.client_name === clientName && b.source === source)?.account_id ?? ''
  }

  const metaClients   = useMemo(() => getClients('facebook'), [monthBudgets]) // eslint-disable-line react-hooks/exhaustive-deps
  const googleClients = useMemo(() => getClients('google'),   [monthBudgets]) // eslint-disable-line react-hooks/exhaustive-deps

  function ClientList({ source, clients, color }: { source: Source; clients: string[]; color: string }) {
    return (
      <div className="space-y-0.5">
        {clients.map((client) => {
          const isSelected = selected?.client === client && selected?.source === source
          const campaigns  = monthBudgets.filter(e => e.client_name === client && e.source === source)
          const pending    = campaigns.length > 0 && campaigns.every(e => e.account_id === '__pending__')
          const allPaused  = !pending && campaigns.length > 0 && campaigns.every(e => e.paused)
          return (
            <div key={client} className="group/row relative">
              <button
                onClick={() => { setSelected({ client, source }); setEditingTotal(false) }}
                className={`w-full flex items-center gap-2.5 pl-3 pr-7 py-2 rounded-lg text-sm text-left transition ${
                  isSelected ? `${color} text-white font-semibold` : allPaused ? 'text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-[#252525]' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#252525]'
                }`}
              >
                <span className={`w-2 h-2 rounded-full shrink-0 ${isSelected ? 'bg-white/60' : clientDotColor(client, source)}`} />
                <span className="flex-1 truncate">{client}</span>
                {pending && !isSelected && (
                  <span className="text-[9px] font-semibold text-orange-500 bg-orange-500/10 px-1.5 py-0.5 rounded shrink-0">PENDIENTE</span>
                )}
                {allPaused && !isSelected && (
                  <span className="text-[9px] font-semibold text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-[#2a2a2a] px-1 py-0.5 rounded shrink-0">PAUSA</span>
                )}
              </button>
              {canEdit && (
                <button
                  onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ clientName: client, source }) }}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded opacity-0 group-hover/row:opacity-100 text-gray-400 hover:text-rose-500 hover:bg-rose-500/10 transition-all"
                  title="Eliminar cliente"
                >
                  <Trash2 size={11} />
                </button>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  const platformLabel = selected?.source === 'facebook' ? 'Meta Ads' : 'Google Ads'
  const platformBadgeColor = selected?.source === 'facebook' ? 'bg-[#1877F2]' : 'bg-[#4285F4]'

  return (
    <div>
      {/* Delete client confirmation modal */}
      {campaignDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setCampaignDeleteConfirm(null)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative bg-white dark:bg-[#161616] border border-gray-200 dark:border-[#2a2a2a] rounded-2xl shadow-2xl p-6 w-full max-w-sm"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-1">¿Eliminar campaña?</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-5">
              Se eliminará <span className="font-semibold text-gray-700 dark:text-gray-300">{campaignDeleteConfirm.campaign_name}</span> y no volverá a aparecer aunque Windsor la detecte. Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setCampaignDeleteConfirm(null)}
                className="flex-1 py-2 rounded-xl text-xs font-semibold text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-[#252525] hover:bg-gray-200 dark:hover:bg-[#2d2d2d] transition"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(campaignDeleteConfirm)}
                className="flex-1 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setDeleteConfirm(null)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative bg-white dark:bg-[#161616] border border-gray-200 dark:border-[#2a2a2a] rounded-2xl shadow-2xl p-6 w-full max-w-sm"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-1">¿Eliminar cliente?</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-5">
              Se eliminará <span className="font-semibold text-gray-700 dark:text-gray-300">{deleteConfirm.clientName}</span> de cashflow, objetivos y todos los registros históricos. Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-2 rounded-xl text-xs font-semibold text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-[#252525] hover:bg-gray-200 dark:hover:bg-[#2d2d2d] transition"
              >
                Cancelar
              </button>
              <button
                onClick={() => deleteClient(deleteConfirm.clientName, deleteConfirm.source)}
                className="flex-1 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Control de Cashflow</h1>
          <p className="text-gray-500 text-sm mt-1.5">
            Día {daysPassed} de {daysInMonth} · Consumo ideal: {pctExpected.toFixed(0)}% · {MONTHS[month - 1]} {year}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            className="border border-gray-200 dark:border-white/[0.08] rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-[#161616] text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all duration-150 cursor-pointer shadow-sm dark:shadow-none"
            value={month}
            onChange={(e) => { setMonth(Number(e.target.value)); setSelected(null) }}
          >
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select
            className="border border-gray-200 dark:border-white/[0.08] rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-[#161616] text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all duration-150 cursor-pointer shadow-sm dark:shadow-none"
            value={year}
            onChange={(e) => { setYear(Number(e.target.value)); setSelected(null) }}
          >
            {[2025, 2026, 2027].map((y) => <option key={y}>{y}</option>)}
          </select>
          <div className="flex items-center gap-1.5 text-xs text-gray-500 border border-gray-200 dark:border-white/[0.08] rounded-xl px-3 py-2.5 bg-white dark:bg-[#161616] font-mono tabular-nums shadow-sm dark:shadow-none" title="Próxima sincronización automática">
            <Clock size={12} className="shrink-0" />
            {formatCountdown(countdown)}
          </div>
          <button
            onClick={() => { fetchData(true); setCountdown(3600) }}
            disabled={loading}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 shadow-sm disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Sincronizar
          </button>
        </div>
      </div>

      {carryoverInfo && (
        <div className="flex items-center justify-between gap-3 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 text-blue-700 dark:text-blue-300 rounded-xl px-4 py-2.5 mb-4 text-sm">
          <span>
            <span className="font-semibold">{carryoverInfo.count} entradas</span> importadas automáticamente desde {MONTHS[carryoverInfo.fromMonth - 1]} · Podés editar los presupuestos para este mes.
          </span>
          <button onClick={() => setCarryoverInfo(null)} className="shrink-0 text-blue-400 hover:text-blue-600 dark:hover:text-blue-200 text-lg leading-none">×</button>
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-500/15 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 rounded-xl p-3 mb-4 text-sm">{error}</div>
      )}

      <div className="flex gap-5">
        {/* Sidebar */}
        <div className="w-48 shrink-0 space-y-4">

          {loading ? (
            <div className="space-y-1.5">
              {[1,2,3,4,5,6].map((i) => <div key={i} className="h-9 bg-gray-100 dark:bg-[#252525] rounded-lg animate-pulse" />)}
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
                </div>
                {metaClients.length > 0
                  ? <ClientList source="facebook" clients={metaClients} color="bg-[#1877F2]" />
                  : <p className="text-xs text-gray-500 px-3">Sin clientes</p>
                }
              </div>

              {/* Divider */}
              <div className="border-t border-gray-200 dark:border-[#2a2a2a]" />

              {/* Google Ads section */}
              <div>
                <div className="flex items-center justify-between mb-1.5 px-1">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#4285F4]" />
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Google Ads</p>
                  </div>
                </div>
                {googleClients.length > 0
                  ? <ClientList source="google" clients={googleClients} color="bg-[#4285F4]" />
                  : <p className="text-xs text-gray-500 px-3">Sin clientes</p>
                }
              </div>
            </>
          )}
        </div>

        {/* Main panel */}
        <div className="flex-1 min-w-0">
          {loading && (
            <div className="space-y-3">
              {[1,2,3].map((i) => <div key={i} className="h-20 bg-gray-100 dark:bg-[#1a1a1a] rounded-xl border border-gray-200 dark:border-[#2a2a2a] animate-pulse" />)}
            </div>
          )}

          {!loading && selected && isPendingClient(selected.client, selected.source) && (
            <PendingClientPanel
              client={selected.client}
              source={selected.source}
              windsorCampaigns={windsorCampaigns}
              year={year}
              month={month}
              onResolved={(entries) => {
                const pendingIds = monthBudgets
                  .filter(b => b.client_name === selected.client && b.source === selected.source && b.account_id === '__pending__')
                  .map(b => b.campaign_id)
                Promise.all([
                  ...entries.map(e => fetch('/api/budgets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(e) })),
                  ...pendingIds.map(id => fetch('/api/budgets', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ campaign_id: id, year, month }) })),
                ])
                setBudgets(prev => [...prev.filter(b => !pendingIds.includes(b.campaign_id)), ...entries])
              }}
            />
          )}

          {!loading && selected && !isPendingClient(selected.client, selected.source) && (
            <>
              {isOverspending && (
                <div className="flex items-center gap-2 bg-red-500/15 border border-red-500/30 text-red-400 rounded-xl px-4 py-2.5 mb-4 text-sm">
                  <AlertTriangle size={15} className="shrink-0" />
                  <span><strong>¡Atención!</strong> El gasto ya superó el presupuesto total del mes.</span>
                </div>
              )}
              {!isOverspending && projectionExceeds && (
                <div className="flex items-center gap-2 bg-amber-500/15 border border-amber-500/30 text-amber-400 rounded-xl px-4 py-2.5 mb-4 text-sm">
                  <AlertTriangle size={15} className="shrink-0" />
                  <span>Al ritmo actual, la proyección al cierre es <strong>{currency(projectedEOM)}</strong> — podría superar el presupuesto.</span>
                </div>
              )}

              {/* Summary cards */}
              {allCampaigns.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                  <div className="bg-white dark:bg-[#111111] rounded-2xl border border-gray-100 dark:border-white/[0.06] px-5 py-4 shadow-sm">
                    <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">Presupuesto total</p>
                    {editingTotal ? (
                      <div className="flex items-center gap-1 mt-0.5">
                        <input
                          autoFocus
                          type="text"
                          value={totalInput}
                          onChange={(e) => setTotalInput(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleTotalSave(); if (e.key === 'Escape') setEditingTotal(false) }}
                          className="w-full text-sm font-bold bg-gray-50 dark:bg-[#252525] border border-blue-500/60 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-gray-900 dark:text-gray-100 tabular-nums"
                        />
                        <button onClick={handleTotalSave} className="text-blue-400 text-xs font-semibold hover:text-blue-300 shrink-0">OK</button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <p className="text-xl font-bold text-gray-900 dark:text-white tabular-nums tracking-tight">{currency(clientSummary.budget)}</p>
                        {canEdit && (
                          <button
                            onClick={() => { setTotalInput(String(clientSummary.budget)); setEditingTotal(true) }}
                            className="text-gray-600 hover:text-gray-400 transition mt-0.5"
                            title="Editar presupuesto total"
                          >
                            <Pencil size={11} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="bg-white dark:bg-[#111111] rounded-2xl border border-gray-100 dark:border-white/[0.06] px-5 py-4 shadow-sm">
                    <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">Gasto acumulado</p>
                    <p className="text-xl font-bold text-gray-900 dark:text-white tabular-nums tracking-tight">{currency(clientSummary.spend)}</p>
                    {clientSummary.budget > 0 && (
                      <p className="text-xs text-gray-500 mt-1.5 tabular-nums">{((clientSummary.spend / clientSummary.budget) * 100).toFixed(1)}% del total</p>
                    )}
                  </div>
                  <div className="bg-white dark:bg-[#111111] rounded-2xl border border-gray-100 dark:border-white/[0.06] px-5 py-4 shadow-sm">
                    <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">Ritmo actual</p>
                    <p className="text-xl font-bold text-gray-900 dark:text-white tabular-nums tracking-tight">{currency(currentDailyRate)}<span className="text-xs font-normal text-gray-400 dark:text-gray-500 ml-0.5">/día</span></p>
                    <p className="text-xs text-gray-500 mt-1.5 tabular-nums">Proyección: {currency(projectedEOM)}</p>
                  </div>
                  <div className="bg-blue-600/10 rounded-2xl border border-blue-500/20 px-5 py-4 shadow-sm">
                    <p className="text-[11px] font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wider mb-2">Diario recomendado</p>
                    <p className="text-xl font-bold text-blue-700 dark:text-blue-300 tabular-nums tracking-tight">
                      {currency(clientSummary.daily)}<span className="text-xs font-normal text-blue-600/70 dark:text-blue-400/70 ml-0.5">/día</span>
                    </p>
                    <p className="text-xs text-blue-600/60 dark:text-blue-400/60 mt-1.5">{daysInMonth - daysPassed + 1}d restantes</p>
                  </div>
                </div>
              )}

              {/* Section header */}
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full text-white ${platformBadgeColor}`}>
                    {platformLabel}
                  </span>
                  <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{selected.client}</span>
                  <span className="text-xs text-gray-400 dark:text-gray-400">
                    {activeBudgets.length} activa{activeBudgets.length !== 1 ? 's' : ''}
                    {pausedBudgets.length > 0 && ` · ${pausedBudgets.length} pausada${pausedBudgets.length !== 1 ? 's' : ''}`}
                  </span>
                </div>
                {canEdit && (
                  <button
                    onClick={() => setModal({
                      entry: null,
                      clientName: selected.client,
                      accountId: getClientAccountId(selected.client, selected.source),
                      source: selected.source,
                    })}
                    className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 font-medium bg-blue-600/15 hover:bg-blue-600/25 px-3 py-1.5 rounded-lg transition"
                  >
                    <Plus size={12} />
                    Agregar campaña
                  </button>
                )}
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
                      isNew={newCampaignIds.has(b.campaign_id)}
                      onEdit={() => setModal({ entry: b, clientName: b.client_name, accountId: b.account_id, source: b.source as Source })}
                      onDelete={() => setCampaignDeleteConfirm(b)}
                      onPause={() => handlePause(b)}
                      onSpendOverride={(val) => handleSpendOverride(b, val)}
                    />
                  )
                })}
              </div>

              {/* Totals footer */}
              {allCampaigns.length >= 2 && (
                <div className="bg-gray-50 dark:bg-[#252525] border border-gray-200 dark:border-[#2a2a2a] rounded-xl px-4 py-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm mb-4">
                  <div>
                    <p className="text-xs text-gray-400 dark:text-gray-400 mb-0.5">Total presupuesto</p>
                    <p className="font-bold text-gray-800 dark:text-gray-200">{currency(clientSummary.budget)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">Total gastado</p>
                    <p className="font-bold text-gray-800 dark:text-gray-200">{currency(clientSummary.spend)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">Restante</p>
                    <p className={`font-bold ${clientSummary.budget - clientSummary.spend < 0 ? 'text-red-500' : 'text-gray-800 dark:text-gray-200'}`}>
                      {currency(clientSummary.budget - clientSummary.spend)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">Diario total</p>
                    <p className="font-bold text-gray-800 dark:text-gray-200">{currency(clientSummary.daily)}/día</p>
                  </div>
                </div>
              )}

              {/* Paused campaigns */}
              {pausedBudgets.length > 0 && (
                <>
                  <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1.5 px-1">Pausadas</p>
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
                          onDelete={() => setCampaignDeleteConfirm(b)}
                          onPause={() => handlePause(b)}
                          onSpendOverride={(val) => handleSpendOverride(b, val)}
                        />
                      )
                    })}
                  </div>
                </>
              )}

              {clientBudgets.length === 0 && (
                <div className="flex flex-col items-center justify-center h-40 text-gray-400 dark:text-gray-500 text-sm border border-dashed border-gray-200 dark:border-[#2a2a2a] rounded-xl bg-gray-50 dark:bg-[#141414]">
                  <p>Sin campañas configuradas</p>
                  <button
                    onClick={() => setModal({
                      entry: null,
                      clientName: selected.client,
                      accountId: getClientAccountId(selected.client, selected.source),
                      source: selected.source,
                    })}
                    className="mt-2 text-blue-400 hover:text-blue-300 font-medium text-xs"
                  >
                    Agregar primera campaña
                  </button>
                </div>
              )}
            </>
          )}

          {!loading && !selected && (
            <div className="flex items-center justify-center h-48 text-gray-400 dark:text-gray-500 text-sm">
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


      {/* New campaign toasts — bottom right, auto-dismiss 7s */}
      {newToasts.length > 0 && (
        <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 items-end pointer-events-none">
          {newToasts.map(t => (
            <div
              key={t.id}
              className="pointer-events-auto bg-[#0f0f0f] border border-emerald-500/25 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-start gap-3 w-[290px] animate-in slide-in-from-right-4 fade-in duration-300"
            >
              <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 mt-1.5" />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold text-emerald-400 mb-0.5 flex items-center gap-1">
                  <Sparkles size={10} /> Nueva campaña detectada
                </p>
                <p className="text-sm font-bold text-white truncate">{t.name}</p>
                <p className="text-xs text-gray-400">{t.client}</p>
              </div>
              <button
                onClick={() => setNewToasts(prev => prev.filter(x => x.id !== t.id))}
                className="text-gray-500 hover:text-gray-300 transition shrink-0 mt-0.5"
              >
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
