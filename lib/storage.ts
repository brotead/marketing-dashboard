import { supabase } from './supabase'
import type { BudgetEntry, GoalEntry, Task, ChangelogEntry } from './types'
import type { WorkspaceCtx } from './workspace'

export type { BudgetEntry, GoalEntry, Task, ChangelogEntry }

// Apply access filter to a query.
// Admin: sees ALL rows — workspace_id on the profile is intentionally ignored because
//   profile.workspace_id may be stale/mismatched relative to budget rows.
// Non-admin: ONLY client assignment filter — same reason, workspace filter skipped.
// Returns null → caller must return [] (user has no access).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyAccess(query: any, ctx: WorkspaceCtx, clientCol = 'client_name'): any {
  if (ctx.isSuperAdmin) return query  // admin always sees everything, no filters

  // Non-admin: client assignments are the authoritative access control
  if (ctx.assignedClients === null) return null  // table missing → deny
  if (ctx.assignedClients.length === 0) return null

  return query.in(clientCol, ctx.assignedClients)
}

// ── Budgets ────────────────────────────────────────────────────────────────────

export async function getBudgets(ctx: WorkspaceCtx): Promise<BudgetEntry[]> {
  const q = applyAccess(supabase.from('budgets').select('*'), ctx)
  if (!q) return []
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function upsertBudget(entry: BudgetEntry, ctx: WorkspaceCtx): Promise<void> {
  const payload = ctx.workspaceId ? { ...entry, workspace_id: ctx.workspaceId } : entry
  const { error } = await supabase
    .from('budgets')
    .upsert(payload, { onConflict: 'campaign_id,year,month' })
  if (error) throw new Error(error.message)
}

export async function removeBudget(campaignId: string, year: number, month: number, ctx: WorkspaceCtx): Promise<void> {
  let query = supabase
    .from('budgets')
    .delete()
    .eq('campaign_id', campaignId)
    .eq('year', year)
    .eq('month', month)
  if (ctx.workspaceId) query = query.eq('workspace_id', ctx.workspaceId)
  const { error } = await query
  if (error) throw new Error(error.message)
}

export async function removeClientAllData(clientName: string, source: string, ctx: WorkspaceCtx): Promise<void> {
  let budgetQ = supabase.from('budgets').delete().eq('client_name', clientName).eq('source', source)
  let goalQ   = supabase.from('goals').delete().eq('client_name', clientName)
  if (ctx.workspaceId) {
    // Delete both workspace-scoped rows AND legacy rows with workspace_id = NULL
    // (rows created before workspace support was added have workspace_id = null and
    // would survive a plain .eq('workspace_id', id) filter, causing the client to
    // reappear via carryover on the next page load).
    budgetQ = budgetQ.or(`workspace_id.eq.${ctx.workspaceId},workspace_id.is.null`)
    goalQ   = goalQ.or(`workspace_id.eq.${ctx.workspaceId},workspace_id.is.null`)
  }
  const [br, gr] = await Promise.all([budgetQ, goalQ])
  if (br.error) throw new Error(br.error.message)
  if (gr.error) throw new Error(gr.error.message)
}

// ── Goals ──────────────────────────────────────────────────────────────────────

export async function getGoals(ctx: WorkspaceCtx): Promise<GoalEntry[]> {
  const q = applyAccess(supabase.from('goals').select('*'), ctx)
  if (!q) return []
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function upsertGoal(entry: GoalEntry, ctx: WorkspaceCtx): Promise<void> {
  const payload = ctx.workspaceId ? { ...entry, workspace_id: ctx.workspaceId } : entry
  const { error } = await supabase
    .from('goals')
    .upsert(payload, { onConflict: 'client_name,year,month,kpi' })
  if (error) throw new Error(error.message)
}

export async function removeGoal(clientName: string, year: number, month: number, kpi: string, ctx: WorkspaceCtx): Promise<void> {
  let query = supabase
    .from('goals')
    .delete()
    .eq('client_name', clientName)
    .eq('year', year)
    .eq('month', month)
    .eq('kpi', kpi)
  if (ctx.workspaceId) query = query.eq('workspace_id', ctx.workspaceId)
  const { error } = await query
  if (error) throw new Error(error.message)
}

// ── Tasks ───────────────────────────────────────────────────────────────────────

export async function getTasks(ctx: WorkspaceCtx): Promise<Task[]> {
  const q = applyAccess(
    supabase.from('tasks').select('*').order('created_at', { ascending: false }),
    ctx,
  )
  if (!q) return []
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return data
}

export async function createTask(task: Omit<Task, 'id' | 'created_at'>, ctx: WorkspaceCtx): Promise<Task> {
  const payload = ctx.workspaceId ? { ...task, workspace_id: ctx.workspaceId } : task
  const { data, error } = await supabase.from('tasks').insert(payload).select().single()
  if (error) throw new Error(error.message)
  return data
}

export async function updateTask(id: string, updates: Partial<Pick<Task, 'status' | 'priority' | 'title' | 'due_date'>>): Promise<void> {
  const { error } = await supabase.from('tasks').update(updates).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function deleteTask(id: string): Promise<void> {
  const { error } = await supabase.from('tasks').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

// ── Changelog ───────────────────────────────────────────────────────────────────

export async function getChangelog(ctx: WorkspaceCtx): Promise<ChangelogEntry[]> {
  const q = applyAccess(
    supabase.from('changelog').select('*').order('created_at', { ascending: false }).limit(300),
    ctx,
  )
  if (!q) return []
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return data
}

export async function createChangelogEntry(entry: Omit<ChangelogEntry, 'id' | 'created_at'>, ctx: WorkspaceCtx): Promise<ChangelogEntry> {
  const payload = ctx.workspaceId ? { ...entry, workspace_id: ctx.workspaceId } : entry
  const { data, error } = await supabase.from('changelog').insert(payload).select().single()
  if (error) throw new Error(error.message)
  return data
}

export async function deleteChangelogEntry(id: string): Promise<void> {
  const { error } = await supabase.from('changelog').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

// ── Hidden clients ──────────────────────────────────────────────────────────────

export interface HiddenClient {
  client_name: string
  source: string
}

export async function getHiddenClients(_ctx: WorkspaceCtx): Promise<HiddenClient[]> {
  const { data, error } = await supabase
    .from('hidden_clients')
    .select('client_name, source')
  if (error?.code === '42P01') return []  // table not created yet — safe fallback
  if (error) return []
  return data ?? []
}

export async function hideClient(clientName: string, source: string, ctx: WorkspaceCtx): Promise<void> {
  const payload: Record<string, string> = { client_name: clientName, source }
  if (ctx.workspaceId) payload.workspace_id = ctx.workspaceId
  const { error } = await supabase
    .from('hidden_clients')
    .upsert(payload, { onConflict: 'client_name,source' })
  if (error) throw new Error(error.message)
}

export async function unhideClient(clientName: string, source: string): Promise<void> {
  const { error } = await supabase
    .from('hidden_clients')
    .delete()
    .eq('client_name', clientName)
    .eq('source', source)
  if (error) throw new Error(error.message)
}

// ── Campaign overrides ──────────────────────────────────────────────────────────

export interface CampaignOverride {
  account_id: string
  source: string
  campaign_name_norm: string
  hidden: boolean
  manual_spent: number | null
  manual_budget: number | null
  paused: boolean
}

export async function getCampaignOverrides(): Promise<CampaignOverride[]> {
  const { data, error } = await supabase
    .from('campaign_overrides')
    .select('account_id, source, campaign_name_norm, hidden, manual_spent, manual_budget, paused')
  if (error?.code === '42P01') return []
  if (error) return []
  return data ?? []
}

export async function setCampaignOverride(
  accountId: string,
  source: string,
  campaignNameNorm: string,
  updates: Partial<Pick<CampaignOverride, 'hidden' | 'manual_spent' | 'manual_budget' | 'paused'>>
): Promise<void> {
  const payload: Record<string, unknown> = {
    account_id: accountId,
    source,
    campaign_name_norm: campaignNameNorm,
    ...updates,
    updated_at: new Date().toISOString(),
  }
  const { error } = await supabase
    .from('campaign_overrides')
    .upsert(payload, { onConflict: 'account_id,source,campaign_name_norm' })
  if (error) throw new Error(error.message)
}

// ── Client assignments ──────────────────────────────────────────────────────────

export async function getClientAssignments(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('user_client_assignments')
    .select('client_name')
    .eq('user_id', userId)
    .order('client_name')
  if (error?.code === '42P01') return []
  if (error) throw new Error(error.message)
  return (data ?? []).map((r: { client_name: string }) => r.client_name)
}

export async function assignClientToUser(userId: string, clientName: string): Promise<void> {
  const { error } = await supabase
    .from('user_client_assignments')
    .upsert({ user_id: userId, client_name: clientName }, { onConflict: 'user_id,client_name' })
  if (error) throw new Error(error.message)
}

export async function removeClientFromUser(userId: string, clientName: string): Promise<void> {
  const { error } = await supabase
    .from('user_client_assignments')
    .delete()
    .eq('user_id', userId)
    .eq('client_name', clientName)
  if (error) throw new Error(error.message)
}
