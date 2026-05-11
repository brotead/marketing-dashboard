const WINDSOR_FACEBOOK = 'https://connectors.windsor.ai/facebook'

// ── In-memory audit cache (15 min TTL) ─────────────────────────────────────────
const _auditCache = new Map<string, { data: AuditData; ts: number }>()
const AUDIT_TTL = 15 * 60 * 1000 // 15 minutes

export type Status = 'green' | 'yellow' | 'red'
export type Health = 'excellent' | 'stable' | 'review' | 'priority'

// ── Client type: messaging vs IG visits ─────────────────────────────────────

export type ClientType = 'messaging' | 'ig'

const MESSAGING_CLIENT_NAMES = new Set(['DURAPLAS', 'HSF', 'BERTOTTO', 'REMAX', 'BB'])

export function getClientType(name: string): ClientType {
  return MESSAGING_CLIENT_NAMES.has(name.toUpperCase().trim()) ? 'messaging' : 'ig'
}

// ── Windsor raw types ────────────────────────────────────────────────────────

interface RawRow {
  account_id?:    string | null
  account_name?:  string | null
  campaign_id?:   string | null
  campaign?:      string | null
  spend?:         number | null
  impressions?:   number | null
  cpm?:           number | null
  link_clicks?:   number | null
  actions_lead?:  number | null
  actions_onsite_conversion_lead_grouped?:                         number | null
  actions_onsite_conversion_messaging_conversation_started_7d?:   number | null
  actions_instagram_profile_visit?:                                number | null
  actions_purchase?:                                               number | null
  actions_omni_purchase?:                                          number | null
}

// Windsor fields — CTR computed as link_clicks/impressions
const ACCOUNT_FIELDS = [
  'account_id', 'account_name',
  'spend', 'impressions', 'cpm', 'link_clicks',
  'actions_lead',
  'actions_onsite_conversion_lead_grouped',
  'actions_onsite_conversion_messaging_conversation_started_7d',
  'actions_instagram_profile_visit',
  'actions_purchase',
  'actions_omni_purchase',
].join(',')

const CAMPAIGN_FIELDS = [
  'account_id', 'campaign_id', 'campaign',
  'spend', 'impressions', 'cpm', 'link_clicks',
  'actions_lead',
  'actions_onsite_conversion_lead_grouped',
  'actions_onsite_conversion_messaging_conversation_started_7d',
  'actions_instagram_profile_visit',
  'actions_purchase',
  'actions_omni_purchase',
].join(',')

// ── Computed metrics ─────────────────────────────────────────────────────────

export interface Metrics {
  spend:            number
  impressions:      number
  ctr:              number   // link click CTR in %
  cpm:              number
  link_clicks:      number
  results:          number   // total results
  messaging:        number   // conversaciones iniciadas
  ig_visits:        number   // Instagram profile visits
  purchases:        number   // purchases/compras count
}

// Windsor sometimes returns numeric fields as strings — always parse
function n(v: number | null | undefined): number {
  if (v == null) return 0
  const p = typeof v === 'string' ? parseFloat(v as unknown as string) : v
  return isNaN(p) ? 0 : p
}

function toMetrics(r: RawRow): Metrics {
  const impressions = n(r.impressions)
  const link_clicks = n(r.link_clicks)
  const messaging   = n(r.actions_onsite_conversion_messaging_conversation_started_7d)
  const ig_visits   = n(r.actions_instagram_profile_visit)
  // results = only lead-type conversions; messaging is tracked separately
  const results     = n(r.actions_lead) + n(r.actions_onsite_conversion_lead_grouped)
  const purchases   = n(r.actions_purchase) + n(r.actions_omni_purchase)
  return {
    spend:       n(r.spend),
    impressions,
    ctr:         impressions > 0 ? (link_clicks / impressions) * 100 : 0,
    cpm:         n(r.cpm),
    link_clicks,
    results,
    messaging,
    ig_visits,
    purchases,
  }
}

// ── Fetch one period ─────────────────────────────────────────────────────────

