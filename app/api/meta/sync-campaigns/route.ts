import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fetchMetaCampaignList, getMetaDirectIdsFull } from '@/lib/meta'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const INACTIVE = new Set(['PAUSED', 'ARCHIVED', 'DELETED'])

function normName(s: string): string {
  return s.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[|\-_]+/g, ' ')
    .replace(/\s+/g, ' ').trim()
}

async function runSync() {
  if (!process.env.META_ACCESS_TOKEN) {
    return NextResponse.json({ error: 'META_ACCESS_TOKEN not set' }, { status: 500 })
  }

  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const log: string[] = []

  // 1. All accounts to sync: meta_direct_accounts PLUS any account already in budgets table.
  // This ensures accounts linked via Windsor (not meta_direct) are also covered.
  const metaDirectIds = await getMetaDirectIdsFull()

  const { data: budgetAccounts } = await supabase
    .from('budgets')
    .select('account_id')
    .eq('source', 'facebook')
    .neq('account_id', '__pending__')

  const allAccountIds = new Set<string>(metaDirectIds)
  for (const row of (budgetAccounts ?? [])) {
    if (row.account_id) allAccountIds.add(row.account_id)
  }

  const accountIds = Array.from(allAccountIds)
  if (accountIds.length === 0) {
    return NextResponse.json({ log: ['No accounts configured'], synced: { new: 0, updated: 0, paused: 0 } })
  }
  log.push(`[Sync] Accounts (${accountIds.length}): ${accountIds.join(', ')}`)

  // 2. Load existing budgets for these accounts to find client_name + current-month state
  const { data: allBudgets, error: budgetErr } = await supabase
    .from('budgets')
    .select('campaign_id, campaign_name, client_name, account_id, year, month, paused, workspace_id')
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

  // Current-month budget entries keyed by campaign_id and by normalized name
  const currentMonth = budgets.filter(b => b.year === year && b.month === month)
  const byKey: Record<string, typeof budgets[0]> = {}
  // account_id|normName → all matching entries (catches fa_, auto_, manual IDs)
  const byName: Record<string, typeof budgets> = {}
  for (const b of currentMonth) {
    byKey[b.campaign_id] = b
    const nameKey = `${b.account_id}|${normName(b.campaign_name)}`
    byName[nameKey] = byName[nameKey] ?? []
    byName[nameKey].push(b)
  }

  // workspace used per account (for inserting new campaigns in the right workspace)
  const workspaceByAccount: Record<string, string | null> = {}
  for (const b of budgets) {
    if (b.workspace_id && !workspaceByAccount[b.account_id]) {
      workspaceByAccount[b.account_id] = b.workspace_id
    }
  }

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

    // Placeholder entries: only the generic __auto__ sentinel created on client setup.
    // Never touch manually-added campaigns or campaigns with other ID formats.
    const placeholders = currentMonth.filter(
      b => b.account_id === accountId && (b.campaign_id === '__auto__' || b.campaign_id.startsWith('__'))
    )

    for (const campaign of accountCampaigns) {
      const campaignId = `meta_${campaign.id}`
      const isActive = !INACTIVE.has(campaign.effective_status)
      const shouldPause = !isActive
      const existing = byKey[campaignId]

      // Also check by normalized name so we don't insert a meta_ duplicate
      // for campaigns that already exist under a different ID (bb_1_apr, auto_fb_, etc.)
      const nameKey = `${accountId}|${normName(campaign.name)}`
      const existingByName = byName[nameKey]?.find((b: { campaign_id: string }) => b.campaign_id !== campaignId)

      if (!existing && !existingByName) {
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
            workspace_id:  workspaceByAccount[accountId] ?? null,
          })
          if (!error) {
            newCount++
            log.push(`[Sync] NEW: "${campaign.name}" (${campaignId}) → ${clientName}`)
          } else {
            log.push(`[Sync] ERROR inserting ${campaignId}: ${error.message}`)
          }
        }
      } else {
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

      // Also sync paused state to any name-matched entries (fa_, auto_, or manual IDs)
      // that represent the same Meta campaign but were created outside the sync flow.
      const nameKey = `${accountId}|${normName(campaign.name)}`
      const nameMatches = (byName[nameKey] ?? []).filter(b => b.campaign_id !== campaignId)
      for (const match of nameMatches) {
        if (!!match.paused !== shouldPause) {
          await supabase.from('budgets')
            .update({ paused: shouldPause })
            .eq('campaign_id', match.campaign_id)
            .eq('year', year)
            .eq('month', month)
          updatedCount++
          if (shouldPause) {
            pausedCount++
            log.push(`[Sync] PAUSED (name-match): "${campaign.name}" (${match.campaign_id})`)
          } else {
            log.push(`[Sync] RESUMED (name-match): "${campaign.name}" (${match.campaign_id})`)
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

// GET — called by Vercel Cron every hour. Protected by CRON_SECRET.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  const auth   = req.headers.get('authorization')
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return runSync()
}

// POST — called manually from the dashboard client (no secret needed, auth via session)
export async function POST() {
  return runSync()
}
