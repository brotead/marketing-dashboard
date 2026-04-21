export type Platform = 'meta' | 'google' | 'both'
export type BillingType = 'linea_credito' | 'tarjeta_cliente'

export interface ChecklistItem {
  key:   string
  label: string
  group: 'meta' | 'google' | 'common' | 'tracking'
}

export const CHECKLIST: ChecklistItem[] = [
  { key: 'bm_access',   label: 'Business Manager',    group: 'meta'   },
  { key: 'ad_account',  label: 'Cuenta Publicitaria', group: 'meta'   },
  { key: 'fb_page',     label: 'Página Facebook',     group: 'meta'   },
  { key: 'google_ads',  label: 'Cuenta publicitaria', group: 'google' },
  { key: 'analytics',   label: 'Evento de conversión',group: 'google' },
  { key: 'website_cms', label: 'Sitio web',           group: 'common' },
  { key: 'tag_manager', label: 'Tag Manager',         group: 'common' },
]

export const TRACKING_CHECKLIST: ChecklistItem[] = [
  { key: 't_pixel',  label: 'Meta Pixel',        group: 'tracking' },
  { key: 't_ga4',    label: 'GA4',               group: 'tracking' },
  { key: 't_mobile', label: 'Responsive mobile', group: 'tracking' },
]

export function getBillingType(checklist: Record<string, boolean>): BillingType | null {
  if (checklist['billing_linea_credito'])   return 'linea_credito'
  if (checklist['billing_tarjeta_cliente']) return 'tarjeta_cliente'
  return null
}

export function getRelevantItems(platform: Platform): ChecklistItem[] {
  return CHECKLIST.filter(item => {
    if (item.group === 'common') return true
    if (item.group === 'meta'   && (platform === 'meta'   || platform === 'both')) return true
    if (item.group === 'google' && (platform === 'google' || platform === 'both')) return true
    return false
  })
}

export function checklistProgress(platform: Platform, checklist: Record<string, boolean>) {
  const items          = getRelevantItems(platform)
  const checked        = items.filter(i => checklist[i.key]).length
  const billingChecked = getBillingType(checklist) !== null ? 1 : 0
  return { checked: checked + billingChecked, total: items.length + 1 }
}

export function trackingProgress(checklist: Record<string, boolean>) {
  const checked = TRACKING_CHECKLIST.filter(i => checklist[i.key]).length
  return { checked, total: TRACKING_CHECKLIST.length }
}

export interface OnboardingClient {
  id:          string
  name:        string
  platform:    Platform
  website:     string | null
  checklist:   Record<string, boolean>
  created_at:  string
}

export const PLATFORM_LABELS: Record<Platform, string> = {
  meta:   'Solo Meta Ads',
  google: 'Solo Google Ads',
  both:   'Meta + Google',
}

export const PLATFORM_SHORT: Record<Platform, string> = {
  meta:   'Meta',
  google: 'Google',
  both:   'Meta + Google',
}
