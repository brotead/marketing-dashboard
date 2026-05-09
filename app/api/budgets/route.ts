import { NextRequest, NextResponse } from 'next/server'
import { getBudgets, getHiddenClients, getCampaignOverrides, upsertBudget, removeBudget } from '@/lib/storage'
import { getWorkspaceCtx } from '@/lib/workspace'

export const dynamic = 'force-dynamic'

function normName(s: string): string {
  return s.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[|\-_]+/g, ' ')
    .replace(/\s+/g, ' ').trim()
}

export async function GET() {
  const ctx = await getWorkspaceCtx()
  const [data, hidden, overrides] = await Promise.all([
    getBudgets(ctx),
    getHiddenClients(ctx),
    getCampaignOverrides(),
  ])
  const hiddenClientSet = new Set(hidden.map(h => `${h.client_name}|${h.source}`))
  const hiddenCampaignSet = new Set(
    overrides.filter(o => o.hidden).map(o => `${o.account_id}|${o.source}|${o.campaign_name_norm}`)
  )
  const visible = data.filter(b =>
    !hiddenClientSet.has(`${b.client_name}|${b.source}`) &&
    !hiddenCampaignSet.has(`${b.account_id}|${b.source}|${normName(b.campaign_name)}`)
  )
  return NextResponse.json(visible, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(req: NextRequest) {
  const ctx  = await getWorkspaceCtx()
  const body = await req.json()
  await upsertBudget(body, ctx)
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const ctx = await getWorkspaceCtx()
  const { campaign_id, year, month } = await req.json()
  await removeBudget(campaign_id, year, month, ctx)
  return NextResponse.json({ ok: true })
}
