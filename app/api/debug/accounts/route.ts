import { NextResponse } from 'next/server'
import { fetchWindsorAccounts } from '@/lib/windsor'
import { supabase } from '@/lib/supabase'
import { getWorkspaceCtx } from '@/lib/workspace'

export const dynamic = 'force-dynamic'

// Admin-only diagnostic: compare Windsor account_ids with Supabase budget account_ids.
// Usage: GET /api/debug/accounts?client=FRUSSO
export async function GET(req: Request) {
  const ctx = await getWorkspaceCtx()
  if (!ctx.isSuperAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const clientFilter = searchParams.get('client')?.toUpperCase() ?? null

  const now = new Date()
  const year  = now.getFullYear()
  const month = now.getMonth() + 1

  const [{ accounts }, { data: budgets }] = await Promise.all([
    fetchWindsorAccounts(year, month, true),
    supabase.from('budgets').select('client_name, account_id, source').eq('source', 'google'),
  ])

  const windsorGoogle = accounts
    .filter(a => a.source === 'google')
    .map(a => ({ account_id: a.account_id, account_name: a.account_name, spend: a.spend }))
    .sort((a, b) => b.spend - a.spend)

  const supabaseGoogle = (budgets ?? [])
    .filter(b => !clientFilter || b.client_name?.toUpperCase() === clientFilter)
    .map(b => ({ client_name: b.client_name, account_id: b.account_id }))

  // Cross-match: for each Supabase entry, does Windsor have the same account_id?
  const crossMatch = supabaseGoogle.map(sb => ({
    ...sb,
    windsor_found: windsorGoogle.some(w => w.account_id === sb.account_id),
    windsor_match: windsorGoogle.find(w => w.account_id === sb.account_id) ?? null,
  }))

  return NextResponse.json({ windsorGoogle, supabaseGoogle, crossMatch }, { status: 200 })
}
