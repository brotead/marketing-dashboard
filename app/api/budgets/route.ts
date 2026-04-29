import { NextRequest, NextResponse } from 'next/server'
import { getBudgets, upsertBudget, removeBudget } from '@/lib/storage'
import { getWorkspaceCtx } from '@/lib/workspace'

export async function GET() {
  const ctx = await getWorkspaceCtx()
  const data = await getBudgets(ctx)
  return NextResponse.json(data, {
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
