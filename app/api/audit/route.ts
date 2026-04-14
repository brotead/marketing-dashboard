import { NextResponse } from 'next/server'
import { runAudit }    from '@/lib/audit'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
  try {
    // Build account_id → client_name map from Supabase
    const sb = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    )
    const { data: budgets } = await sb
      .from('budgets')
      .select('account_id, client_name')
      .eq('source', 'facebook')

    const accountMap: Record<string, string> = {}
    for (const b of budgets ?? []) {
      if (b.account_id && b.client_name && !accountMap[b.account_id]) {
        accountMap[b.account_id] = b.client_name
      }
    }

    const data = await runAudit(accountMap)
    return NextResponse.json(data)
  } catch (err) {
    console.error('[Audit]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
