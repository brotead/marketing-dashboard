import fs from 'fs'
import path from 'path'
import type { BudgetEntry, GoalEntry } from './types'

export type { BudgetEntry, GoalEntry }

const DATA_DIR = path.join(process.cwd(), 'data')

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
}

function read<T>(file: string, def: T): T {
  ensureDir()
  const p = path.join(DATA_DIR, file)
  if (!fs.existsSync(p)) return def
  try { return JSON.parse(fs.readFileSync(p, 'utf-8')) } catch { return def }
}

function write<T>(file: string, data: T) {
  ensureDir()
  fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(data, null, 2), 'utf-8')
}

// ── Budgets ────────────────────────────────────────────────────────────────────

export function getBudgets(): BudgetEntry[] {
  return read<BudgetEntry[]>('budgets.json', [])
}

export function upsertBudget(entry: BudgetEntry) {
  const all = getBudgets()
  const idx = all.findIndex((b) => b.campaign_id === entry.campaign_id && b.year === entry.year && b.month === entry.month)
  if (idx >= 0) all[idx] = entry
  else all.push(entry)
  write('budgets.json', all)
}

export function removeBudget(campaignId: string, year: number, month: number) {
  write('budgets.json', getBudgets().filter(
    (b) => !(b.campaign_id === campaignId && b.year === year && b.month === month)
  ))
}

// ── Goals ──────────────────────────────────────────────────────────────────────

export function getGoals(): GoalEntry[] {
  return read<GoalEntry[]>('goals.json', [])
}

export function upsertGoal(entry: GoalEntry) {
  const all = getGoals()
  const idx = all.findIndex(
    (g) => g.client_name === entry.client_name && g.year === entry.year && g.month === entry.month && g.kpi === entry.kpi
  )
  if (idx >= 0) all[idx] = entry
  else all.push(entry)
  write('goals.json', all)
}

export function removeGoal(clientName: string, year: number, month: number, kpi: string) {
  write('goals.json', getGoals().filter(
    (g) => !(g.client_name === clientName && g.year === year && g.month === month && g.kpi === kpi)
  ))
}
