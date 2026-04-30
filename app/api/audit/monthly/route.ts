import { NextRequest, NextResponse } from 'next/server'
import { getClientType } from '@/lib/audit'

const WINDSOR_FACEBOOK = 'https://connectors.windsor.ai/facebook'

function n(v: unknown): number {
  if (v == null) return 0
  const p = typeof v === 'string' ? parseFloat(v) : Number(v)
  return isNaN(p) ? 0 : p
}

const FIELDS = [
  'account_id', 'date', 'spend', 'impressions', 'link_clicks',
  'actions_onsite_conversion_messaging_conversation_started_7d',
  'actions_instagram_profile_visit',
].join(',')

interface DayRow {
  date: string
  spend: number
  impressions: number
  link_clicks: number
  messaging: number
  ig_visits: number
}

async function fetchDays(
  apiKey: string,
  accountId: string,
  dateFrom: string,
  dateTo: string,
): Promise<DayRow[]> {
  if (dateFrom > dateTo) return []
  const url = new URL(WINDSOR_FACEBOOK)
  url.searchParams.set('api_key',   apiKey)
  url.searchParams.set('date_from', dateFrom)
  url.searchParams.set('date_to',   dateTo)
  url.searchParams.set('fields',    FIELDS)
  url.searchParams.set('_renderer', 'json')
  url.searchParams.set('_filters',  JSON.stringify([['account_id', 'eq', accountId]]))

  const res = await fetch(url.toString(), { cache: 'no-store' })
  if (!res.ok) return []
  const json = await res.json()
  const rows: Record<string, unknown>[] = (json.data ?? []).filter(
    (r: Record<string, unknown>) => !r.account_id || r.account_id === accountId,
  )
  return rows.map(r => ({
    date:       String(r.date ?? ''),
    spend:      n(r.spend),
    impressions: n(r.impressions),
    link_clicks: n(r.link_clicks),
    messaging:  n(r.actions_onsite_conversion_messaging_conversation_started_7d),
    ig_visits:  n(r.actions_instagram_profile_visit),
  }))
}

function fmt(d: Date) { return d.toISOString().split('T')[0] }

export async function GET(req: NextRequest) {
  const accountId  = req.nextUrl.searchParams.get('account_id')
  const clientName = req.nextUrl.searchParams.get('client_name') ?? ''
  if (!accountId) return NextResponse.json({ error: 'Missing account_id' }, { status: 400 })

  const apiKey = process.env.WINDSOR_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'WINDSOR_API_KEY not set' }, { status: 500 })

  const today     = new Date()
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1)

  const curFrom = new Date(today.getFullYear(), today.getMonth(), 1)
  const curTo   = yesterday

  const prevFrom = new Date(today.getFullYear(), today.getMonth() - 1, 1)
  const prevTo   = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate() - 1)

  const [curRows, prevRows] = await Promise.all([
    fetchDays(apiKey, accountId, fmt(curFrom), fmt(curTo)),
    fetchDays(apiKey, accountId, fmt(prevFrom), fmt(prevTo)),
  ])

  const clientType = getClientType(clientName)
  const isMsg = clientType === 'messaging'

  // Index by day-of-month
  const byDay = (rows: DayRow[]) => {
    const m: Record<number, DayRow> = {}
    for (const r of rows) {
      const parts = r.date.split('-')
      const day = parts.length === 3 ? parseInt(parts[2]) : NaN
      if (!isNaN(day)) m[day] = r
    }
    return m
  }

  const curByDay  = byDay(curRows)
  const prevByDay = byDay(prevRows)

  const agg = (rows: DayRow[]) => ({
    spend:       rows.reduce((s, r) => s + r.spend, 0),
    conversions: rows.reduce((s, r) => s + (isMsg ? r.messaging : r.ig_visits), 0),
    impressions: rows.reduce((s, r) => s + r.impressions, 0),
    link_clicks: rows.reduce((s, r) => s + r.link_clicks, 0),
  })

  const curAgg  = agg(curRows)
  const prevAgg = agg(prevRows)

  const ctr = (a: typeof curAgg) => a.impressions > 0 ? (a.link_clicks / a.impressions) * 100 : 0
  const cpl = (a: typeof curAgg) => a.conversions  > 0 ? a.spend / a.conversions : 0

  const maxDay = today.getDate() - 1

  // Daily spend series (not cumulative)
  const spendSeries = Array.from({ length: maxDay }, (_, i) => {
    const day = i + 1
    return {
      day,
      curSpend:  curByDay[day]?.spend  ?? 0,
      prevSpend: prevByDay[day]?.spend ?? 0,
    }
  })

  // Daily conversions series
  const convSeries = Array.from({ length: maxDay }, (_, i) => {
    const day = i + 1
    const c = curByDay[day]
    const p = prevByDay[day]
    return {
      day,
      curConv:  c ? (isMsg ? c.messaging  : c.ig_visits) : 0,
      prevConv: p ? (isMsg ? p.messaging  : p.ig_visits) : 0,
    }
  })

  // Daily CTR series
  const ctrSeries = Array.from({ length: maxDay }, (_, i) => {
    const day = i + 1
    const c = curByDay[day]
    const p = prevByDay[day]
    return {
      day,
      curCtr:  c && c.impressions > 0 ? (c.link_clicks / c.impressions) * 100 : null,
      prevCtr: p && p.impressions > 0 ? (p.link_clicks / p.impressions) * 100 : null,
    }
  })

  return NextResponse.json({
    cur:  { spend: curAgg.spend,  conversions: curAgg.conversions,  ctr: ctr(curAgg),  cpl: cpl(curAgg)  },
    prev: { spend: prevAgg.spend, conversions: prevAgg.conversions, ctr: ctr(prevAgg), cpl: cpl(prevAgg) },
    spendSeries,
    convSeries,
    ctrSeries,
    dateFrom:   fmt(curFrom),
    dateTo:     fmt(curTo),
    prevFrom:   fmt(prevFrom),
    prevTo:     fmt(prevTo),
    clientType,
  }, { headers: { 'Cache-Control': 'private, max-age=300' } })
}
