import { NextRequest, NextResponse } from 'next/server'
import { getGoals, upsertGoal, removeGoal } from '@/lib/storage'

export async function GET() {
  const data = await getGoals()
  return NextResponse.json(data, {
    headers: { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=120' },
  })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  await upsertGoal(body)
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const { client_name, year, month, kpi } = await req.json()
  await removeGoal(client_name, year, month, kpi)
  return NextResponse.json({ ok: true })
}
