import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fetchMetaCampaignList, getMetaDirectIdsFull } from '@/lib/meta'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const INACTIVE = new Set(['PAUSED', 'ARCHIVED', 'DELETED'])

export async function POST() {
  if (!process.env.META_ACCESS_TOKEN) {
    return NextResponse.json({ error: 'META_ACCESS_TOKEN not set' }, { status: 500 })
  }

  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const log: string[] = []

  // 1. All meta_direct account IDs
  const metaDirectIds = await getMetaDirectIdsFull()
  const accountIds = Array.from(metaDirectIds)
  if (accountIds.length === 0) {
    return NextResponse.json({ log: ['No meta_direct_accounts configured'], synced: { new: 0, updated: 0, paused: 0 } })
  }
  log.push(`[Sync] Accounts: ${accountIds.join(', ')}`)

  // 2. Load existing budgets for these accounts to find client_name + current-month state
  const { data: allBudgets, error: budgetErr } = await supabase
    .from('budgets')
    .select('campaign_id, campaign_name, client_name, account_id, year, month, paused')
    .in('account_id', accountIds)
    .eq('source', 'facebook')
  if (budgetErr) return NextResponse.json({ error: budgetErr.message }, { status: 500 })

  const budgets = allBudgets ?? []

  // client_name: first non-empty value found per account (any month)
  const clientByAccount: Record<string, string> = {}
  for (const b of budgets) {
    if (b.client_name && !clientByAccount[b.account_id]) {
      clientByAccount[b.account_id] = b.client_name
    }
  }

  // Current-month budget entries keyed by campaign_id
  const currentMonth = budgets.filter(b => b.year === year && b.month === month)
  const byKey: Record<string, typeof budgets[0]> = {}
  for (const b of currentMonth) byKey[b.campaign_id] = b

  // 3. Fetch campaign list from Meta API
  const campaigns = await fetchMetaCampaignList(accountIds)
  log.push(`[Sync] Fetched ${campaigns.length} campaigns from Meta API`)

  let newCount = 0, updatedCount = 0, pausedCount = 0

  // Group by account
  const byAccount: Record<string, typeof campaigns> = {}
  for (const c of campaigns) {
    byAccount[c.account_id] = byAccount[c.account_id] ?? []
    byAccount[c.account_id].push(c)
  }

  for (const accountId of accountIds) {
    const accountCampaigns = byAccount[accountId] ?? []
    const clientName = clientByAccount[accountId]

    if (!clientName) {
      log.push(`[Sync] act_${accountId}: no client_name in budgets — skipping`)
      continue
    }

    // Placeholder entries for this account this month (campaign_id does NOT start with meta_)
    const placeholders = currentMonth.filter(
      b => b.account_id === accountId && !b.campaign_id.startsWith('meta_')
    )

    for (const campaign of accountCampaigns) {
      const campaignId = `meta_${campaign.id}`
      const isActive = !INACTIVE.has(campaign.effective_status)
      const existing = byKey[campaignId]

      if (!existing) {
        if (isActive) {
          const { error } = await supabase.from('budgets').insert({
            campaign_id:   campaignId,
            campaign_name: campaign.name,
            client_name:   clientName,
            source:        'facebook',
            account_id:    accountId,
            year,
            month,
            budget_total:  0,
            paused:        false,
          })
          if (!error) {
            newCount++
            log.push(`[Sync] NEW: "${campaign.name}" (${campaignId}) → ${clientName}`)
          } else {
            log.push(`[Sync] ERROR inserting ${campaignId}: ${error.message}`)
          }
        }
      } else {
        const shouldPause = !isActive
        if (!!existing.paused !== shouldPause) {
          await supabase.from('budgets')
            .update({ paused: shouldPause, campaign_name: campaign.name })
            .eq('campaign_id', campaignId)
            .eq('year', year)
            .eq('month', month)
          updatedCount++
          if (shouldPause) {
            pausedCount++
            log.push(`[Sync] PAUSED: "${campaign.name}" (${campaignId})`)
          } else {
            log.push(`[Sync] RESUMED: "${campaign.name}" (${campaignId})`)
          }
        }
      }
    }

    // Once real meta_ campaigns exist, retire any placeholder entries
    const activeMeta = accountCampaigns.filter(c => !INACTIVE.has(c.effective_status))
    if (activeMeta.length > 0) {
      for (const ph of placeholders) {
        if (!ph.paused) {
          await supabase.from('budgets')
            .update({ paused: true })
            .eq('campaign_id', ph.campaign_id)
            .eq('year', year)
            .eq('month', month)
          pausedCount++
          log.push(`[Sync] RETIRED placeholder: "${ph.campaign_name}" (${ph.campaign_id})`)
        }
      }
    }
  }

  log.push(`[Sync] Done — new: ${newCount}, updated: ${updatedCount}, paused: ${pausedCount}`)
  return NextResponse.json({ ok: true, synced: { new: newCount, updated: updatedCount, paused: pausedCount }, log })
}