async function fetchPeriod(
  dateFrom:    string,
  dateTo:      string,
  fields:      string,
  allowedIds?: Set<string>
): Promise<RawRow[]> {
  const apiKey = process.env.WINDSOR_API_KEY
  if (!apiKey) throw new Error('WINDSOR_API_KEY no configurada')

  const url = new URL(WINDSOR_FACEBOOK)
  url.searchParams.set('api_key',   apiKey)
  url.searchParams.set('date_from', dateFrom)
  url.searchParams.set('date_to',   dateTo)
  url.searchParams.set('fields',    fields)
  url.searchParams.set('_renderer', 'json')

  const res = await fetch(url.toString(), { cache: 'no-store' })
  if (!res.ok) throw new Error(`Windsor error ${res.status}`)

  const json = await res.json()
  let rows: RawRow[] = json.data ?? []

  if (allowedIds && allowedIds.size > 0) {
    rows = rows.filter(r => r.account_id && allowedIds.has(r.account_id))
  }
  return rows
}

// ── Signal thresholds ────────────────────────────────────────────────────────

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
function cplStatus(change: number | null): Status {
  if (change === null) return 'yellow'
  if (change < -10)   return 'green'
  if (change >  18)   return 'red'
  return 'yellow'
}
// Conversiones: more is always better → positive = green, negative = red
function conversionsStatus(change: number | null): Status {
  if (change === null) return 'yellow'
  if (change >   5)   return 'green'
  if (change < -10)   return 'red'
  return 'yellow'
}
function statusScore(s: Status): number {
  return s === 'green' ? 2 : s === 'red' ? -2 : 0
}

// ── Diagnosis engine — Priority: CPL > CTR > CPM ────────────────────────────

