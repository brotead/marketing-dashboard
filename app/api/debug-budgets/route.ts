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

  if (body.action === 'unhide_campaign') {
    const { error } = await supabase
      .from('campaign_overrides')
      .delete()
      .eq('account_id', body.account_id)
      .eq('source', body.source)
      .eq('campaign_name_norm', body.campaign_name_norm)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, action: 'unhide_campaign', campaign_name_norm: body.campaign_name_norm })
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

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const clientFilter = (searchParams.get('client') ?? '').toLowerCase()

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  )

  const budgetQuery = clientFilter
    ? supabase.from('budgets')
        .select('campaign_id, campaign_name, client_name, source, account_id, year, month, budget_total, paused, spend_override')
        .ilike('client_name', `%${clientFilter}%`)
        .order('year', { ascending: false })
        .order('month', { ascending: false })
    : supabase.from('budgets')
        .select('campaign_id, campaign_name, client_name, source, account_id, year, month, budget_total, paused')
        .order('campaign_id', { ascending: false })
        .limit(200)

  const [budgetRes, hiddenRes, overridesRes, allOverridesRes] = await Promise.all([
    budgetQuery,
    supabase.from('hidden_clients').select('client_name, source'),
    supabase.from('campaign_overrides').select('account_id, source, campaign_name_norm, hidden').eq('hidden', true),
    supabase.from('campaign_overrides').select('account_id, source, campaign_name_norm, hidden, manual_spent, manual_budget, paused'),
  ])

  const budgets = budgetRes.data ?? []
  const hidden  = hiddenRes.data ?? []
  const overrides = overridesRes.data ?? []
  const allOverrides = allOverridesRes.data ?? []

  const hiddenClientSet = new Set(hidden.map((h: { client_name: string; source: string }) => `${h.client_name}|${h.source}`))
  const hiddenOverrideSet = new Set(overrides.map((o: { account_id: string; source: string; campaign_name_norm: string }) => `${o.account_id}|${o.source}|${o.campaign_name_norm}`))

  // Filter by client name if provided
  const clientBudgets = clientFilter
    ? budgets.filter((b: { client_name: string }) => b.client_name?.toLowerCase().includes(clientFilter))
    : []

  const clientAccountIds = [...new Set(clientBudgets.map((b: { account_id: string }) => b.account_id))]
  const clientOverrides = allOverrides.filter((o: { account_id: string }) => clientAccountIds.includes(o.account_id))

  return NextResponse.json({
    total_budgets: budgets.length,
    hidden_clients: hidden,
    hidden_overrides: overrides,
    // Client-specific debug (use ?client=remax)
    client_filter: clientFilter || null,
    client_entries: clientBudgets,
    client_account_ids: clientAccountIds,
    client_overrides: clientOverrides,
    client_hidden_by_client: clientBudgets.filter((b: { client_name: string; source: string }) => hiddenClientSet.has(`${b.client_name}|${b.source}`)),
    client_hidden_by_override: clientBudgets.filter((b: { account_id: string; source: string; campaign_name: string }) => {
      const norm = (b.campaign_name ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim()
      return hiddenOverrideSet.has(`${b.account_id}|${b.source}|${norm}`)
    }),
  })
}
