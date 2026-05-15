import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

// POST /api/debug-budgets  body: { action: 'unhide_account', account_id, source }
//                                { action: 'delete_duplicate_budgets', client_name, keep_campaign_id }
export async function POST(req: NextRequest) {
  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)
  const body = await req.json()

  if (body.action === 'unhide_account') {
    const { error } = await supabase
      .from('campaign_overrides')
      .delete()
      .eq('account_id', body.account_id)
      .eq('source', body.source)
      .eq('hidden', true)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, action: 'unhide_account', account_id: body.account_id })
  }

  if (body.action === 'delete_duplicate_budgets') {
    // keep only the row with the given campaign_id, delete others with same client_name+source
    const { error } = await supabase
      .from('budgets')
      .delete()
      .eq('client_name', body.client_name)
      .neq('campaign_id', body.keep_campaign_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, action: 'delete_duplicate_budgets' })
  }

  return NextResponse.json({ error: 'unknown action' }, { status: 400 })
}

export async function GET() {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  )

  const [budgetRes, hiddenRes, overridesRes] = await Promise.all([
    supabase.from('budgets')
      .select('campaign_id, client_name, source, account_id, year, month, budget_total, paused')
      .order('campaign_id', { ascending: false })
      .limit(200),
    supabase.from('hidden_clients').select('client_name, source'),
    supabase.from('campaign_overrides').select('account_id, source, campaign_name_norm, hidden').eq('hidden', true),
  ])

  const budgets = budgetRes.data ?? []
  const hidden  = hiddenRes.data ?? []
  const overrides = overridesRes.data ?? []

  // Find Aires Show entries specifically
  const aires = budgets.filter((b: { client_name: string }) => b.client_name.toLowerCase().includes('aires'))
  const airesCampaignNorms = aires.map((b: { campaign_name: string }) =>
    b.campaign_name?.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim()
  )

  const hiddenClientSet = new Set(hidden.map((h: { client_name: string; source: string }) => `${h.client_name}|${h.source}`))
  const hiddenOverrideSet = new Set(overrides.map((o: { account_id: string; source: string; campaign_name_norm: string }) => `${o.account_id}|${o.source}|${o.campaign_name_norm}`))

  return NextResponse.json({
    total_budgets: budgets.length,
    hidden_clients: hidden,
    hidden_overrides: overrides,
    aires_entries: aires,
    aires_hidden_by_client: aires.filter((b: { client_name: string; source: string }) => hiddenClientSet.has(`${b.client_name}|${b.source}`)),
    aires_hidden_by_override: aires.filter((b: { account_id: string; source: string; campaign_name: string }) => {
      const norm = (b.campaign_name ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim()
      return hiddenOverrideSet.has(`${b.account_id}|${b.source}|${norm}`)
    }),
  })
}