function diagnose(
  ctr_s: Status, cpm_s: Status,
  cpl_s: Status, hasCpl: boolean,
  m: Metrics, prev: Metrics | null
): { diagnosis: string; action: string; insight: string; tip: string; tags: string[] } {

  // ── CPL RULES (highest priority) ──────────────────────────────────────────
  // CPL bad + CTR bad → total problem
  if (hasCpl && cpl_s === 'red' && ctr_s === 'red') return {
    diagnosis: 'Problema integral',
    action:    'Pausar y reestructurar: nuevos creativos, nueva segmentación y revisar el funnel de conversión.',
    insight:   'CPL alto y CTR bajo al mismo tiempo: el anuncio no engancha y el funnel no cierra. Requiere intervención completa.',
    tip:       'Empezar con presupuesto bajo (30-40% del anterior) al relanzar para dejar que el algoritmo aprenda antes de escalar.',
    tags: ['Creativo agotado', 'Público nuevo'],
  }

  // CPL bad + CTR ok → landing/funnel problem
  if (hasCpl && cpl_s === 'red') return {
    diagnosis: 'Problema post-clic',
    action:    'Revisar landing page, velocidad de carga, formulario de contacto y tiempo de respuesta del equipo de ventas.',
    insight:   'Los anuncios reciben clics (CTR aceptable) pero los resultados no llegan. El cuello de botella está después del clic: landing, formulario o seguimiento comercial.',
    tip:       'Verificar velocidad de la landing con PageSpeed Insights y que el formulario funcione correctamente en mobile.',
    tags: [],
  }

  // CPL good + CTR good → excellent, scale
  if (hasCpl && cpl_s === 'green' && ctr_s === 'green') return {
    diagnosis: 'Cuenta escalable',
    action:    'Incrementar presupuesto entre 10% y 20% cada 3-4 días para maximizar resultados sin romper el algoritmo.',
    insight:   'CPL mejorando y CTR sano: el funnel de conversión funciona bien y los anuncios enganchan. Es el momento ideal para escalar de forma gradual.',
    tip:       'Al escalar, considerar un test A/B de audiencias similares (lookalike 2-3%) para ampliar volumen sin saturar la base actual.',
    tags: ['Escalar'],
  }

  // CPL good (even if CTR/CPM weak) → account is fine, just monitor
  if (hasCpl && cpl_s === 'green') return {
    diagnosis: 'CPL saludable',
    action:    'Mantener configuración y monitorear CTR y CPM para anticipar deterioro futuro.',
    insight:   'El CPL está mejorando: el negocio está generando resultados a menor costo. Aunque CTR o CPM puedan mostrar señales, el resultado final es positivo.',
    tip:       'Revisar creatividades si el CTR sigue bajando, pero no hacer cambios apresurados mientras el CPL se mantenga verde.',
    tags: [],
  }

  // ── CTR RULES (secondary) ─────────────────────────────────────────────────
  // CTR bad → creative problem
  if (ctr_s === 'red') return {
    diagnosis: 'Creativo sin resonancia',
    action:    'Testear nuevos enfoques creativos: cambiar el hook, probar video corto (15-30s) y distintas propuestas de valor.',
    insight:   'El CTR está cayendo: la audiencia no está reaccionando al anuncio. El problema es de creatividad o mensaje, no de conversión.',
    tip:       'Preparar un banco de 3-5 creatividades nuevas antes de rotar para no quedarse sin material.',
    tags: ['Creativo agotado'],
  }

  // CTR good, no CPL → on track, scale
  if (ctr_s === 'green' && !hasCpl) return {
    diagnosis: 'CTR sano — sin conversiones medidas',
    action:    'Considerar implementar un píxel de conversión o formulario de leads para medir el impacto real.',
    insight:   'El CTR es bueno pero no hay datos de CPL. Sin medir conversiones es imposible saber si el gasto está generando resultados reales.',
    tip:       'Activar seguimiento de conversiones en Meta o Google Ads para poder optimizar por resultado y no solo por tráfico.',
    tags: [],
  }

  // ── CPM RULES (tertiary) ──────────────────────────────────────────────────
  if (cpm_s === 'red') return {
    diagnosis: 'Audiencia cara o saturada',
    action:    'Explorar nuevas audiencias: broad targeting, lookalikes o expandir geografía y rangos de edad.',
    insight:   'El CPM está subiendo: la subasta se encarece para esta audiencia. Puede ser por estacionalidad o saturación del público objetivo.',
    tip:       'Broad targeting con una creatividad bien optimizada puede sorprender en cuentas con historial. Las plataformas tienen más datos de los que parece.',
    tags: ['Público nuevo'],
  }

  // CTR good + CPM good → scalable
  if (ctr_s === 'green' && cpm_s === 'green') return {
    diagnosis: 'Cuenta saludable — oportunidad de escala',
    action:    'Incrementar presupuesto entre 10% y 20% cada 3-4 días. No escalar de golpe para no romper el algoritmo.',
    insight:   'CTR y CPM en buen estado. Sin datos de conversión pero el tráfico generado es eficiente y de calidad.',
    tip:       'Al escalar, lanzar también un test A/B de audiencias similares para ampliar volumen sin saturar la base actual.',
    tags: ['Escalar'],
  }

  return {
    diagnosis: 'Performance estable',
    action:    'Mantener configuración actual y monitorear métricas durante la semana.',
    insight:   'Las métricas no muestran señales claras de alerta ni de oportunidad. Continuar optimizando creatividades y audiencias de forma iterativa.',
    tip:       'Lanzar 2-3 variaciones creativas con diferentes hooks o formatos para explorar si hay margen de mejora.',
    tags: [],
  }
}

// ── Audit types ──────────────────────────────────────────────────────────────

export interface CampaignAudit {
  campaign_id:          string
  campaign:             string
  spend:                number
  impressions:          number
  ctr:                  number
  cpm:                  number
  results:              number
  cpl:                  number
  ctr_change:           number | null
  cpm_change:           number | null
  cpl_change:           number | null
  ctr_status:           Status
  cpm_status:           Status
  cpl_status:           Status | 'none'
  has_cpl:              boolean
  conversions:          number
  conversions_change:   number | null
  conversions_status:   Status | 'none'
  purchases:            number
  purchases_change:     number | null
  purchases_status:     Status | 'none'
  cpa_purchases:        number
  cpa_purchases_change: number | null
  cpa_purchases_status: Status | 'none'
  spend_change:         number | null
  score:                number
  health:               Health
  diagnosis:            string
  action:               string
  insight:              string
  tip:                  string
  tags:                 string[]
}

