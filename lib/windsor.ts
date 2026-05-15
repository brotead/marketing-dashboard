import type { AccountData, CampaignSpend, AdCreative, FatigueAd, FatigueSignal } from './types'
import { getMetaDirectIdsFull, fetchMetaMonthlyAccounts } from './meta'

const WINDSOR_FACEBOOK  = 'https://connectors.windsor.ai/facebook'
const WINDSOR_GOOGLE    = 'https://connectors.windsor.ai/google_ads'
const WINDSOR_INSTAGRAM = 'https://connectors.windsor.ai/instagram'

// ── In-memory cache (1h TTL) ────────────────────────────────────────────────────
interface WindsorCached {
  accounts:  AccountData[]
  campaigns: CampaignSpend[]
  adsets:    CampaignSpend[]
}
const _windsorCache = new Map<string, { data: WindsorCached; ts: number }>()
const WINDSOR_TTL = 60 * 60 * 1000 // 1 hour

interface RawRecord {
  campaign_id: string
  campaign_name: string | null
  adset_id?: string | null
  adset_name?: string | null
  account_id: string
  account_name: string
  source: string
  spend: number | null
  date: string
}

export type { AccountData }

interface AccountFetchResult {
  accounts: AccountData[]
  campaigns: CampaignSpend[]   // campaign-level aggregation
  adsets:    CampaignSpend[]   // adset-level aggregation
}

