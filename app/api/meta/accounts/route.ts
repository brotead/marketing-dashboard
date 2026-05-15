import { NextResponse } from 'next/server'
import type { AccountData } from '@/lib/types'

export const dynamic = 'force-dynamic'

const META_BASE = 'https://graph.facebook.com/v21.0'

export async function GET() {
  const token = process.env.META_ACCESS_TOKEN
  if (!token) {
    return NextResponse.json({ error: 'META_ACCESS_TOKEN no configurado' }, { status: 500 })
  }

  try {
    const url = new URL(`${META_BASE}/me/adaccounts`)
    url.searchParams.set('access_token', token)
    url.searchParams.set('fields', 'id,name,account_status,currency')
    url.searchParams.set('limit', '200')

    const res = await fetch(url.toString(), { cache: 'no-store' })
    if (!res.ok) {
      return NextResponse.json({ error: `Meta API error ${res.status}` }, { status: 500 })
    }

    const json = await res.json()
    if (json.error) {
      return NextResponse.json({ error: json.error.message }, { status: 500 })
    }

    const accounts: AccountData[] = (json.data ?? []).map((a: {
      id: string
      name: string
      account_status: number
    }) => ({
      account_id:     a.id.replace('act_', ''),
      account_name:   a.name,
      source:         'facebook' as const,
      spend:          0,
      recent_spend:   0,
      campaign_count: 0,
    }))

    return NextResponse.json({ accounts })
  } catch (err) {
    console.error('[Meta accounts]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
