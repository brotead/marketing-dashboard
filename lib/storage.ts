import { supabase } from './supabase'
import type { BudgetEntry, GoalEntry, Task, ChangelogEntry } from './types'

export type { BudgetEntry, GoalEntry, Task, ChangelogEntry }

// ── Budgets ────────────────────────────────────────────────────────────────────

export async function getBudgets(): Promise<BudgetEntry[]> {
  const { data, error } = await supabase.from('budgets').select('*')
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function upsertBudget(entry: BudgetEntry): Promise<void> {
  const { error } = await supabase
    .from('budgets')
    .upsert(entry, { onConflict: 'campaign_id,year,month' })
  if (error) throw new Error(error.message)
}

export async function removeBudget(campaignId: string, year: number, month: number): Promise<void> {
  const { error } = await supabase
    .from('budgets')
    .delete()
    .eq('campaign_id', campaignId)
    .eq('year', year)
    .eq('month', month)
  if (error) throw new Error(error.message)
}

export async function removeClientAllData(clientName: string, source: string): Promise<void> {
  const [budgetsResult, goalsResult] = await Promise.all([
    supabase.from('budgets').delete().eq('client_name', clientName).eq('source', source),
    supabase.from('goals').delete().eq('client_name', clientName),
  ])
  if (budgetsResult.error) throw new Error(budgetsResult.error.message)
  if (goalsResult.error) throw new Error(goalsResult.error.message)
}

// ── Goals ──────────────────────────────────────────────────────────────────────

export async function getGoals(): Promise<GoalEntry[]> {
  const { data, error } = await supabase.from('goals').select('*')
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function upsertGoal(entry: GoalEntry): Promise<void> {
  const { error } = await supabase
    .from('goals')
    .upsert(entry, { onConflict: 'client_name,year,month,kpi' })
  if (error) throw new Error(error.message)
}

export async function removeGoal(clientName: string, year: number, month: number, kpi: string): Promise<void> {
  const { error } = await supabase
    .from('goals')
    .delete()
    .eq('client_name', clientName)
    .eq('year', year)
    .eq('month', month)
    .eq('kpi', kpi)
  if (error) throw new Error(error.message)
}

// ── Tasks ───────────────────────────────────────────────────────────────────────

export async function getTasks(): Promise<Task[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function createTask(task: Omit<Task, 'id' | 'created_at'>): Promise<Task> {
  const { data, error } = await supabase
    .from('tasks').insert(task).select().single()
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

export async function getChangelog(): Promise<ChangelogEntry[]> {
  const { data, error } = await supabase
    .from('changelog')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(300)
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function createChangelogEntry(entry: Omit<ChangelogEntry, 'id' | 'created_at'>): Promise<ChangelogEntry> {
  const { data, error } = await supabase
    .from('changelog').insert(entry).select().single()
  if (error) throw new Error(error.message)
  return data
}

export async function deleteChangelogEntry(id: string): Promise<void> {
  const { error } = await supabase.from('changelog').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
