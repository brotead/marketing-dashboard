import { NextRequest, NextResponse } from 'next/server'
import { fetchWindsorAccounts } from '@/lib/windsor'
import { getCampaignOverrides } from '@/lib/storage'

export const dynamic = 'force-dynamic'

function normName(s: string): string {
  return s.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[|\-_]+/g, ' ')
    .replace(/\s+/g, ' ').trim()
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const year  = parseInt(searchParams.get('year')  ?? String(new Date().getFullYear()))
  const month = parseInt(searchParams.get('month') ?? String(new Date().getMonth() + 1))
  const force = searchParams.get('force') === 'true'

  try {
    const [{ accounts, campaigns, adsets }, overrides] = await Promise.all([
      fetchWindsorAccounts(year, month, force),
      getCampaignOverrides(),
    ])

    const overrideMap = new Map(
      overrides.map(o => [`${o.account_id}|${o.source}|${o.campaign_name_norm}`, o])
    )

    const finalCampaigns = campaigns
      .filter(c => !overrideMap.get(`${c.account_id}|${c.source}|${normName(c.campaign_name)}`)?.hidden)
      .map(c => {
        const override = overrideMap.get(`${c.account_id}|${c.source}|${normName(c.campaign_name)}`)
        if (override?.manual_spent == null) return c
        return { ...c, spend: override.manual_spent }
      })

    const finalAdsets = adsets.filter(
      a => !overrideMap.get(`${a.account_id}|${a.source}|${normName(a.campaign_name)}`)?.hidden
    )

    const cc = force
      ? 'no-store'
      : 'private, max-age=300, stale-while-revalidate=600'
    return NextResponse.json(
      { data: accounts, campaigns: finalCampaigns, adsets: finalAdsets, year, month },
      { headers: { 'Cache-Control': cc } }
    )
  } catch (err) {
    console.error('[Windsor]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
