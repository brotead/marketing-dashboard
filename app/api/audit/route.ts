import { NextRequest, NextResponse } from 'next/server'
import { runAudit } from '@/lib/audit'
import { getBudgets } from '@/lib/storage'
import { getWorkspaceCtx } from '@/lib/workspace'

export async function GET(req: NextRequest) {
  const force = req.nextUrl.searchParams.get('force') === 'true'
  try {
    const ctx     = await getWorkspaceCtx()
    const budgets = await getBudgets(ctx)

    const fbBudgets = budgets.filter(b => b.source === 'facebook')
    const allowedIds  = new Set<string>()
    const clientNames: Record<string, string> = {}

    for (const b of fbBudgets) {
      if (b.account_id && b.client_name) {
        allowedIds.add(b.account_id)
        if (!clientNames[b.account_id]) {
          clientNames[b.account_id] = b.client_name
        }
      }
    }

    const data = await runAudit(allowedIds, clientNames, force)
    const cc = force
      ? 'no-store'
      : 'private, max-age=180, stale-while-revalidate=600'
    return NextResponse.json(data, { headers: { 'Cache-Control': cc } })
  } catch (err) {
    console.error('[Audit]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
