import { NextRequest, NextResponse } from 'next/server'
import { fetchConversationsByAccount, fetchIgFollowersCurrent } from '@/lib/windsor'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const year  = parseInt(searchParams.get('year')  ?? String(new Date().getFullYear()))
  const month = parseInt(searchParams.get('month') ?? String(new Date().getMonth() + 1))

  try {
    const [conversations, igFollowers] = await Promise.all([
      fetchConversationsByAccount(year, month),
      fetchIgFollowersCurrent(),
    ])
    return NextResponse.json({ conversations, igFollowers, year, month }, {
      headers: { 'Cache-Control': 'private, max-age=300, stale-while-revalidate=600' },
    })
  } catch (err) {
    console.error('[KPIs]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
