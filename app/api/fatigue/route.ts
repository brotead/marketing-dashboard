import { NextResponse } from 'next/server'
import { fetchFatigueAds } from '@/lib/windsor'
import { getBudgets } from '@/lib/storage'

export async function GET() {
  try {
    // Get configured Meta Ads account IDs from the current month's budgets
    const today = new Date()
    const budgets = await getBudgets()
    const currentMonth = budgets.filter(
      b => b.year === today.getFullYear() && b.month === today.getMonth() + 1 && b.source === 'facebook'
    )
    const allowedIds = new Set(currentMonth.map(b => b.account_id).filter(Boolean))

    const ads = await fetchFatigueAds(allowedIds)
    return NextResponse.json({ ads, analyzed_at: new Date().toISOString() })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
