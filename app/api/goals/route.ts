import { NextRequest, NextResponse } from 'next/server'
import { getGoals, upsertGoal, removeGoal } from '@/lib/storage'
import { getWorkspaceCtx } from '@/lib/workspace'

export async function GET() {
  const ctx = await getWorkspaceCtx()
  const data = await getGoals(ctx)
  return NextResponse.json(data, {
    headers: { 'Cache-Control': 'private, max-age=300, stale-while-revalidate=600' },
  })
}

export async function POST(req: NextRequest) {
  const ctx  = await getWorkspaceCtx()
  const body = await req.json()
  await upsertGoal(body, ctx)
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const ctx = await getWorkspaceCtx()
  const { client_name, year, month, kpi } = await req.json()
  await removeGoal(client_name, year, month, kpi, ctx)
  return NextResponse.json({ ok: true })
}
