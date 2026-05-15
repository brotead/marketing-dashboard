import { NextResponse } from 'next/server'
import type { AccountData } from '@/lib/types'

export const dynamic = 'force-dynamic'

const META_BASE = 'https://graph.facebook.com/v21.0'

async function get(path: string, token: string): Promise<Record<string, unknown> | null> {
  try {
    const url = new URL(`${META_BASE}${path}`)
    url.searchParams.set('access_token', token)
    url.searchParams.set('limit', '200')
    const res = await fetch(url.toString(), { cache: 'no-store' })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

interface RawAccount { id: string; name: string; account_status?: number }

function toAccountData(a: RawAccount): AccountData {
  return {
    account_id:     a.id.replace('act_', ''),
    account_name:   a.name,
    source:         'facebook' as const,
    spend:          0,
    recent_spend:   0,
    campaign_count: 0,
  }
}

export async function GET() {
  const token = process.env.META_ACCESS_TOKEN
  if (!token) {
    return NextResponse.json({ error: 'META_ACCESS_TOKEN no configurado' }, { status: 500 })
  }

  try {
    const map = new Map<string, AccountData>()

    const addAccounts = (rows: RawAccount[]) => {
      for (const a of rows) {
        const id = a.id.replace('act_', '')
        if (!map.has(id)) map.set(id, toAccountData(a))
      }
    }

    // 1. Accounts directly linked to the user token
    const direct = await get('/me/adaccounts?fields=id,name,account_status', token)
    addAccounts((direct?.data ?? []) as RawAccount[])

    // 2. Business Manager accounts (owned + client)
    const bizJson = await get('/me/businesses?fields=id,name', token)
    const businesses: { id: string }[] = (bizJson?.data ?? []) as { id: string }[]

    await Promise.all(businesses.map(async (biz) => {
      const [owned, clients] = await Promise.all([
        get(`/${biz.id}/owned_ad_accounts?fields=id,name,account_status`, token),
        get(`/${biz.id}/client_ad_accounts?fields=id,name,account_status`, token),
      ])
      addAccounts((owned?.data  ?? []) as RawAccount[])
      addAccounts((clients?.data ?? []) as RawAccount[])
    }))

    const accounts = Array.from(map.values())
    console.log(`[Meta accounts] found ${accounts.length} accounts (${businesses.length} business managers)`)

    return NextResponse.json({ accounts })
  } catch (err) {
    console.error('[Meta accounts]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
