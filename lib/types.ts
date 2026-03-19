export interface CampaignData {
  campaign_id: string
  campaign_name: string | null
  source: string
  spend: number
  conversions: number
  clicks: number
  impressions: number
}

export interface AccountData {
  account_id: string
  account_name: string
  source: string
  spend: number
  recent_spend: number   // spend in last 7 days
  campaign_count: number
}

export interface BudgetEntry {
  campaign_id: string    // internal ID (can be "bb_1", "hsf_2", etc.)
  campaign_name: string
  client_name: string
  source: string
  account_id: string     // Meta/Google account ID → used to match Windsor spend
  year: number
  month: number
  budget_total: number
  paused?: boolean
}

export interface GoalEntry {
  client_name: string
  kpi: 'mensajes' | 'seguidores' | 'conversiones'
  year: number
  month: number
  goal_value: number
  current_override?: number | null
}

export interface CashflowResult {
  budgetTotal: number
  spendToDate: number
  budgetRemaining: number
  pctConsumed: number
  pctExpected: number
  deviation: number
  dailyRecommended: number
  daysLeft: number
  status: 'on_track' | 'overspending' | 'underspending'
}

export interface PacingResult {
  goalValue: number
  currentValue: number
  expectedToDate: number
  diff: number
  pctVsExpected: number
  projectedEOM: number
  daysLeft: number
  status: 'on_track' | 'warning' | 'behind'
}
