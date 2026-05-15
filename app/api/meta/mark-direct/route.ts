import { NextRequest, NextResponse } from 'next/server'
import { addMetaDirectAccount } from '@/lib/storage'
import { invalidateMetaDirectCache } from '@/lib/meta'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { account_id } = await req.json()
    if (!account_id || typeof account_id !== 'string') {
      return NextResponse.json({ error: 'account_id requerido' }, { status: 400 })
    }
    await addMetaDirectAccount(account_id)
    invalidateMetaDirectCache()
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[Meta mark-direct]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
