import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getRelevantItems, PLATFORM_LABELS } from '@/lib/onboarding'
import type { Platform } from '@/lib/onboarding'

function sb() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)
}

async function fetchGtmContainer(gtmId: string): Promise<string> {
  try {
    const ctrl = new AbortController()
    setTimeout(() => ctrl.abort(), 5000)
    const res = await fetch(`https://www.googletagmanager.com/gtm.js?id=${gtmId}`, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PaidMediaAudit/1.0)' },
    })
    return (await res.text()).slice(0, 50000)
  } catch {
    return ''
  }
}

async function fetchWebsiteInfo(url: string): Promise<string> {
  try {
    const target = url.startsWith('http') ? url : `https://${url}`
    const controller = new AbortController()
    setTimeout(() => controller.abort(), 7000)
    const res  = await fetch(target, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PaidMediaAudit/1.0)' },
    })
    const html = (await res.text()).slice(0, 30000)

    const gtmIdMatch = html.match(/GTM-[A-Z0-9]+/)
    const gtmId      = gtmIdMatch?.[0] ?? null
    const gtm        = !!gtmId || /googletagmanager\.com\/gtm/.test(html)

    // Also scan GTM container JS to detect tags loaded via GTM
    const gtmContent = gtmId ? await fetchGtmContainer(gtmId) : ''
    const combined   = html + gtmContent

    const pixel   = /fbq\(|fbevents\.js|connect\.facebook\.net|facebook\.com\/tr/.test(combined)
    const pixelId = combined.match(/['"](\d{15,})['"]/)?.[1] ?? null
    const ga4     = /G-[A-Z0-9]{4,}/.test(combined)
    const mobile  = /name=["']viewport["']/.test(html)
    const form    = /<form\b/i.test(html)
    const wa      = /wa\.me|whatsapp/i.test(combined)

    const viaGtm = (pattern: RegExp) => gtmContent && pattern.test(gtmContent) ? ' vía GTM' : ''
    const pixelLabel = pixel
      ? `✓ detectado${pixelId ? ` (ID: ${pixelId})` : ''}${viaGtm(/fbq\(|fbevents\.js|connect\.facebook\.net|facebook\.com\/tr/)}`
      : gtm ? '⚠ no detectado en HTML estático (puede estar dentro de GTM o cargarse dinámicamente — verificar manualmente)' : '✗ no encontrado'
    const ga4Label = ga4
      ? `✓ detectado${viaGtm(/G-[A-Z0-9]{4,}/)}`
      : gtm ? '⚠ no detectado en HTML estático (puede estar dentro de GTM o cargarse dinámicamente — verificar manualmente)' : '✗ no encontrado'

    return [
      `Meta Pixel: ${pixelLabel}`,
      `GA4: ${ga4Label}`,
      `GTM: ${gtm ? `✓ detectado${gtmId ? ` (${gtmId})` : ''}` : '✗ no encontrado'}`,
      `Viewport mobile: ${mobile ? '✓' : '✗ faltante'}`,
      `Formulario: ${form ? '✓ detectado' : '✗ no detectado'}`,
      `WhatsApp: ${wa ? '✓ detectado' : '✗ no detectado'}`,
      gtm ? 'NOTA: análisis estático sin ejecución de JS. Tags dentro de GTM requieren verificación manual en el container.' : '',
    ].filter(Boolean).join('\n')
  } catch {
    return 'No se pudo acceder al sitio web (timeout o error de conexión).'
  }
}

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { data: client, error: fetchErr } = await sb()
      .from('onboarding_clients')
      .select('*')
      .eq('id', params.id)
      .single()
    if (fetchErr || !client) throw new Error('Cliente no encontrado')

    await sb().from('onboarding_clients').update({ analysis_status: 'running' }).eq('id', params.id)

    const websiteInfo = client.website ? await fetchWebsiteInfo(client.website) : ''

    const items     = getRelevantItems(client.platform as Platform)
    const checked   = items.filter(i => client.checklist?.[i.key]).map(i => i.label)
    const unchecked = items.filter(i => !client.checklist?.[i.key]).map(i => i.label)

    const prompt = `Sos un auditor senior de paid media. Hacé una auditoría de onboarding para un cliente nuevo de una agencia digital.

CLIENTE:
- Nombre: ${client.name}
- Plataformas: ${PLATFORM_LABELS[client.platform as Platform]}
- Sitio web: ${client.website || 'No proporcionado'}
- Accesos confirmados: ${checked.length ? checked.join(', ') : 'Ninguno aún'}
- Accesos pendientes: ${unchecked.length ? unchecked.join(', ') : 'Todos completos'}
${websiteInfo ? `\nANÁLISIS TÉCNICO WEB:\n${websiteInfo}` : ''}

Devolvé ÚNICAMENTE JSON válido, sin texto adicional, sin markdown:
{
  "tracking": { "status": "green|yellow|red", "summary": "máx 12 palabras", "details": ["item","item"] },
  "account":  { "status": "green|yellow|red", "summary": "...", "details": ["..."] },
  "performance": { "status": "green|yellow|red", "summary": "...", "details": ["..."] },
  "website":  { "status": "green|yellow|red|none", "summary": "...", "details": ["..."] },
  "recommendation": "acción concreta en 1-2 frases",
  "final_status": "ready|improvements|fixes",
  "partial": ${unchecked.length > 0}
}

Reglas: green=OK, yellow=mejorable/datos insuficientes, red=problema claro, none=no aplica.
ready=listo para lanzar hoy, improvements=listo con mejoras menores primero, fixes=requiere correcciones antes de pautar.
Máximo 2 bullets por sección. Sé directo y útil, sin relleno.`

    const apiKey = process.env.GROQ_API_KEY
    if (!apiKey) throw new Error('GROQ_API_KEY no configurada en .env.local')

    const aiRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 1024,
        temperature: 0.2,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!aiRes.ok) {
      const errText = await aiRes.text()
      throw new Error(`Groq API ${aiRes.status}: ${errText}`)
    }

    const aiJson  = await aiRes.json()
    const rawText = aiJson.choices?.[0]?.message?.content ?? ''
    const match   = rawText.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('Respuesta inválida del modelo')

    const analysis = JSON.parse(match[0])
    analysis.analyzed_at = new Date().toISOString()

    const { data: updated, error: saveErr } = await sb()
      .from('onboarding_clients')
      .update({ analysis, analysis_status: 'done' })
      .eq('id', params.id)
      .select()
      .single()

    if (saveErr) throw saveErr
    return NextResponse.json(updated)
  } catch (err) {
    try {
      await sb().from('onboarding_clients').update({ analysis_status: 'error' }).eq('id', params.id)
    } catch { /* ignore */ }
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
