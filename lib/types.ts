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
  spend_override?: number | null
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

export interface Task {
  id: string
  client_name: string
  title: string
  priority: 'alta' | 'normal' | 'baja'
  status: 'pendiente' | 'en_progreso' | 'hecho'
  due_date: string | null
  created_at: string
}

export interface ChangelogEntry {
  id: string
  client_name: string
  change_type: 'presupuesto' | 'segmentacion' | 'creatividad' | 'campaña' | 'pausa' | 'audiencia' | 'otro'
  description: string
  created_at: string
}

export interface FatigueSignal {
  type: 'frequency' | 'ctr_drop' | 'cpa_rise' | 'cpm_rise'
  label: string
  detail: string // e.g. "4.2x" or "-42%"
}

export interface FatigueAd {
  ad_id: string
  ad_name: string
  account_name: string
  campaign_name: string
  adset_name: string
  spend_recent: number
  impressions_recent: number
  frequency_recent: number
  ctr_recent: number
  cpm_recent: number
  conversions_recent: number
  ctr_prev: number
  cpm_prev: number
  cpa_prev: number
  cpa_recent: number
  signals: FatigueSignal[]
  signal_count: number
  recommendation: 'PAUSAR' | 'REVISAR' | 'ACTIVO'
  spend_projection: number // estimated spend next 7d at current rate
  spend_month: number      // total spend current month to date
  thumbnail_url: string | null
}

export interface CampaignSpend {
  account_id: string
  source: string
  campaign_name: string
  spend: number
}

export interface AdCreative {
  ad_id: string
  ad_name: string
  campaign_name: string
  account_id: string
  spend: number
  clicks: number
  impressions: number
  mensajes: number
  first_date: string
  last_date: string
  days_active: number
  ctr: number
  cpm: number
  cpr: number
  fatigue: 'active' | 'review' | 'fatigue'
}