export interface ClientAudit {
  account_id:             string
  client_name:            string
  client_type:            ClientType
  score:                  number
  health:                 Health
  spend:                  number
  impressions:            number
  ctr:                    number
  cpm:                    number
  results:                number
  cpl:                    number
  ctr_change:             number | null
  cpm_change:             number | null
  cpl_change:             number | null
  ctr_status:             Status
  cpm_status:             Status
  cpl_status:             Status | 'none'
  has_cpl:                boolean
  conversions:            number        // messaging or ig_visits depending on client_type
  conversions_change:     number | null
  conversions_status:     Status | 'none'
  purchases:              number
  purchases_change:       number | null
  purchases_status:       Status | 'none'
  cpa_purchases:          number
  cpa_purchases_change:   number | null
  cpa_purchases_status:   Status | 'none'
  spend_change:           number | null
  diagnosis:              string
  action:                 string
  insight:                string
  tip:                    string
  tags:                   string[]
  // Month-over-month: same 7 days last month
  mom_cpl:              number
  mom_ctr:              number
  mom_cpl_change:       number | null
  mom_ctr_change:       number | null
  mom_cpa_purchases:        number
  mom_cpa_purchases_change: number | null
  // Raw messaging conversations — always set regardless of client_type
  messaging_total: number
}

export interface AuditData {
  results:        ClientAudit[]
  total_spend:    number
  total_results:  number
  total_accounts: number
  updated_at:     string
  date_from:      string
  date_to:        string
  prev_from:      string
  prev_to:        string
  mom_from:       string
  mom_to:         string
}

export interface CampaignData {
  campaigns:   CampaignAudit[]
  client_name: string
  client_type: ClientType
  date_from:   string
  date_to:     string
}

// ── Compute one client/campaign result from recent + prev metrics ─────────────

function buildAuditItem(recent: Metrics, prev: Metrics | null, clientType: ClientType = 'ig') {
  // For messaging clients: CPL = spend / messaging conversations
  // For IG/other clients: CPL = spend / lead results
  const effectiveResults = clientType === 'messaging' ? recent.messaging : recent.results
  const hasCpl = effectiveResults > 0
  const cpl_r  = hasCpl ? recent.spend / effectiveResults : 0

  // Pick conversions based on client type
  const conversions_r = clientType === 'messaging' ? recent.messaging : recent.ig_visits
  const conversions_p = prev ? (clientType === 'messaging' ? prev.messaging : prev.ig_visits) : 0

  let ctr_change:         number | null = null
  let cpm_change:         number | null = null
  let cpl_change:         number | null = null
  let conversions_change: number | null = null
  let spend_change:       number | null = null

  if (prev && prev.impressions > 0) {
    if (prev.ctr > 0) ctr_change = ((recent.ctr - prev.ctr) / prev.ctr) * 100
    if (prev.cpm > 0) cpm_change = ((recent.cpm - prev.cpm) / prev.cpm) * 100
    const prevEffectiveResults = clientType === 'messaging' ? prev.messaging : prev.results
    if (hasCpl && prevEffectiveResults > 0) {
      const cpl_p = prev.spend / prevEffectiveResults
      if (cpl_p > 0) cpl_change = ((cpl_r - cpl_p) / cpl_p) * 100
    }
  }

  // Conversions change — only needs prev > 0, not impressions
  if (prev && conversions_p > 0) {
    conversions_change = ((conversions_r - conversions_p) / conversions_p) * 100
  } else if (prev && conversions_r > 0 && conversions_p === 0) {
    conversions_change = 100 // went from 0 to something
  }

  const purchases_r = recent.purchases
  const purchases_p = prev ? prev.purchases : 0
  const hasPurchases = purchases_r > 0
  const cpa_purchases_r = hasPurchases ? recent.spend / purchases_r : 0

  let purchases_change: number | null = null
  if (prev && purchases_p > 0) {
    purchases_change = ((purchases_r - purchases_p) / purchases_p) * 100
  } else if (prev && purchases_r > 0 && purchases_p === 0) {
    purchases_change = 100
  }

  let cpa_purchases_change: number | null = null
  if (prev && purchases_p > 0) {
    const cpa_p = prev.spend / purchases_p
    if (cpa_p > 0 && hasPurchases) cpa_purchases_change = ((cpa_purchases_r - cpa_p) / cpa_p) * 100
  }

  const purchases_s: Status | 'none' = (purchases_r > 0 || purchases_p > 0) ? conversionsStatus(purchases_change) : 'none'
  const cpa_purchases_s: Status | 'none' = hasPurchases ? cplStatus(cpa_purchases_change) : 'none'

  // Spend change
  if (prev && prev.spend > 0) {
    spend_change = ((recent.spend - prev.spend) / prev.spend) * 100
  }

  const ctr_s = ctrStatus(ctr_change)
  const cpm_s = cpmStatus(cpm_change)
  const cpl_s: Status | 'none' = hasCpl ? cplStatus(cpl_change) : 'none'
  const conv_s: Status | 'none' = conversions_r > 0 || conversions_p > 0
    ? conversionsStatus(conversions_change)
    : 'none'

  const score =
    (hasCpl ? statusScore(cpl_s as Status) * 3 : 0) +
    statusScore(ctr_s) * 2 +
    statusScore(cpm_s) * 1

  let health: Health
  if (hasCpl) {
    if (cpl_s === 'green') {
      health = ctr_s === 'green' ? 'excellent' : 'stable'
    } else if (cpl_s === 'red') {
      health = ctr_s === 'red' ? 'priority' : 'review'
    } else {
      health = ctr_s === 'green' ? 'stable' : ctr_s === 'red' ? 'review' : 'review'
    }
  } else {
    if (ctr_s === 'green' && cpm_s !== 'red') health = 'stable'
    else if (ctr_s === 'red' && cpm_s === 'red') health = 'review'
    else if (ctr_s === 'red') health = 'review'
    else health = 'stable'
  }

  const { diagnosis, action, insight, tip, tags } = diagnose(
    ctr_s, cpm_s,
    hasCpl ? (cpl_s as Status) : 'yellow',
    hasCpl, recent, prev
  )

  return {
    score, health,
    ctr: recent.ctr, cpm: recent.cpm,
    spend: recent.spend, impressions: recent.impressions,
    results: recent.results, cpl: cpl_r,
    conversions: conversions_r,
    conversions_change,
    conversions_status: conv_s,
    purchases: purchases_r,
    purchases_change,
    purchases_status: purchases_s,
    cpa_purchases: cpa_purchases_r,
    cpa_purchases_change,
    cpa_purchases_status: cpa_purchases_s,
    spend_change,
    ctr_change, cpm_change, cpl_change,
    ctr_status: ctr_s, cpm_status: cpm_s, cpl_status: cpl_s,
    has_cpl: hasCpl,
    diagnosis, action, insight, tip, tags,
  }
}

