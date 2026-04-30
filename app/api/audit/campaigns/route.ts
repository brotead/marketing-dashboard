import { NextRequest, NextResponse } from 'next/server'
import { getCampaignBreakdown, getClientType } from '@/lib/audit'
import { supabase as sb } from '@/lib/supabase'

function normName(s: string): string {
  return s.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[|\-_]+/g, ' ')
    .replace(/\s+/g, ' ').trim()
}

export async function GET(req: NextRequest) {
  try {
    const accountId = req.nextUrl.searchParams.get('account_id')
    if (!accountId) {
      return NextResponse.json({ error: 'account_id requerido' }, { status: 400 })
    }

    const [{ data: budgets }, { data: excluded }] = await Promise.all([
      sb.from('budgets').select('client_name').eq('account_id', accountId).eq('source', 'facebook').limit(1),
      sb.from('excluded_campaigns').select('campaign_name_norm').eq('account_id', accountId).eq('source', 'facebook'),
    ])

    const clientName = budgets?.[0]?.client_name ?? accountId
    const clientType = getClientType(clientName)

    const data = await getCampaignBreakdown(accountId, clientName, clientType)

    const excludedNorms = new Set(excluded?.map(e => e.campaign_name_norm) ?? [])
    if (excludedNorms.size > 0) {
      data.campaigns = data.campaigns.filter(c => !excludedNorms.has(normName(c.campaign)))
    }

    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'private, max-age=180, stale-while-revalidate=600' },
    })
  } catch (err) {
    console.error('[Audit/Campaigns]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
