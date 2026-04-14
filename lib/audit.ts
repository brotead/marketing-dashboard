const WINDSOR_FACEBOOK = 'https://connectors.windsor.ai/facebook'

export type Status  = 'green' | 'yellow' | 'red'
export type Health  = 'excellent' | 'stable' | 'review' | 'priority'

export interface ClientAudit {
  account_id:   string
  account_name: string
  client_name:  string
  score:        number
  health:       Health
  // Current (recent 7d)
  ctr:          number
  cpm:          number
  frequency:    number
  cpl:          number
  spend:        number
  leads:        number
  // % change vs prev 7d
  ctr_change:   number | null
  cpm_change:   number | null
  cpl_change:   number | null
  // Signal statuses
  ctr_status:   Status
  cpm_status:   Status
  freq_status:  Status
  cpl_status:   Status | 'none'
  // Diagnosis
  diagnosis:    string
  action:       string
  tags:         string[]
  has_cpl:      boolean
}

export interface AuditData {
  results:     ClientAudit[]
  total_spend: number
  total_leads: number
  updated_at:  string
}

// ── Fetch one period ─────────────────────────────────────────────────────────

interface RawRecord {
  account_id?:   string | null
  account_name?: string | null
  spend?:        number | string | null
  impressions?:  number | string | null
  clicks?:       number | string | null
  reach?:        number | string | null
  actions?:      { action_type: string; value: string }[]
}

interface PeriodMetrics {
  account_name: string
  spend:        number
  impressions:  number
  clicks:       number
  reach:        number
  leads:        number
}

function extractLeads(actions?: { action_type: string; value: string }[]): number {
  if (!actions) return 0
  const types = [
    'lead',
    'offsite_conversion.fb_pixel_lead',
    'onsite_conversion.lead_grouped',
    'onsite_conversion.messaging_conversation_started_7d',
  ]
  for (const t of types) {
    const hit = actions.find(a => a.action_type === t)
    if (hit) return Number(hit.value) || 0
  }
  return 0
}

async function fetchPeriod(dateFrom: string, dateTo: string): Promise<Map<string, PeriodMetrics>> {
  const apiKey = process.env.WINDSOR_API_KEY
  if (!apiKey) throw new Error('WINDSOR_API_KEY no configurada')

  const url = new URL(WINDSOR_FACEBOOK)
  url.searchParams.set('api_key',   apiKey)
  url.searchParams.set('date_from', dateFrom)
  url.searchParams.set('date_to',   dateTo)
  // No 'date' dimension → Windsor returns one aggregated row per account
  url.searchParams.set('fields', 'account_id,account_name,spend,impressions,clicks,reach,actions')
  url.searchParams.set('_renderer', 'json')

  const res = await fetch(url.toString(), { cache: 'no-store' })
  if (!res.ok) throw new Error(`Windsor error ${res.status}`)

  const json  = await res.json()
  const recs: RawRecord[] = json.data ?? []

  const map = new Map<string, PeriodMetrics>()
  for (const r of recs) {
    if (!r.account_id) continue
    if (!map.has(r.account_id)) {
      map.set(r.account_id, {
        account_name: String(r.account_name ?? r.account_id),
        spend: 0, impressions: 0, clicks: 0, reach: 0, leads: 0,
      })
    }
    const m = map.get(r.account_id)!
    m.spend       += Number(r.spend       ?? 0)
    m.impressions += Number(r.impressions ?? 0)
    m.clicks      += Number(r.clicks      ?? 0)
    m.reach       += Number(r.reach       ?? 0)
    m.leads       += extractLeads(r.actions)
  }
  return map
}

// ── Signal thresholds ─────────────────────────────────────────────────────────

function ctrStatus(change: number | null): Status {
  if (change === null) return 'yellow'
  if (change >  10)   return 'green'
  if (change < -15)   return 'red'
  return 'yellow'
}

function cpmStatus(change: number | null): Status {
  if (change === null) return 'yellow'
  if (change < -10)   return 'green'
  if (change >  20)   return 'red'
  return 'yellow'
}

function freqStatus(freq: number, hasReach: boolean): Status {
  if (!hasReach) return 'yellow'
  if (freq <= 2.2)    return 'green'
  if (freq <= 3.0)    return 'yellow'
  return 'red'
}

function cplStatus(change: number | null): Status {
  if (change === null) return 'yellow'
  if (change < -10)   return 'green'
  if (change >  18)   return 'red'
  return 'yellow'
}

function statusScore(s: Status): number {
  return s === 'green' ? 2 : s === 'red' ? -2 : 0
}

// ── Diagnosis rules ───────────────────────────────────────────────────────────