// ── Main audit (account level) ───────────────────────────────────────────────

export async function runAudit(
  allowedIds:  Set<string>,
  clientNames: Record<string, string>,
  force = false
): Promise<AuditData> {
  const cacheKey = Array.from(allowedIds).sort().join(',')
  if (!force) {
    const cached = _auditCache.get(cacheKey)
    if (cached && Date.now() - cached.ts < AUDIT_TTL) return cached.data
  }

  const today   = new Date()
  const fmt     = (d: Date) => d.toISOString().split('T')[0]
  const sub     = (d: Date, n: number) => { const r = new Date(d); r.setDate(r.getDate() - n); return r }

  const recentTo   = sub(today, 1)
  const recentFrom = sub(today, 7)
  const prevTo     = sub(today, 8)
  const prevFrom   = sub(today, 14)

  // Same 7-day window but last month (e.g. Apr 10-16 → Mar 10-16)
  const momFrom = new Date(recentFrom); momFrom.setMonth(momFrom.getMonth() - 1)
  const momTo   = new Date(recentTo);   momTo.setMonth(momTo.getMonth()   - 1)

  // Monthly messaging total: 1st of month → yesterday (matches Windsor dashboard view)
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  const monthEnd   = sub(today, 1)
  const MSG_FIELDS = 'account_id,actions_onsite_conversion_messaging_conversation_started_7d'
  const fetchMonthMsg = fmt(monthEnd) >= fmt(monthStart)
    ? fetchPeriod(fmt(monthStart), fmt(monthEnd), MSG_FIELDS, allowedIds)
    : Promise.resolve<RawRow[]>([])

  const [recentRows, prevRows, momRows, monthMsgRows] = await Promise.all([
    fetchPeriod(fmt(recentFrom), fmt(recentTo), ACCOUNT_FIELDS, allowedIds),
    fetchPeriod(fmt(prevFrom),   fmt(prevTo),   ACCOUNT_FIELDS, allowedIds),
    fetchPeriod(fmt(momFrom),    fmt(momTo),    ACCOUNT_FIELDS, allowedIds),
    fetchMonthMsg,
  ])

  // Index prev and mom by account_id
  const prevMap = new Map<string, Metrics>()
  for (const r of prevRows) {
    if (r.account_id) prevMap.set(r.account_id, toMetrics(r))
  }
  const momMap = new Map<string, Metrics>()
  for (const r of momRows) {
    if (r.account_id) momMap.set(r.account_id, toMetrics(r))
  }
  // Monthly messaging count per account
  const monthMsgMap = new Map<string, number>()
  for (const r of monthMsgRows) {
    if (r.account_id) {
      const v = r.actions_onsite_conversion_messaging_conversation_started_7d
      monthMsgMap.set(r.account_id, v != null ? Number(v) : 0)
    }
  }

  const results: ClientAudit[] = []
  let total_spend   = 0
  let total_results = 0

  const foundIds = new Set<string>()

  for (const r of recentRows) {
    if (!r.account_id || !allowedIds.has(r.account_id)) continue
    const recent = toMetrics(r)
    if (recent.spend <= 0) continue

    foundIds.add(r.account_id)
    const prev        = prevMap.get(r.account_id) ?? null
    const clientName  = clientNames[r.account_id] ?? r.account_name ?? r.account_id
    const clientType  = getClientType(clientName)
    const item        = buildAuditItem(recent, prev, clientType)

    // Month-over-month fields
    const mom = momMap.get(r.account_id) ?? null
    const mom_ctr = mom?.ctr ?? 0
    const momEffective = mom
      ? (clientType === 'messaging' ? mom.messaging : mom.results)
      : 0
    const mom_cpl = momEffective > 0 ? (mom!.spend / momEffective) : 0

    const mom_ctr_change: number | null = mom_ctr > 0
      ? ((recent.ctr - mom_ctr) / mom_ctr) * 100
      : null
    const mom_cpl_change: number | null = mom_cpl > 0 && item.cpl > 0
      ? ((item.cpl - mom_cpl) / mom_cpl) * 100
      : null

    const momPurchases = mom ? mom.purchases : 0
    const mom_cpa_purchases = momPurchases > 0 ? (mom!.spend / momPurchases) : 0
    const mom_cpa_purchases_change: number | null = mom_cpa_purchases > 0 && item.cpa_purchases > 0
      ? ((item.cpa_purchases - mom_cpa_purchases) / mom_cpa_purchases) * 100
      : null

    total_spend   += recent.spend
    total_results += recent.results

    results.push({
      account_id:  r.account_id,
      client_name: clientName,
      client_type: clientType,
      mom_cpl, mom_ctr,
      mom_cpl_change, mom_ctr_change,
      mom_cpa_purchases,
      mom_cpa_purchases_change,
      messaging_total: monthMsgMap.get(r.account_id) ?? recent.messaging,
      ...item,
    })
  }

  // Include accounts that had no spend in Windsor (paused or no recent activity)
  for (const accountId of allowedIds) {
    if (foundIds.has(accountId) || accountId === '__pending__') continue
    const clientName = clientNames[accountId] ?? accountId
    const clientType = getClientType(clientName)
    results.push({
      account_id:          accountId,
      client_name:         clientName,
      client_type:         clientType,
      score:               0,
      health:              'stable',
      spend:               0,
      impressions:         0,
      ctr:                 0,
      cpm:                 0,
      results:             0,
      cpl:                 0,
      conversions:         0,
      conversions_change:  null,
      conversions_status:  'none',
      purchases:           0,
      purchases_change:    null,
      purchases_status:    'none',
      cpa_purchases:       0,
      cpa_purchases_change: null,
      cpa_purchases_status: 'none',
      spend_change:        null,
      ctr_change:          null,
      cpm_change:          null,
      cpl_change:          null,
      ctr_status:          'yellow',
      cpm_status:          'yellow',
      cpl_status:          'none',
      has_cpl:             false,
      diagnosis:           'Sin actividad reciente',
      action:              'Verificar que las campañas estén activas en Meta Ads.',
      insight:             'No se registró gasto en los últimos 7 días para esta cuenta.',
      tip:                 '',
      tags:                [],
      mom_cpl:             0,
      mom_ctr:             0,
      mom_cpl_change:      null,
      mom_ctr_change:      null,
      mom_cpa_purchases:        0,
      mom_cpa_purchases_change: null,
      messaging_total:          0,
    })
  }

  results.sort((a, b) => b.spend - a.spend)

  const auditResult: AuditData = {
    results,
    total_spend,
    total_results,
    total_accounts: results.length,
    updated_at: new Date().toISOString(),
    date_from:  fmt(recentFrom),
    date_to:    fmt(recentTo),
    prev_from:  fmt(prevFrom),
    prev_to:    fmt(prevTo),
    mom_from:   fmt(momFrom),
    mom_to:     fmt(momTo),
  }
  _auditCache.set(cacheKey, { data: auditResult, ts: Date.now() })
  return auditResult
}

