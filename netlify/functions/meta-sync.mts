import type { Config } from '@netlify/functions'

// Runs every hour on Netlify. Calls the Next.js API route with CRON_SECRET
// so the route can validate the request is legitimate.
export default async () => {
  const siteUrl = process.env.URL          // auto-provided by Netlify
  const secret  = process.env.CRON_SECRET

  if (!siteUrl || !secret) {
    console.error('[meta-sync cron] Missing URL or CRON_SECRET env vars')
    return
  }

  try {
    const res  = await fetch(`${siteUrl}/api/meta/sync-campaigns`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${secret}` },
    })
    const data = await res.json()
    console.log('[meta-sync cron] result:', JSON.stringify(data))
  } catch (err) {
    console.error('[meta-sync cron] fetch error:', err)
  }
}

export const config: Config = {
  schedule: '@hourly',
}
