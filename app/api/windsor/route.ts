import { NextRequest, NextResponse } from 'next/server'
import { fetchWindsorAccounts } from '@/lib/windsor'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const year  = parseInt(searchParams.get('year')  ?? String(new Date().getFullYear()))
  const month = parseInt(searchParams.get('month') ?? String(new Date().getMonth() + 1))
  const force = searchParams.get('force') === 'true'

  try {
    const { accounts, campaigns, adsets } = await fetchWindsorAccounts(year, month, force)
    return NextResponse.json({ data: accounts, campaigns, adsets, year, month })
  } catch (err) {
    console.error('[Windsor]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