function diagnose(
  ctr: Status, cpm: Status, freq: Status, cpl: Status, hasCpl: boolean
): { diagnosis: string; action: string; tags: string[] } {
  // Caso 3: Problema completo (tiene prioridad máxima)
  if (ctr === 'red' && cpm === 'red' && hasCpl && cpl === 'red') return {
    diagnosis: 'Problema creativo + público + funnel',
    action:    'Crear anuncios nuevos, nuevo público y revisar landing / WhatsApp / ventas.',
    tags:      ['Creativo agotado', 'Público nuevo'],
  }
  // Caso 1: Creativo agotado
  if (ctr === 'red' && freq === 'red') return {
    diagnosis: 'Creativo agotado',
    action:    'Cambiar anuncios, nuevos copies y creatividades esta semana.',
    tags:      ['Creativo agotado'],
  }
  // Caso 5: Buen tráfico pero no convierte
  if (ctr === 'green' && hasCpl && cpl === 'red') return {
    diagnosis: 'Problema post click',
    action:    'Revisar landing page, formulario, atención comercial o cierre de ventas.',
    tags:      [],
  }
  // Caso 2: Público caro/saturado
  if (cpm === 'red' && (ctr === 'yellow' || ctr === 'green')) return {
    diagnosis: 'Audiencia cara o limitada',
    action:    'Probar nuevos públicos, broad, lookalikes o expandir geografía.',
    tags:      ['Público nuevo'],
  }
  // Caso 4: Escalable
  if (ctr === 'green' && freq === 'green' && (!hasCpl || cpl === 'green')) return {
    diagnosis: 'Cuenta saludable — escalable',
    action:    'Subir presupuesto entre 10% y 20%.',
    tags:      ['Escalar'],
  }
  return {
    diagnosis: 'Performance estable',
    action:    'Monitorear evolución durante la semana.',
    tags:      [],
  }
}

// ── Main audit function ───────────────────────────────────────────────────────

export async function runAudit(
  accountMap: Record<string, string>   // account_id → client_name (from Supabase)
): Promise<AuditData> {
  const today   = new Date()
  const fmt     = (d: Date) => d.toISOString().split('T')[0]
  const sub     = (d: Date, days: number) => { const r = new Date(d); r.setDate(r.getDate() - days); return r }

  const recentTo   = sub(today, 1)   // yesterday
  const recentFrom = sub(today, 7)   // 7 days back
  const prevTo     = sub(today, 8)
  const prevFrom   = sub(today, 14)

  const [recentMap, prevMap] = await Promise.all([
    fetchPeriod(fmt(recentFrom), fmt(recentTo)),
    fetchPeriod(fmt(prevFrom),   fmt(prevTo)),
  ])

  const results: ClientAudit[] = []
  let total_spend = 0
  let total_leads = 0

  for (const [accId, recent] of Array.from(recentMap.entries())) {
    if (recent.spend < 500) continue   // skip accounts with negligible spend

    const prev = prevMap.get(accId)

    const ctr_r  = recent.impressions > 0 ? (recent.clicks / recent.impressions) * 100  : 0
    const cpm_r  = recent.impressions > 0 ? (recent.spend  / recent.impressions) * 1000 : 0
    const freq_r = recent.reach > 0        ? recent.impressions / recent.reach           : 0
    const cpl_r  = recent.leads > 0        ? recent.spend / recent.leads                 : 0
    const hasCpl = recent.leads > 0

    let ctr_change: number | null = null
    let cpm_change: number | null = null
    let cpl_change: number | null = null

    if (prev && prev.impressions > 0) {
      const ctr_p = (prev.clicks / prev.impressions) * 100
      const cpm_p = (prev.spend  / prev.impressions) * 1000
      if (ctr_p > 0) ctr_change = ((ctr_r - ctr_p) / ctr_p) * 100
      if (cpm_p > 0) cpm_change = ((cpm_r - cpm_p) / cpm_p) * 100
      if (hasCpl && prev.leads > 0) {
        const cpl_p = prev.spend / prev.leads
        if (cpl_p > 0) cpl_change = ((cpl_r - cpl_p) / cpl_p) * 100
      }
    }

    const ctr_s  = ctrStatus(ctr_change)
    const cpm_s  = cpmStatus(cpm_change)
    const freq_s = freqStatus(freq_r, recent.reach > 0)
    const cpl_s  = hasCpl ? cplStatus(cpl_change) : ('none' as const)

    const score =
      statusScore(ctr_s) +
      statusScore(cpm_s) +
      statusScore(freq_s) +
      (hasCpl ? statusScore(cpl_s as Status) : 0)

    const health: Health =
      score >= 6  ? 'excellent' :
      score >= 1  ? 'stable'    :
      score >= -5 ? 'review'    : 'priority'

    const { diagnosis, action, tags } = diagnose(
      ctr_s, cpm_s, freq_s,
      hasCpl ? (cpl_s as Status) : 'yellow',
      hasCpl
    )

    total_spend += recent.spend
    total_leads += recent.leads

    results.push({
      account_id:   accId,
      account_name: recent.account_name,
      client_name:  accountMap[accId] ?? recent.account_name,
      score, health,
      ctr: ctr_r, cpm: cpm_r, frequency: freq_r, cpl: cpl_r,
      spend: recent.spend, leads: recent.leads,
      ctr_change, cpm_change, cpl_change,
      ctr_status: ctr_s, cpm_status: cpm_s, freq_status: freq_s, cpl_status: cpl_s,
      diagnosis, action, tags, has_cpl: hasCpl,
    })
  }

  results.sort((a, b) => a.score - b.score)

  return { results, total_spend, total_leads, updated_at: new Date().toISOString() }
}
