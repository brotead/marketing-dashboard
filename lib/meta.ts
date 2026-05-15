import type { AccountData } from './types'

const META_BASE = 'https://graph.facebook.com/v21.0'

// Returns account IDs that should be fetched from Meta API directly (not Windsor).
export function getMetaDirectIds(): Set<string> {
  const raw = process.env.META_DIRECT_ACCOUNTS ?? ''
  return new Set(raw.split(',').map(s => s.trim()).filter(Boolean))
}

interface MetaAction {
  action_type: string
  value: string
}

interface MetaInsightRow {
  account_id?: string
  account_name?: string
  campaign_id?: string
  campaign_name?: string
  spend?: string
  impressions?: string
  cpm?: string
  inline_link_clicks?: string
  actions?: MetaAction[]
  date_start?: string
}

function actionVal(actions: MetaAction[] | undefined, type: string): number {
  return parseFloat(actions?.find(a => a.action_type === type)?.value ?? '0')
}

// Low-level: fetch insights from Meta Graph API for given account IDs.
async function fetchMetaInsights(
  accountIds: string[],
  dateFrom: string,
  dateTo: string,
  fields: string,
  level: 'account' | 'campaign' = 'account',
  timeIncrement?: number,
): Promise<MetaInsightRow[]> {
  const token = process.env.META_ACCESS_TOKEN
  if (!token || accountIds.length === 0) return []

  const timeRange = JSON.stringify({ since: dateFrom, until: dateTo })
  const results: MetaInsightRow[] = []

  await Promise.all(accountIds.map(async (id) => {
    try {
      const url = new URL(`${META_BASE}/act_${id}/insights`)
      url.searchParams.set('access_token', token)
      url.searchParams.set('time_range', timeRange)
      url.searchParams.set('fields', fields)
      url.searchParams.set('level', level)
      if (timeIncrement !== undefined) url.searchParams.set('time_increment', String(timeIncrement))
      const res = await fetch(url.toString(), { cache: 'no-store' })
      if (!res.ok) { console.error(`[Meta] act_${id}: ${res.status}`); return }
      const json = await res.json()
      results.push(...(json.data ?? []))
    } catch (e) {
      console.error(`[Meta] act_${id}:`, e)
    }
  }))

  return results
}

// ── Monthly AccountData (used by Windsor route) ───────────────────────────────

export async function fetchMetaMonthlyAccounts(
  year: number,
  month: number,
  accountIds: string[],
): Promise<AccountData[]> {
  if (accountIds.length === 0) return []

  const dateFrom = `${year}-${String(month).padStart(2, '0')}-01`
  const today = new Date()
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth() + 1
  const dateTo = isCurrentMonth
    ? new Date(today.getTime() - 86_400_000).toISOString().split('T')[0]
    : new Date(year, month, 0).toISOString().split('T')[0]

  const sevenDaysAgo = new Date(today)
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const recentFrom = sevenDaysAgo.toISOString().split('T')[0]

  const [monthlyRows, recentRows] = await Promise.all([
    fetchMetaInsights(accountIds, dateFrom, dateTo, 'account_id,account_name,spend'),
    fetchMetaInsights(accountIds, recentFrom, dateTo, 'account_id,spend'),
  ])

  const recentMap: Record<string, number> = {}
  for (const r of recentRows) {
    if (r.account_id) recentMap[r.account_id] = parseFloat(r.spend ?? '0')
  }

  return monthlyRows.map(r => ({
    account_id:     r.account_id ?? '',
    account_name:   r.account_name ?? r.account_id ?? '',
    source:         'facebook' as const,
    spend:          parseFloat(r.spend ?? '0'),
    recent_spend:   recentMap[r.account_id ?? ''] ?? 0,
    campaign_count: 0,
  }))
}

// ── Audit-compatible row format ───────────────────────────────────────────────
// Matches the internal RawRow interface in lib/audit.ts (same field names).

export interface MetaAuditRow {
  account_id?:    string | null
  account_name?:  string | null
  campaign_id?:   string | null
  campaign?:      string | null
  spend?:         number | null
  impressions?:   number | null
  cpm?:           number | null
  link_clicks?:   number | null
  actions_lead?:  number | null
  actions_onsite_conversion_lead_grouped?:                       number | null
  actions_onsite_conversion_messaging_conversation_started_7d?:  number | null
  actions_instagram_profile_visit?:                              number | null
}

function metaRowToAuditRow(r: MetaInsightRow): MetaAuditRow {
  const lc = parseFloat(r.inline_link_clicks ?? '0')
  return {
    account_id:   r.account_id ?? null,
    account_name: r.account_name ?? null,
    campaign_id:  r.campaign_id ?? null,
    campaign:     r.campaign_name ?? null,
    spend:        parseFloat(r.spend ?? '0'),
    impressions:  parseFloat(r.impressions ?? '0'),
    cpm:          parseFloat(r.cpm ?? '0'),
    link_clicks:  lc,
    actions_lead:
      actionVal(r.actions, 'lead') +
      actionVal(r.actions, 'offsite_conversion.fb_pixel_lead'),
    actions_onsite_conversion_lead_grouped:
      actionVal(r.actions, 'onsite_conversion.lead_grouped'),
    actions_onsite_conversion_messaging_conversation_started_7d:
      actionVal(r.actions, 'onsite_conversion.messaging_conversation_started_7d'),
    // For traffic-to-IG-profile campaigns the API doesn't return instagram_profile_visit
    // as a separate action — link_clicks ARE the profile visits for this campaign type.
    actions_instagram_profile_visit:
      actionVal(r.actions, 'instagram_profile_visit') || lc,
  }
}

export async function fetchMetaAuditRows(
  dateFrom: string,
  dateTo: string,
  accountIds: string[],
): Promise<MetaAuditRow[]> {
  if (accountIds.length === 0) return []
  const rows = await fetchMetaInsights(
    accountIds, dateFrom, dateTo,
    'account_id,account_name,spend,impressions,cpm,inline_link_clicks,actions',
  )
  return rows.map(metaRowToAuditRow)
}

export async function fetchMetaCampaignRows(
  dateFrom: string,
  dateTo: string,
  accountIds: string[],
): Promise<MetaAuditRow[]> {
  if (accountIds.length === 0) return []
  const rows = await fetchMetaInsights(
    accountIds, dateFrom, dateTo,
    'account_id,account_name,campaign_id,campaign_name,spend,impressions,cpm,inline_link_clicks,actions',
    'campaign',
  )
  return rows.map(metaRowToAuditRow)
}

export interface MetaDayRow {
  date: string
  spend: number
  impressions: number
  link_clicks: number
  messaging: number
  ig_visits: number
}

export async function fetchMetaDailyRows(
  accountId: string,
  dateFrom: string,
  dateTo: string,
): Promise<MetaDayRow[]> {
  const rows = await fetchMetaInsights(
    [accountId], dateFrom, dateTo,
    'spend,impressions,inline_link_clicks,actions',
    'account',
    1,
  )
  return rows.map(r => {
    const lc = parseFloat(r.inline_link_clicks ?? '0')
    const igVisit = actionVal(r.actions, 'instagram_profile_visit') || lc
    const messaging = actionVal(r.actions, 'onsite_conversion.messaging_conversation_started_7d')
    return {
      date:        r.date_start ?? '',
      spend:       parseFloat(r.spend ?? '0'),
      impressions: parseFloat(r.impressions ?? '0'),
      link_clicks: lc,
      messaging,
      ig_visits:   igVisit,
    }
  })
}
