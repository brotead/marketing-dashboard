import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fetchWindsorAccounts } from '@/lib/windsor'
import { normName } from '@/lib/calculations'
import { getWorkspaceCtx } from '@/lib/workspace'
import type { BudgetEntry } from '@/lib/types'

export const dynamic = 'force-dynamic'

function sb() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)
}

/**
 * POST /api/campaigns/sync
 *
 * Server-side Windsor campaign detection. Runs independently of which page the
 * user has open. Called hourly from the Dashboard so new campaigns are detected
 * across ALL Windsor accounts without requiring the user to visit each cashflow.
 *
 * Logic (mirrors checkNewCampaigns in cashflow/page.tsx but server-side):
 * 1. Fetch all budgets for the target month.
 * 2. Fetch all Windsor campaigns for the target month.
 * 3. For each Windsor campaign that has an account linked to a client but no
 *    matching budget entry (by normalized name), create a new budget entry
 *    with budget_total=0 so it appears in Cashflow immediately.
 *
 * Body: { year: number, month: number }
 * Returns: { added: BudgetEntry[], count: number }
 */
export async function POST(req: NextRequest) {
  try {
    const ctx = await getWorkspaceCtx()

    const body  = await req.json().catch(() => ({}))
    const today = new Date()
    const year  = body.year  ?? today.getFullYear()
    const month = body.month ?? (today.getMonth() + 1)

    const client = sb()

    // 1. Load all budgets for the target month (all workspaces — admin only for full sync)
    const { data: monthBudgets, error: budgetErr } = await client
      .from('budgets')
      .select('campaign_id,campaign_name,client_name,account_id,source,workspace_id,budget_total,paused,year,month')
      .eq('year', year)
      .eq('month', month)

    if (budgetErr) throw budgetErr

    const budgets: BudgetEntry[] = (monthBudgets ?? []) as BudgetEntry[]

    // Build lookup structures
    // account_id|source → { client, workspace_id }
    const accountToClient = new Map<string, { client: string; workspace_id: string | null }>()
    for (const b of budgets) {
      if (b.account_id === '__pending__') continue
      const key = `${b.account_id}|${b.source}`
      if (!accountToClient.has(key)) {
        accountToClient.set(key, {
          client:       b.client_name,
          workspace_id: (b as { workspace_id?: string | null }).workspace_id ?? null,
        })
      }
    }

    if (accountToClient.size === 0) {
      return NextResponse.json({ added: [], count: 0, message: 'No accounts configured' })
    }

    // Existing campaign keys (account|source|normName) to detect duplicates
    const existingKeys = new Set<string>()
    for (const b of budgets) {
      existingKeys.add(`${b.account_id}|${b.source}|${normName(b.campaign_name)}`)
    }

    // 2. Fetch Windsor campaigns server-side (uses internal cache)
    const windsor = await fetchWindsorAccounts(year, month, false)
    const windsorCampaigns = windsor.campaigns

    // 3. Find new campaigns
    const toAdd: BudgetEntry[] = []
    const seen  = new Set<string>()

    for (const wc of windsorCampaigns) {
      if (!wc.account_id) continue
      const acctKey = `${wc.account_id}|${wc.source}`
      if (!accountToClient.has(acctKey)) continue        // account not linked to any client

      const wcKey = `${wc.account_id}|${wc.source}|${normName(wc.campaign_name)}`
      if (existingKeys.has(wcKey) || seen.has(wcKey)) continue  // already in system

      seen.add(wcKey)
      const { client, workspace_id } = accountToClient.get(acctKey)!
      const suffix = wc.source === 'facebook' ? 'fb' : 'gg'

      const entry: BudgetEntry & { workspace_id?: string | null } = {
        campaign_id:   `auto_${suffix}_${wc.account_id.slice(-5)}_${Date.now()}_${toAdd.length}`,
        campaign_name: wc.campaign_name,
        client_name:   client,
        source:        wc.source as 'facebook' | 'google',
        account_id:    wc.account_id,
        year,
        month,
        budget_total:  0,
        paused:        false,
      }
      if (workspace_id) entry.workspace_id = workspace_id
      toAdd.push(entry)
    }

    if (toAdd.length === 0) {
      return NextResponse.json({ added: [], count: 0 })
    }

    // 4. Insert new entries (ignore conflicts — campaign_id is unique enough with timestamp)
    const { error: insertErr } = await client
      .from('budgets')
      .insert(toAdd)

    if (insertErr) throw insertErr

    return NextResponse.json({
      ok:    true,
      added: toAdd.map(e => ({ campaign_id: e.campaign_id, campaign_name: e.campaign_name, client_name: e.client_name })),
      count: toAdd.length,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
