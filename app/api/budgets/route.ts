import { NextRequest, NextResponse } from 'next/server'
import { getBudgets, upsertBudget, removeBudget } from '@/lib/storage'

export async function GET() {
  return NextResponse.json(getBudgets())
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  upsertBudget(body)
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const { campaign_id, year, month } = await req.json()
  removeBudget(campaign_id, year, month)
  return NextResponse.json({ ok: true })
}
