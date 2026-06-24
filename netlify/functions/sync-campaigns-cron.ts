import type { Config } from '@netlify/functions'

export default async function syncCampaignsCron(req: Request) {
  const siteUrl = process.env.URL ?? process.env.DEPLOY_PRIME_URL ?? ''
  const secret  = process.env.CRON_SECRET ?? ''

  if (!siteUrl) {
    console.error('[CRON] URL env var not set')
    return new Response('URL not configured', { status: 500 })
  }

  try {
    const res = await fetch(`${siteUrl}/api/meta/sync-campaigns`, {
      method: 'GET',
      headers: secret ? { Authorization: `Bearer ${secret}` } : {},
    })
    const body = await res.text()
    console.log(`[CRON] sync-campaigns → ${res.status}:`, body)
    return new Response(body, { status: 200 })
  } catch (err) {
    console.error('[CRON] sync-campaigns failed:', err)
    return new Response(String(err), { status: 500 })
  }
}

export const config: Config = {
  schedule: '@hourly',
}
