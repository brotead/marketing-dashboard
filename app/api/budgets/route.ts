import { NextRequest, NextResponse } from 'next/server'
import { getBudgets, upsertBudget, removeBudget } from '@/lib/storage'

export async function GET() {
  const data = await getBudgets()
  return NextResponse.json(data, {
    headers: { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=120' },
  })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  await upsertBudget(body)
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const { campaign_id, year, month } = await req.json()
  await removeBudget(campaign_id, year, month)
  return NextResponse.json({ ok: true })
}
