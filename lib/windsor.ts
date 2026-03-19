import type { AccountData } from './types'

const WINDSOR_BASE = 'https://connectors.windsor.ai/all'

interface RawRecord {
  campaign_id: string
  account_id: string
  account_name: string
  source: string
  spend: number | null
  date: string
}

export type { AccountData }

async function fetchAccounts(
  year: number,
  month: number,
  sourceFilter: string
): Promise<AccountData[]> {
  const apiKey = process.env.WINDSOR_API_KEY
  if (!apiKey) throw new Error('WINDSOR_API_KEY no configurada')

  const dateFrom = `${year}-${String(month).padStart(2, '0')}-01`
  const today = new Date()
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth() + 1
  const dateTo = isCurrentMonth
    ? today.toISOString().split('T')[0]
    : new Date(year, month, 0).toISOString().split('T')[0]

  const sevenDaysAgo = new Date(today)
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const recentFrom = sevenDaysAgo.toISOString().split('T')[0]

  const url = new URL(WINDSOR_BASE)
  url.searchParams.set('api_key', apiKey)
  url.searchParams.set('date_from', dateFrom)
  url.searchParams.set('date_to', dateTo)
  url.searchParams.set('fields', 'campaign_id,account_id,account_name,source,spend,date')
  url.searchParams.set('_renderer', 'json')

  const res = await fetch(url.toString(), { cache: 'no-store' })
  if (!res.ok) throw new Error(`Windsor error ${res.status}`)

  const json = await res.json()
  const records: RawRecord[] = json.data ?? []

  const filtered = records.filter((r) => r.source === sourceFilter)

  const map = new Map<string, AccountData>()
  const campaignSets = new Map<string, Set<string>>()

  for (const r of filtered) {
    if (!r.account_id) continue
    if (!map.has(r.account_id)) {
      map.set(r.account_id, {
        account_id: r.account_id,
        account_name: r.account_name ?? r.account_id,
        source: sourceFilter,
        spend: 0,
        recent_spend: 0,
        campaign_count: 0,
      })
      campaignSets.set(r.account_id, new Set())
    }
    const entry = map.get(r.account_id)!
    const amt = r.spend ?? 0
    entry.spend += amt
    if (r.date >= recentFrom) entry.recent_spend += amt
    campaignSets.get(r.account_id)!.add(r.campaign_id)
  }

  for (const [accId, set] of Array.from(campaignSets.entries())) {
    const entry = map.get(accId)
    if (entry) entry.campaign_count = set.size
  }

  return Array.from(map.values()).sort((a, b) => b.spend - a.spend)
}

export async function fetchWindsorAccounts(year: number, month: number): Promise<AccountData[]> {
  const [meta, google] = await Promise.all([
    fetchAccounts(year, month, 'facebook'),
    fetchAccounts(year, month, 'google'),
  ])
  return [...meta, ...google]
}
