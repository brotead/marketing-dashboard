import { NextRequest, NextResponse } from 'next/server'
import { getCreativeLifecycle } from '@/lib/audit'

export async function GET(req: NextRequest) {
  try {
    const accountId = req.nextUrl.searchParams.get('account_id')
    if (!accountId) {
      return NextResponse.json({ error: 'account_id requerido' }, { status: 400 })
    }

    const data = await getCreativeLifecycle(accountId)
    return NextResponse.json(data)
  } catch (err) {
    console.error('[Audit/Creatives]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