// ── Campaign breakdown for one account ───────────────────────────────────────

export async function getCampaignBreakdown(
  accountId:  string,
  clientName: string,
  clientType: ClientType = 'ig'
): Promise<CampaignData> {
  const today   = new Date()
  const fmt     = (d: Date) => d.toISOString().split('T')[0]
  const sub     = (d: Date, n: number) => { const r = new Date(d); r.setDate(r.getDate() - n); return r }

  const recentTo   = sub(today, 1)
  const recentFrom = sub(today, 7)
  const prevTo     = sub(today, 8)
  const prevFrom   = sub(today, 14)

  const allowed = new Set([accountId])

  const [recentRows, prevRows] = await Promise.all([
    fetchPeriod(fmt(recentFrom), fmt(recentTo), CAMPAIGN_FIELDS, allowed),
    fetchPeriod(fmt(prevFrom),   fmt(prevTo),   CAMPAIGN_FIELDS, allowed),
  ])

  // Index prev by campaign_id
  const prevMap = new Map<string, Metrics>()
  for (const r of prevRows) {
    if (r.campaign_id) prevMap.set(r.campaign_id, toMetrics(r))
  }

  const campaigns: CampaignAudit[] = []

  for (const r of recentRows) {
    if (!r.campaign_id) continue
    const recent = toMetrics(r)
    if (recent.spend < 10) continue

    const prev = prevMap.get(r.campaign_id) ?? null
    const item = buildAuditItem(recent, prev, clientType)

    campaigns.push({
      campaign_id: r.campaign_id,
      campaign:    r.campaign ?? r.campaign_id,
      ...item,
    })
  }

  campaigns.sort((a, b) => a.score - b.score)

  return {
    campaigns, client_name: clientName, client_type: clientType,
    date_from: fmt(recentFrom),
    date_to:   fmt(recentTo),
  }
}

