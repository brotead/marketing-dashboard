import { NextRequest, NextResponse } from 'next/server'
import { runAudit } from '@/lib/audit'
import { createClient } from '@supabase/supabase-js'

export async function GET(req: NextRequest) {
  const force = req.nextUrl.searchParams.get('force') === 'true'
  try {
    const sb = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    )
    const { data: budgets } = await sb
      .from('budgets')
      .select('account_id, client_name')
      .eq('source', 'facebook')

    const allowedIds  = new Set<string>()
    const clientNames: Record<string, string> = {}

    for (const b of budgets ?? []) {
      if (b.account_id && b.client_name) {
        allowedIds.add(b.account_id)
        if (!clientNames[b.account_id]) {
          clientNames[b.account_id] = b.client_name
        }
      }
    }

    const data = await runAudit(allowedIds, clientNames, force)
    return NextResponse.json(data)
  } catch (err) {
    console.error('[Audit]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
