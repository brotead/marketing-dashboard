import { NextResponse } from 'next/server'
import type { AccountData } from '@/lib/types'

export const dynamic = 'force-dynamic'

const META_BASE = 'https://graph.facebook.com/v21.0'

async function fetchAccounts(url: string): Promise<{ id: string; name: string }[]> {
  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return []
    const json = await res.json()
    return json.data ?? []
  } catch {
    return []
  }
}

function toAccountData(a: { id: string; name: string }): AccountData {
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

  const bizId = process.env.META_BUSINESS_ID
  const map   = new Map<string, AccountData>()

  const add = (rows: { id: string; name: string }[]) => {
    for (const a of rows) {
      const id = a.id.replace('act_', '')
      if (!map.has(id)) map.set(id, toAccountData(a))
    }
  }

  const base = `&access_token=${token}&limit=200`

  // Run all fetches in parallel
  const fetches: Promise<void>[] = [
    fetchAccounts(`${META_BASE}/me/adaccounts?fields=id,name,account_status${base}`)
      .then(add),
  ]

  if (bizId) {
    fetches.push(
      fetchAccounts(`${META_BASE}/${bizId}/owned_ad_accounts?fields=id,name,account_status${base}`)
        .then(add),
      fetchAccounts(`${META_BASE}/${bizId}/client_ad_accounts?fields=id,name,account_status${base}`)
        .then(add),
    )
  }

  // Also try dynamic business discovery as fallback
  const businesses = await fetchAccounts(`${META_BASE}/me/businesses?fields=id,name${base}`)
  for (const biz of businesses) {
    fetches.push(
      fetchAccounts(`${META_BASE}/${biz.id}/owned_ad_accounts?fields=id,name,account_status${base}`).then(add),
      fetchAccounts(`${META_BASE}/${biz.id}/client_ad_accounts?fields=id,name,account_status${base}`).then(add),
    )
  }

  await Promise.all(fetches)

  const accounts = Array.from(map.values())
  console.log(`[Meta accounts] ${accounts.length} accounts found`)

  return NextResponse.json({ accounts })
}
