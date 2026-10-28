'use client'

import { useEffect } from 'react'
import { appCache, TTL } from '@/lib/appCache'

export function DataPrefetcher() {
  useEffect(() => {
    const now   = new Date()
    const year  = now.getFullYear()
    const month = now.getMonth() + 1

    // High priority: data the dashboard needs immediately
    appCache.prefetch(`windsor-${year}-${month}`, () =>
      fetch(`/api/windsor?year=${year}&month=${month}`).then(r => r.json()), TTL.HOUR)

    appCache.prefetch('budgets', () =>
      fetch('/api/budgets').then(r => r.json()), TTL.MIN5)

    // Lower priority: load after a short delay so they don't compete with the above
    const t = setTimeout(() => {
      appCache.prefetch('audit', () =>
        fetch('/api/audit').then(r => r.json()), TTL.MIN15)

      appCache.prefetch('onboarding', () =>
        fetch('/api/onboarding').then(r => r.json()), TTL.MIN5)
    }, 1500)

    return () => clearTimeout(t)
  }, [])

  return null
}
