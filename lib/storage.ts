import { supabase } from './supabase'
import type { BudgetEntry, GoalEntry, Task, ChangelogEntry } from './types'
import type { WorkspaceCtx } from './workspace'

export type { BudgetEntry, GoalEntry, Task, ChangelogEntry }

// ── Budgets ────────────────────────────────────────────────────────────────────

export async function getBudgets(ctx: WorkspaceCtx): Promise<BudgetEntry[]> {
  let query = supabase.from('budgets').select('*')
  if (ctx.workspaceId) {
    query = query.eq('workspace_id', ctx.workspaceId)
  } else if (!ctx.isSuperAdmin) {
    return []
  }
  const { data, error } = await query
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
    budgetQ = budgetQ.eq('workspace_id', ctx.workspaceId)
    goalQ   = goalQ.eq('workspace_id', ctx.workspaceId)
  }
  const [br, gr] = await Promise.all([budgetQ, goalQ])
  if (br.error) throw new Error(br.error.message)
  if (gr.error) throw new Error(gr.error.message)
}

// ── Goals ──────────────────────────────────────────────────────────────────────

export async function getGoals(ctx: WorkspaceCtx): Promise<GoalEntry[]> {
  let query = supabase.from('goals').select('*')
  if (ctx.workspaceId) {
    query = query.eq('workspace_id', ctx.workspaceId)
  } else if (!ctx.isSuperAdmin) {
    return []
  }
  const { data, error } = await query
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
  let query = supabase.from('tasks').select('*').order('created_at', { ascending: false })
  if (ctx.workspaceId) {
    query = query.eq('workspace_id', ctx.workspaceId)
  } else if (!ctx.isSuperAdmin) {
    return []
  }
  const { data, error } = await query
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
  let query = supabase.from('changelog').select('*').order('created_at', { ascending: false }).limit(300)
  if (ctx.workspaceId) {
    query = query.eq('workspace_id', ctx.workspaceId)
  } else if (!ctx.isSuperAdmin) {
    return []
  }
  const { data, error } = await query
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
