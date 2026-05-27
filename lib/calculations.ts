import type { BudgetEntry, CashflowResult, PacingResult } from './types'

export type { CashflowResult, PacingResult }

export function normName(s: string): string {
  return s.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[|\-_]+/g, ' ')
    .replace(/\s+/g, ' ').trim()
}

/** Deduplica entries por account+source+nombre normalizado.
 *  Prioriza entradas creadas manualmente (no auto_) y mayor budget_total. */
export function deduplicateBudgets(entries: BudgetEntry[]): BudgetEntry[] {
  const seen = new Map<string, BudgetEntry>()
  for (const b of entries) {
    const key = `${b.account_id}|${b.source}|${normName(b.campaign_name)}`
    const existing = seen.get(key)
    if (!existing) {
      seen.set(key, b)
    } else {
      const bIsAuto        = b.campaign_id.startsWith('auto_')
      const existingIsAuto = existing.campaign_id.startsWith('auto_')
      if (!bIsAuto && existingIsAuto) {
        seen.set(key, b)
      } else if (bIsAuto === existingIsAuto && b.budget_total > existing.budget_total) {
        seen.set(key, b)
      }
    }
  }
  return Array.from(seen.values())
}

function getMonthInfo(year: number, month: number) {
  const today = new Date()
  const isCurrentMonth =
    year === today.getFullYear() && month === today.getMonth() + 1
  const daysInMonth = new Date(year, month, 0).getDate()
  const daysPassed = isCurrentMonth ? today.getDate() : daysInMonth
  const daysLeft = isCurrentMonth ? daysInMonth - daysPassed + 1 : 0
  return { daysInMonth, daysPassed, daysLeft }
}

export function calcCashflow(
  budgetTotal: number,
  spendToDate: number,
  year: number,
  month: number
): CashflowResult {
  const { daysPassed, daysLeft, daysInMonth } = getMonthInfo(year, month)

  const pctConsumed = budgetTotal > 0 ? (spendToDate / budgetTotal) * 100 : 0
  const pctExpected = (daysPassed / daysInMonth) * 100
  const deviation = pctConsumed - pctExpected
  const budgetRemaining = budgetTotal - spendToDate
  const dailyRecommended = daysLeft > 0 ? budgetRemaining / daysLeft : 0

  let status: CashflowResult['status']
  if (Math.abs(deviation) <= 4) status = 'on_track'
  else if (deviation > 4) status = 'overspending'
  else status = 'underspending'

  return {
    budgetTotal,
    spendToDate,
    budgetRemaining,
    pctConsumed,
    pctExpected,
    deviation,
    dailyRecommended,
    daysLeft,
    status,
  }
}

export function calcPacing(
  goalValue: number,
  currentValue: number,
  year: number,
  month: number
): PacingResult {
  const { daysInMonth, daysPassed, daysLeft } = getMonthInfo(year, month)

  const expectedToDate = Math.round((goalValue / daysInMonth) * daysPassed)
  const diff = currentValue - expectedToDate
  const pctVsExpected =
    expectedToDate > 0 ? (currentValue / expectedToDate) * 100 : 0
  const dailyRate = daysPassed > 0 ? currentValue / daysPassed : 0
  const projectedEOM = Math.round(dailyRate * daysInMonth)

  let status: PacingResult['status']
  if (currentValue >= expectedToDate) status = 'on_track'
  else if (currentValue >= expectedToDate * 0.85) status = 'warning'
  else status = 'behind'

  return {
    goalValue,
    currentValue,
    expectedToDate,
    diff,
    pctVsExpected,
    projectedEOM,
    daysLeft,
    status,
  }
}

export function fmt(n: number): string {
  return n.toLocaleString('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  })
}
