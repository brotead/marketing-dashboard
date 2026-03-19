import { supabase } from './supabase'
import type { BudgetEntry, GoalEntry } from './types'

export type { BudgetEntry, GoalEntry }

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
