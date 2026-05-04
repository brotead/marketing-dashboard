import { NextRequest, NextResponse } from 'next/server'
import { getBudgets, upsertBudget } from '@/lib/storage'
import { getWorkspaceCtx } from '@/lib/workspace'
import type { BudgetEntry } from '@/lib/types'

export async function POST(req: NextRequest) {
  const ctx = await getWorkspaceCtx()
  const { year, month } = await req.json()

  const allBudgets = await getBudgets(ctx)

  // If the target month already has entries, nothing to do
  const existing = allBudgets.filter(b => b.year === year && b.month === month)
  if (existing.length > 0) {
    return NextResponse.json({ carried: 0, skipped: true })
  }

  // Find previous month
  const prevYear  = month === 1 ? year - 1 : year
  const prevMonth = month === 1 ? 12 : month - 1

  const source = allBudgets.filter(b => b.year === prevYear && b.month === prevMonth)
  if (source.length === 0) {
    return NextResponse.json({ carried: 0, skipped: false })
  }

  // Copy entries to new month: keep same campaign_id/name/account/budget, reset spend_override
  const newEntries: BudgetEntry[] = source.map(b => ({
    ...b,
    year,
    month,
    spend_override: null,
  }))

  await Promise.all(newEntries.map(e => upsertBudget(e, ctx)))

  return NextResponse.json({
    carried:   newEntries.length,
    fromMonth: prevMonth,
    fromYear:  prevYear,
    skipped:   false,
  })
}
