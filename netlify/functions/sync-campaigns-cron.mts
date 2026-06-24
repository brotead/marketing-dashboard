export default async function syncCampaignsCron() {
  const siteUrl = process.env.URL ?? process.env.DEPLOY_PRIME_URL ?? ''
  const secret  = process.env.CRON_SECRET ?? ''

  if (!siteUrl) {
    console.error('[CRON] URL env var not set')
    return { statusCode: 500, body: 'URL not configured' }
  }

  try {
    const res = await fetch(`${siteUrl}/api/meta/sync-campaigns`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${secret}` },
    })
    const body = await res.text()
    console.log(`[CRON] sync-campaigns → ${res.status}:`, body)
    return { statusCode: 200, body }
  } catch (err) {
    console.error('[CRON] sync-campaigns failed:', err)
    return { statusCode: 500, body: String(err) }
  }
}

export const config = {
  schedule: '@hourly',
}
