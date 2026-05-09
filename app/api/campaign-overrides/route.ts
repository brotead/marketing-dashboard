import { NextRequest, NextResponse } from 'next/server'
import { getCampaignOverrides, setCampaignOverride } from '@/lib/storage'
import { getWorkspaceCtx } from '@/lib/workspace'

export const dynamic = 'force-dynamic'

export async function GET() {
  const ctx = await getWorkspaceCtx()
  if (!ctx.userId) return NextResponse.json([])
  const data = await getCampaignOverrides()
  return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(req: NextRequest) {
  const ctx = await getWorkspaceCtx()
  if (!ctx.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { account_id, source, campaign_name_norm, ...updates } = await req.json()
    await setCampaignOverride(account_id, source, campaign_name_norm, updates)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