// ── Creative lifecycle tracker ───────────────────────────────────────────────

interface RawAdRow extends RawRow {
  ad_id?:                  string | null
  ad_name?:                string | null
  adset_name?:             string | null
  thumbnail_url?:          string | null
  ad_effective_status?:    string | null
  adset_effective_status?: string | null
}

const CREATIVE_FIELDS = [
  'account_id', 'ad_id', 'ad_name', 'campaign', 'adset_name',
  'spend', 'impressions', 'link_clicks', 'thumbnail_url',
  'ad_effective_status', 'adset_effective_status',
].join(',')

export type Lifecycle = 'growth' | 'peak' | 'decline' | 'exhausted'

export interface CreativeLifecycle {
  ad_id:         string
  ad_name:       string
  campaign:      string
  adset_name:    string
  thumbnail_url: string | null
  spend_week:    number   // last 7d
  spend_prev:    number   // prev 7d
  impressions:   number   // last 7d
  ctr:           number   // link click CTR % (last 7d)
  ctr_change:    number | null   // % change vs prev 7d
  lifecycle:     Lifecycle
  is_new:        boolean  // no data in prev period → ad < 8 days old
}

export interface CreativeData {
  creatives:  CreativeLifecycle[]
  date_from:  string
  date_to:    string
  prev_from:  string
}

// Lifecycle based purely on CTR change (frequency removed from all analyses)
function classifyLifecycle(ctrChange: number | null, isNew: boolean): Lifecycle {
  if (isNew) return 'growth'
  if (ctrChange === null) return 'peak'
  if (ctrChange < -30) return 'exhausted'
  if (ctrChange < -10) return 'decline'
  if (ctrChange > 5)   return 'growth'
  return 'peak'
}

