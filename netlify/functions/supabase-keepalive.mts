import type { Config } from '@netlify/functions'

export default async function handler() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY

  if (!url || !key) {
    console.error('[keepalive] Missing SUPABASE_URL or SUPABASE_SERVICE_KEY')
    return new Response('Config missing', { status: 500 })
  }

  try {
    const res = await fetch(`${url}/rest/v1/profiles?select=id&limit=1`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
    })

    if (!res.ok) {
      const body = await res.text()
      console.error(`[keepalive] Supabase responded ${res.status}:`, body)
      return new Response(`Supabase error: ${res.status}`, { status: 502 })
    }

    console.log(`[keepalive] Supabase ping OK — ${new Date().toISOString()}`)
    return new Response(JSON.stringify({ ok: true, ts: new Date().toISOString() }), { status: 200 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[keepalive] Fetch error:', msg)
    return new Response(`Error: ${msg}`, { status: 500 })
  }
}

// Run every 3 days at 08:00 UTC
export const config: Config = {
  schedule: '0 8 */3 * *',
}
