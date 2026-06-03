import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getWorkspaceCtx } from '@/lib/workspace'

export const dynamic = 'force-dynamic'

function sb() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)
}

/**
 * POST /api/budgets/rollover
 *
 * For every client that has budget entries in the PREVIOUS month but NONE in
 * the target month, copies the previous-month entries forward with the same
 * budgets, campaigns, and paused states.
 *
 * Body: { year: number, month: number }   (target month — defaults to current)
 *
 * Rules:
 *  - Only copies entries that the caller has access to (admin = all, editor = assigned clients).
 *  - Skips clients that already have at least one entry in the target month.
 *  - campaign_id is kept the same (unique key is campaign_id + year + month).
 *  - spend_override and manual values are NOT copied (they are month-specific).
 *  - workspace_id IS copied so the entry stays in the right workspace.
 *  - Returns { rolled: string[] } with the list of client names that were rolled over.
 */
export async function POST(req: NextRequest) {
  try {
    const ctx = await getWorkspaceCtx()

    const body = await req.json().catch(() => ({}))
    const today = new Date()
    const targetYear  = body.year  ?? today.getFullYear()
    const targetMonth = body.month ?? (today.getMonth() + 1)

    // Previous month
    const prevMonth = targetMonth === 1 ? 12 : targetMonth - 1
    const prevYear  = targetMonth === 1 ? targetYear - 1 : targetYear

    const client = sb()

    // 1. Load all entries for previous month (access-controlled)
    let prevQ = client
      .from('budgets')
      .select('campaign_id,campaign_name,client_name,source,account_id,budget_total,paused,workspace_id')
      .eq('year', prevYear)
      .eq('month', prevMonth)

    if (!ctx.isSuperAdmin) {
      if (!ctx.assignedClients || ctx.assignedClients.length === 0) {
        return NextResponse.json({ rolled: [] })
      }
      prevQ = prevQ.in('client_name', ctx.assignedClients)
    }

    const { data: prevEntries, error: prevErr } = await prevQ
    if (prevErr) throw prevErr
    if (!prevEntries || prevEntries.length === 0) {
      return NextResponse.json({ rolled: [], message: 'No entries in previous month' })
    }

    // 2. Find which clients already have entries this month
    const prevClients = Array.from(new Set(prevEntries.map(e => e.client_name)))

    const { data: existingEntries } = await client
      .from('budgets')
      .select('client_name')
      .eq('year', targetYear)
      .eq('month', targetMonth)
      .in('client_name', prevClients)

    const clientsWithCurrentMonth = new Set((existingEntries ?? []).map(e => e.client_name))
    const clientsToRoll = prevClients.filter(c => !clientsWithCurrentMonth.has(c))

    if (clientsToRoll.length === 0) {
      return NextResponse.json({ rolled: [], message: 'All clients already have entries this month' })
    }

    // 3. Build new entries for the target month
    const entriesToInsert = prevEntries
      .filter(e => clientsToRoll.includes(e.client_name))
      .map(e => ({
        campaign_id:   e.campaign_id,
        campaign_name: e.campaign_name,
        client_name:   e.client_name,
        source:        e.source,
        account_id:    e.account_id,
        budget_total:  e.budget_total,
        paused:        e.paused,
        workspace_id:  e.workspace_id,
        year:          targetYear,
        month:         targetMonth,
      }))

    // 4. Insert (upsert to be safe — campaign_id+year+month is unique)
    const { error: insertErr } = await client
      .from('budgets')
      .upsert(entriesToInsert, { onConflict: 'campaign_id,year,month' })

    if (insertErr) throw insertErr

    return NextResponse.json({
      ok: true,
      rolled: clientsToRoll,
      count: entriesToInsert.length,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
