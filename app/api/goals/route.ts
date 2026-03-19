import { NextRequest, NextResponse } from 'next/server'
import { getGoals, upsertGoal, removeGoal } from '@/lib/storage'

export async function GET() {
  return NextResponse.json(getGoals())
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  upsertGoal(body)
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const { client_name, year, month, kpi } = await req.json()
  removeGoal(client_name, year, month, kpi)
  return NextResponse.json({ ok: true })
}