async function fetchAdPeriod(
  dateFrom:  string,
  dateTo:    string,
  accountId: string,
): Promise<RawAdRow[]> {
  const apiKey = process.env.WINDSOR_API_KEY
  if (!apiKey) throw new Error('WINDSOR_API_KEY no configurada')

  const url = new URL(WINDSOR_FACEBOOK)
  url.searchParams.set('api_key',   apiKey)
  url.searchParams.set('date_from', dateFrom)
  url.searchParams.set('date_to',   dateTo)
  url.searchParams.set('fields',    CREATIVE_FIELDS)
  url.searchParams.set('_renderer', 'json')
  // Server-side account filter → drastically reduces payload size
  url.searchParams.set('_filters',  JSON.stringify([['account_id', 'eq', accountId]]))

  const res = await fetch(url.toString(), { cache: 'no-store' })
  if (!res.ok) throw new Error(`Windsor error ${res.status}`)

  const json = await res.json()
  const rows: RawAdRow[] = json.data ?? []
  // Client-side fallback filter in case _filters isn't supported by this connector
  return rows.filter(r => (!r.account_id || r.account_id === accountId) && r.ad_id)
}

export async function getCreativeLifecycle(accountId: string): Promise<CreativeData> {
  const today = new Date()
  const fmt   = (d: Date) => d.toISOString().split('T')[0]
  const sub   = (d: Date, n: number) => { const r = new Date(d); r.setDate(r.getDate() - n); return r }

  const recentTo   = sub(today, 1)
  const recentFrom = sub(today, 7)
  const prevTo     = sub(today, 8)
  const prevFrom   = sub(today, 14)

  // Only 2 parallel calls — no MTD needed
  const [recentRows, prevRows] = await Promise.all([
    fetchAdPeriod(fmt(recentFrom), fmt(recentTo), accountId),
    fetchAdPeriod(fmt(prevFrom),   fmt(prevTo),   accountId),
  ])

  const prevMap = new Map<string, RawAdRow>(prevRows.map(r => [r.ad_id!, r]))

  const creatives: CreativeLifecycle[] = []

  for (const r of recentRows) {
    if (!r.ad_id) continue
    // Skip paused ads or ads in paused adsets/campaigns
    if (r.ad_effective_status    && r.ad_effective_status    !== 'ACTIVE') continue
    if (r.adset_effective_status && r.adset_effective_status !== 'ACTIVE') continue
    const imp     = r.impressions ?? 0
    const lc      = r.link_clicks ?? 0
    const spend_w = r.spend       ?? 0
    if (imp < 50 && spend_w < 200) continue

    const ctr_r = imp > 0 ? (lc / imp) * 100 : 0

    const prev   = prevMap.get(r.ad_id)
    const is_new = !prev || (prev.impressions ?? 0) === 0

    let ctr_change: number | null = null
    if (!is_new) {
      const ctr_p = (prev!.link_clicks ?? 0) / (prev!.impressions ?? 1) * 100
      if (ctr_p > 0) ctr_change = ((ctr_r - ctr_p) / ctr_p) * 100
    }

    const lifecycle = classifyLifecycle(ctr_change, is_new)

    creatives.push({
      ad_id:         r.ad_id,
      ad_name:       r.ad_name       ?? r.ad_id,
      campaign:      r.campaign      ?? '—',
      adset_name:    r.adset_name    ?? '—',
      thumbnail_url: r.thumbnail_url ?? null,
      spend_week:    spend_w,
      spend_prev:    prev?.spend     ?? 0,
      impressions:   imp,
      ctr:           ctr_r,
      ctr_change,
      lifecycle,
      is_new,
    })
  }

  const ORDER: Record<Lifecycle, number> = { exhausted: 0, decline: 1, peak: 2, growth: 3 }
  creatives.sort((a, b) => ORDER[a.lifecycle] - ORDER[b.lifecycle] || b.spend_week - a.spend_week)

  return {
    creatives,
    date_from: fmt(recentFrom),
    date_to:   fmt(recentTo),
    prev_from: fmt(prevFrom),
  }
}
