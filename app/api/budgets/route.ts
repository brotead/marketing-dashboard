import { NextRequest, NextResponse } from 'next/server'
import { getBudgets, getHiddenClients, upsertBudget, removeBudget } from '@/lib/storage'
import { getWorkspaceCtx } from '@/lib/workspace'

export const dynamic = 'force-dynamic'

export async function GET() {
  const ctx = await getWorkspaceCtx()
  const [data, hidden] = await Promise.all([getBudgets(ctx), getHiddenClients(ctx)])
  const hiddenSet = new Set(hidden.map(h => `${h.client_name}|${h.source}`))
  const visible = data.filter(b => !hiddenSet.has(`${b.client_name}|${b.source}`))
  return NextResponse.json(visible, {
    headers: { 'Cache-Control': 'no-store' },
  })
}

export async function POST(req: NextRequest) {
  const ctx  = await getWorkspaceCtx()
  const body = await req.json()
  await upsertBudget(body, ctx)
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const ctx = await getWorkspaceCtx()
  const { campaign_id, year, month } = await req.json()
  await removeBudget(campaign_id, year, month, ctx)
  return NextResponse.json({ ok: true })
}
