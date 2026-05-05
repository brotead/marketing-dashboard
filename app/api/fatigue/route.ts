import { NextResponse } from 'next/server'
import { fetchFatigueAds } from '@/lib/windsor'
import { getBudgets } from '@/lib/storage'
import { getWorkspaceCtx } from '@/lib/workspace'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const ctx    = await getWorkspaceCtx()
    const today  = new Date()
    const budgets = await getBudgets(ctx)
    const currentMonth = budgets.filter(
      b => b.year === today.getFullYear() && b.month === today.getMonth() + 1 && b.source === 'facebook'
    )
    const allowedIds = new Set(currentMonth.map(b => b.account_id).filter(Boolean))

    const ads = await fetchFatigueAds(allowedIds)
    return NextResponse.json({ ads, analyzed_at: new Date().toISOString() }, {
      headers: { 'Cache-Control': 'private, max-age=300, stale-while-revalidate=600' },
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