async function fetchAccounts(
  year: number,
  month: number,
  connectorUrl: string,
  sourceLabel: string
): Promise<AccountFetchResult> {
  const apiKey = process.env.WINDSOR_API_KEY
  if (!apiKey) throw new Error('WINDSOR_API_KEY no configurada')

  const dateFrom = `${year}-${String(month).padStart(2, '0')}-01`
  const today = new Date()
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth() + 1
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  // Show spend through yesterday to avoid partial-day figures.
  // On the 1st of the month yesterday is still in the previous month, so fall back to today.
  const dateTo = isCurrentMonth
    ? yesterday.toISOString().split('T')[0]
    : new Date(year, month, 0).toISOString().split('T')[0]

  const sevenDaysAgo = new Date(today)
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const recentFrom = sevenDaysAgo.toISOString().split('T')[0]

  const url = new URL(connectorUrl)
  url.searchParams.set('api_key', apiKey)
  url.searchParams.set('date_from', dateFrom)
  url.searchParams.set('date_to', dateTo)
  const isFacebook = connectorUrl === WINDSOR_FACEBOOK
  const fields = isFacebook
    ? 'campaign_id,campaign_name,adset_id,adset_name,account_id,account_name,source,spend,date'
    : 'campaign_id,campaign_name,account_id,account_name,source,spend,date'
  url.searchParams.set('fields', fields)
  url.searchParams.set('_renderer', 'json')

  const res = await fetch(url.toString(), { cache: 'no-store' })
  if (!res.ok) throw new Error(`Windsor error ${res.status}`)

  const json = await res.json()
  const records: RawRecord[] = json.data ?? []

  const filtered = records.filter((r) => r.source === sourceLabel)

  const map = new Map<string, AccountData>()
  const campaignSets = new Map<string, Set<string>>()

  for (const r of filtered) {
    if (!r.account_id) continue
    if (!map.has(r.account_id)) {
      map.set(r.account_id, {
        account_id: r.account_id,
        account_name: r.account_name ?? r.account_id,
        source: sourceLabel,
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

  // Campaign-level aggregation (for clients where Supabase campaigns = Meta campaigns)
  const campaignMap = new Map<string, CampaignSpend>()
  // Adset-level aggregation (for clients where Supabase campaigns = Meta ad sets)
  const adsetMap = new Map<string, CampaignSpend>()

  for (const r of filtered) {
    if (!r.account_id || !r.campaign_id) continue

    // Campaign level
    const campKey = `${r.account_id}|${r.campaign_id}`
    if (!campaignMap.has(campKey)) {
      campaignMap.set(campKey, {
        account_id:    r.account_id,
        source:        sourceLabel,
        campaign_name: r.campaign_name ?? '',
        spend:         0,
        today_spend:   0,
      })
    }
    const campEntry = campaignMap.get(campKey)!
    campEntry.spend += r.spend ?? 0
    if (r.date === dateTo) campEntry.today_spend = (campEntry.today_spend ?? 0) + (r.spend ?? 0)

    // Adset level (only when Windsor returns adset data)
    if (r.adset_id) {
      const adsetKey = `${r.account_id}|${r.adset_id}`
      if (!adsetMap.has(adsetKey)) {
        adsetMap.set(adsetKey, {
          account_id:    r.account_id,
          source:        sourceLabel,
          campaign_name: r.campaign_name ?? '',
          adset_name:    r.adset_name ?? undefined,
          spend:         0,
          today_spend:   0,
        })
      }
      const adsetEntry = adsetMap.get(adsetKey)!
      adsetEntry.spend += r.spend ?? 0
      if (r.date === dateTo) adsetEntry.today_spend = (adsetEntry.today_spend ?? 0) + (r.spend ?? 0)
    }
  }

  return {
    accounts:  Array.from(map.values()).sort((a, b) => b.spend - a.spend),
    campaigns: Array.from(campaignMap.values()),
    adsets:    Array.from(adsetMap.values()),
  }
}

// ── Conversations (Mensajes) per Facebook account ──────────────────────────────
export async function fetchConversationsByAccount(
  year: number,
  month: number
): Promise<Record<string, number>> {
  const apiKey = process.env.WINDSOR_API_KEY
  if (!apiKey) throw new Error('WINDSOR_API_KEY no configurada')

  const dateFrom = `${year}-${String(month).padStart(2, '0')}-01`
  const today = new Date()
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth() + 1
  const dateTo = isCurrentMonth
    ? today.toISOString().split('T')[0]
    : new Date(year, month, 0).toISOString().split('T')[0]

  const url = new URL(WINDSOR_FACEBOOK)
  url.searchParams.set('api_key', apiKey)
  url.searchParams.set('date_from', dateFrom)
  url.searchParams.set('date_to', dateTo)
  url.searchParams.set('fields', 'account_id,actions')
  url.searchParams.set('_renderer', 'json')

  const res = await fetch(url.toString(), { cache: 'no-store' })
  if (!res.ok) throw new Error(`Windsor Facebook error ${res.status}`)

  const json = await res.json()
  const records: { account_id: string; actions?: { action_type: string; value: string }[] }[] =
    json.data ?? []

  const result: Record<string, number> = {}
  for (const r of records) {
    if (!r.account_id) continue
    const conv = r.actions?.find(
      (a) => a.action_type === 'onsite_conversion.messaging_conversation_started_7d'
    )
    if (conv) result[r.account_id] = (result[r.account_id] ?? 0) + Number(conv.value)
  }
  return result
}

// ── Instagram current followers ─────────────────────────────────────────────────
export interface IgFollowerEntry {
  account_id: string
  account_name: string
  followers_count: number
}

export async function fetchIgFollowersCurrent(): Promise<IgFollowerEntry[]> {
  const apiKey = process.env.WINDSOR_API_KEY
  if (!apiKey) throw new Error('WINDSOR_API_KEY no configurada')

  const today = new Date().toISOString().split('T')[0]
  const url = new URL(WINDSOR_INSTAGRAM)
  url.searchParams.set('api_key', apiKey)
  url.searchParams.set('date_from', today)
  url.searchParams.set('date_to', today)
  url.searchParams.set('fields', 'account_id,account_name,followers_count')
  url.searchParams.set('_renderer', 'json')

  const res = await fetch(url.toString(), { cache: 'no-store' })
  if (!res.ok) throw new Error(`Windsor Instagram error ${res.status}`)

  const json = await res.json()
  return (json.data ?? []).map((r: Record<string, unknown>) => ({
    account_id: String(r.account_id ?? ''),
    account_name: String(r.account_name ?? ''),
    followers_count: Number(r.followers_count) || 0,
  }))
}

// ── Ad creatives (ad-level daily breakdown) ─────────────────────────────────────
export async function fetchAdCreatives(year: number, month: number): Promise<AdCreative[]> {
  const apiKey = process.env.WINDSOR_API_KEY
  if (!apiKey) throw new Error('WINDSOR_API_KEY no configurada')

  const dateFrom = `${year}-${String(month).padStart(2, '0')}-01`
  const today = new Date()
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth() + 1
  const dateTo = isCurrentMonth
    ? today.toISOString().split('T')[0]
    : new Date(year, month, 0).toISOString().split('T')[0]

  const url = new URL(WINDSOR_FACEBOOK)
  url.searchParams.set('api_key', apiKey)
  url.searchParams.set('date_from', dateFrom)
  url.searchParams.set('date_to', dateTo)
  url.searchParams.set('fields', 'ad_id,ad_name,campaign_name,account_id,spend,clicks,impressions,actions,date')
  url.searchParams.set('_renderer', 'json')

  const res = await fetch(url.toString(), { cache: 'no-store' })
  if (!res.ok) throw new Error(`Windsor Facebook error ${res.status}`)

  const json = await res.json()
  const records: {
    ad_id?: string
    ad_name?: string
    campaign_name?: string
    account_id?: string
    spend?: number | null
    clicks?: number | null
    impressions?: number | null
    actions?: { action_type: string; value: string }[]
    date?: string
  }[] = json.data ?? []

  interface AdAgg {
    ad_id: string
    ad_name: string
    campaign_name: string
    account_id: string
    spend: number
    clicks: number
    impressions: number
    mensajes: number
    dates: Set<string>
    first_date: string
    last_date: string
  }

  const map = new Map<string, AdAgg>()

  for (const r of records) {
    if (!r.ad_id || !r.account_id) continue
    const spend = r.spend ?? 0
    if (spend <= 0) continue

    if (!map.has(r.ad_id)) {
      map.set(r.ad_id, {
        ad_id: r.ad_id,
        ad_name: r.ad_name ?? r.ad_id,
        campaign_name: r.campaign_name ?? '',
        account_id: r.account_id,
        spend: 0,
        clicks: 0,
        impressions: 0,
        mensajes: 0,
        dates: new Set(),
        first_date: r.date ?? dateTo,
        last_date: r.date ?? dateFrom,
      })
    }

    const agg = map.get(r.ad_id)!
    agg.spend += spend
    agg.clicks += r.clicks ?? 0
    agg.impressions += r.impressions ?? 0

    const conv = r.actions?.find(
      (a) => a.action_type === 'onsite_conversion.messaging_conversation_started_7d'
    )
    if (conv) agg.mensajes += Number(conv.value)

    if (r.date) {
      agg.dates.add(r.date)
      if (r.date < agg.first_date) agg.first_date = r.date
      if (r.date > agg.last_date) agg.last_date = r.date
    }
  }

  const todayStr = today.toISOString().split('T')[0]

  return Array.from(map.values())
    .map((agg): AdCreative => {
      const days_active = agg.dates.size
      const ctr = agg.impressions > 0 ? (agg.clicks / agg.impressions) * 100 : 0
      const cpm = agg.impressions > 0 ? (agg.spend / agg.impressions) * 1000 : 0
      const cpr = agg.mensajes > 0 ? agg.spend / agg.mensajes : 0

      const firstDate = new Date(agg.first_date + 'T00:00:00')
      const refDate   = new Date(todayStr + 'T00:00:00')
      const daysSinceStart = Math.max(0, Math.floor((refDate.getTime() - firstDate.getTime()) / 86_400_000))

      let fatigue: AdCreative['fatigue']
      if (daysSinceStart >= 21 || (ctr < 0.5 && days_active >= 7)) {
        fatigue = 'fatigue'
      } else if (daysSinceStart >= 14) {
        fatigue = 'review'
      } else {
        fatigue = 'active'
      }

      return {
        ad_id: agg.ad_id,
        ad_name: agg.ad_name,
        campaign_name: agg.campaign_name,
        account_id: agg.account_id,
        spend: agg.spend,
        clicks: agg.clicks,
        impressions: agg.impressions,
        mensajes: agg.mensajes,
        first_date: agg.first_date,
        last_date: agg.last_date,
        days_active,
        ctr,
        cpm,
        cpr,
        fatigue,
      }
    })
    .sort((a, b) => b.spend - a.spend)
}

// ── Fatigue detector ────────────────────────────────────────────────────────────

interface RawAdPeriod {
  ad_id?: string
  ad_name?: string
  account_id?: string
  account_name?: string
  campaign_name?: string
  adset_name?: string
  thumbnail_url?: string | null
  spend?: string | number | null
  impressions?: string | number | null
  clicks?: string | number | null
  reach?: string | number | null
  actions?: { action_type: string; value: string }[]
}

interface AdPeriodAgg {
  ad_id: string
  ad_name: string
  account_id: string
  account_name: string
  campaign_name: string
  adset_name: string
  spend: number
  impressions: number
  clicks: number
  reach: number
  frequency: number  // computed as impressions / reach
  ctr: number        // computed as clicks / impressions * 100
  cpm: number        // computed as spend / impressions * 1000
  thumbnail_url: string | null
}


async function fetchAdPeriod(dateFrom: string, dateTo: string, allowedIds?: Set<string>): Promise<Map<string, AdPeriodAgg>> {
  const apiKey = process.env.WINDSOR_API_KEY
  if (!apiKey) throw new Error('WINDSOR_API_KEY no configurada')

  const url = new URL(WINDSOR_FACEBOOK)
  url.searchParams.set('api_key', apiKey)
  url.searchParams.set('date_from', dateFrom)
  url.searchParams.set('date_to', dateTo)
  // NOTE: do NOT include status fields (ad_effective_status, adset_effective_status) here.
  // Windsor treats every non-metric field as a GROUP BY dimension, so including status
  // creates multiple rows per ad (one per status change), making frequency uncomputable.
  // We compute frequency ourselves from reach/impressions for accuracy.
  url.searchParams.set('fields', 'ad_id,ad_name,account_id,account_name,campaign_name,adset_name,thumbnail_url,spend,impressions,clicks,reach,actions')
  url.searchParams.set('_renderer', 'json')

  const res = await fetch(url.toString(), { cache: 'no-store' })
  if (!res.ok) throw new Error(`Windsor error ${res.status}: ${await res.text()}`)

  const json = await res.json()
  const records: RawAdPeriod[] = json.data ?? []

  const map = new Map<string, AdPeriodAgg>()
  for (const r of records) {
    if (!r.ad_id) continue
    const spend = Number(r.spend ?? 0)
    if (spend <= 0) continue

    if (allowedIds && allowedIds.size > 0 && r.account_id && !allowedIds.has(r.account_id)) continue

    if (!map.has(r.ad_id)) {
      map.set(r.ad_id, {
        ad_id:        r.ad_id,
        ad_name:      r.ad_name      ?? r.ad_id,
        account_id:   r.account_id   ?? '',
        account_name: r.account_name ?? '',
        campaign_name:r.campaign_name ?? '',
        adset_name:   r.adset_name   ?? '',
        spend:         0,
        impressions:   0,
        clicks:        0,
        reach:         0,
        frequency:     0,
        ctr:           0,
        cpm:           0,
        thumbnail_url: r.thumbnail_url ?? null,
      })
    }
    const agg = map.get(r.ad_id)!
    agg.spend       += spend
    agg.impressions += Number(r.impressions ?? 0)
    agg.clicks      += Number(r.clicks ?? 0)
    agg.reach       += Number(r.reach ?? 0)
    if (!agg.thumbnail_url && r.thumbnail_url) agg.thumbnail_url = r.thumbnail_url
  }

  // Compute frequency, CTR and CPM from aggregated totals — always exact, never influenced
  // by partial-period rows. frequency = impressions / reach (Facebook's own definition).
  for (const agg of Array.from(map.values())) {
    agg.frequency = agg.reach > 0 ? agg.impressions / agg.reach : 0
    agg.ctr       = agg.impressions > 0 ? (agg.clicks / agg.impressions) * 100 : 0
    agg.cpm       = agg.impressions > 0 ? (agg.spend  / agg.impressions) * 1000 : 0
  }

  return map
}

export async function fetchFatigueAds(allowedAccountIds?: Set<string>): Promise<FatigueAd[]> {
  const today  = new Date()
  const d7     = new Date(today); d7.setDate(d7.getDate() - 7)
  const d14    = new Date(today); d14.setDate(d14.getDate() - 14)
  const d7minus1 = new Date(d7); d7minus1.setDate(d7minus1.getDate() - 1)
  const fmt = (d: Date) => d.toISOString().split('T')[0]

  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)

  const [recentMap, prevMap, monthMap] = await Promise.all([
    fetchAdPeriod(fmt(d7), fmt(today), allowedAccountIds),
    fetchAdPeriod(fmt(d14), fmt(d7minus1), allowedAccountIds),
    fetchAdPeriod(fmt(firstOfMonth), fmt(today), allowedAccountIds),
  ])

  const results: FatigueAd[] = []

  for (const [adId, recent] of Array.from(recentMap.entries())) {
    if (recent.spend < 5) continue   // filter ads without meaningful spend

    const prev = prevMap.get(adId) ?? null
    const signals: FatigueSignal[] = []

    // Signal 1: Frequency >= 3.5 (exact value from impressions/reach)
    if (recent.frequency >= 3.5) {
      signals.push({ type: 'frequency', label: 'Alta frecuencia', detail: `${recent.frequency.toFixed(1)}x` })
    }

    // Signal 2: CTR dropped > 35% vs previous 7-day period
    if (prev && prev.ctr > 0 && recent.ctr >= 0) {
      const drop = (prev.ctr - recent.ctr) / prev.ctr
      if (drop > 0.35) {
        signals.push({ type: 'ctr_drop', label: 'CTR cayó', detail: `-${(drop * 100).toFixed(0)}%` })
      }
    }

    // Signal 3: CPM rose > 25% vs previous 7-day period
    if (prev && prev.cpm > 0 && recent.cpm > 0) {
      const rise = (recent.cpm - prev.cpm) / prev.cpm
      if (rise > 0.25) {
        signals.push({ type: 'cpm_rise', label: 'CPM subió', detail: `+${(rise * 100).toFixed(0)}%` })
      }
    }

    const signal_count = signals.length
    const recommendation: FatigueAd['recommendation'] =
      signal_count >= 2 ? 'PAUSAR' : signal_count === 1 ? 'REVISAR' : 'ACTIVO'

    results.push({
      ad_id:             adId,
      ad_name:           recent.ad_name,
      account_name:      recent.account_name,
      campaign_name:     recent.campaign_name,
      adset_name:        recent.adset_name,
      spend_recent:      recent.spend,
      impressions_recent:recent.impressions,
      frequency_recent:  recent.frequency,
      ctr_recent:        recent.ctr,
      cpm_recent:        recent.cpm,
      conversions_recent:0,
      ctr_prev:          prev?.ctr ?? 0,
      cpm_prev:          prev?.cpm ?? 0,
      cpa_prev:          0,
      cpa_recent:        0,
      signals,
      signal_count,
      recommendation,
      spend_projection: recent.spend,
      spend_month: monthMap.get(adId)?.spend ?? recent.spend,
      thumbnail_url: recent.thumbnail_url ?? null,
    })
  }

  // Sort: most signals first, then by spend
  results.sort((a, b) => b.signal_count - a.signal_count || b.spend_recent - a.spend_recent)

  return results
}

// ── Account discovery: last 90 days, returns every connected account ─────────────
// Windsor only returns rows when there is spend data, so a monthly fetch misses
// accounts that were inactive this month. This function does a lightweight pass
// over the last 90 days to discover ALL connected accounts, then merges them into
// the monthly results (spend=0 for accounts with no activity this month).
async function discoverAllAccounts(
  connectorUrl: string,
  sourceLabel: string
): Promise<Map<string, { account_id: string; account_name: string }>> {
  const apiKey = process.env.WINDSOR_API_KEY
  if (!apiKey) return new Map()

  const today = new Date()
  const from  = new Date(today)
  from.setDate(from.getDate() - 90)

  const url = new URL(connectorUrl)
  url.searchParams.set('api_key', apiKey)
  url.searchParams.set('date_from', from.toISOString().split('T')[0])
  url.searchParams.set('date_to', today.toISOString().split('T')[0])
  url.searchParams.set('fields', 'account_id,account_name,source,spend')
  url.searchParams.set('_renderer', 'json')

  try {
    const res = await fetch(url.toString(), { cache: 'no-store' })
    if (!res.ok) return new Map()
    const json = await res.json()
    const map = new Map<string, { account_id: string; account_name: string }>()
    for (const r of (json.data ?? []) as RawRecord[]) {
      if (r.source !== sourceLabel || !r.account_id || map.has(r.account_id)) continue
      map.set(r.account_id, {
        account_id:   r.account_id,
        account_name: r.account_name ?? r.account_id,
      })
    }
    return map
  } catch {
    return new Map()
  }
}

// ── Spend accounts ──────────────────────────────────────────────────────────────
const EMPTY_FETCH: AccountFetchResult = { accounts: [], campaigns: [], adsets: [] }

export async function fetchWindsorAccounts(
  year: number,
  month: number,
  force = false
): Promise<{ accounts: AccountData[]; campaigns: CampaignSpend[]; adsets: CampaignSpend[] }> {
  const key = `${year}-${month}`

  if (!force) {
    const cached = _windsorCache.get(key)
    if (cached && Date.now() - cached.ts < WINDSOR_TTL) return cached.data
  }

  const [meta, google, metaDiscovery, googleDiscovery] = await Promise.all([
    fetchAccounts(year, month, WINDSOR_FACEBOOK, 'facebook').catch((e) => {
      console.error('[Windsor] Facebook connector error (ignorado):', e.message)
      return EMPTY_FETCH
    }),
    fetchAccounts(year, month, WINDSOR_GOOGLE, 'google').catch((e) => {
      console.error('[Windsor] Google connector error (ignorado):', e.message)
      return EMPTY_FETCH
    }),
    discoverAllAccounts(WINDSOR_FACEBOOK, 'facebook').catch(() => new Map()),
    discoverAllAccounts(WINDSOR_GOOGLE,   'google'  ).catch(() => new Map()),
  ])

  // Merge discovery: add any account that has no spend this month (spend=0)
  const metaIds   = new Set(meta.accounts.map(a => a.account_id))
  const googleIds = new Set(google.accounts.map(a => a.account_id))

  for (const [id, d] of Array.from(metaDiscovery.entries())) {
    if (!metaIds.has(id)) {
      meta.accounts.push({ account_id: d.account_id, account_name: d.account_name, source: 'facebook', spend: 0, recent_spend: 0, campaign_count: 0 })
    }
  }
  for (const [id, d] of Array.from(googleDiscovery.entries())) {
    if (!googleIds.has(id)) {
      google.accounts.push({ account_id: d.account_id, account_name: d.account_name, source: 'google', spend: 0, recent_spend: 0, campaign_count: 0 })
    }
  }

  // Merge Meta-direct accounts (fetched from Meta API instead of Windsor)
  const metaDirectIds = await getMetaDirectIdsFull()
  const existingIds = new Set(meta.accounts.map(a => a.account_id))
  const missingMetaDirect = Array.from(metaDirectIds).filter(id => !existingIds.has(id))
  const metaDirectAccounts = await fetchMetaMonthlyAccounts(year, month, missingMetaDirect).catch(e => {
    console.error('[Meta] fetchMetaMonthlyAccounts error:', e)
    return [] as AccountData[]
  })

  const result: WindsorCached = {
    accounts:  [...meta.accounts, ...metaDirectAccounts, ...google.accounts],
    campaigns: [...meta.campaigns, ...google.campaigns],
    adsets:    [...meta.adsets,    ...google.adsets],
  }
  _windsorCache.set(key, { data: result, ts: Date.now() })
  return result
}
