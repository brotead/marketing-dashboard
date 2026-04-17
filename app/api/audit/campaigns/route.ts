import { NextRequest, NextResponse } from 'next/server'
import { getCampaignBreakdown } from '@/lib/audit'
import { createClient } from '@supabase/supabase-js'

export async function GET(req: NextRequest) {
  try {
    const accountId = req.nextUrl.searchParams.get('account_id')
    if (!accountId) {
      return NextResponse.json({ error: 'account_id requerido' }, { status: 400 })
    }

    // Get client_name from Supabase
    const sb = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    )
    const { data: budgets } = await sb
      .from('budgets')
      .select('client_name')
      .eq('account_id', accountId)
      .eq('source', 'facebook')
      .limit(1)

    const clientName = budgets?.[0]?.client_name ?? accountId

    const data = await getCampaignBreakdown(accountId, clientName)
    return NextResponse.json(data)
  } catch (err) {
    console.error('[Audit/Campaigns]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
