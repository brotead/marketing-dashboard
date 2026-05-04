'use client'

import { useEffect } from 'react'
import { appCache, TTL } from '@/lib/appCache'

export function DataPrefetcher() {
  useEffect(() => {
    const now   = new Date()
    const year  = now.getFullYear()
    const month = now.getMonth() + 1

    appCache.prefetch(`windsor-${year}-${month}`, () =>
      fetch(`/api/windsor?year=${year}&month=${month}`).then(r => r.json()), TTL.HOUR)

    appCache.prefetch('budgets', () =>
      fetch('/api/budgets').then(r => r.json()), TTL.MIN5)

    appCache.prefetch(`kpis-${year}-${month}`, () =>
      fetch(`/api/kpis?year=${year}&month=${month}`).then(r => r.json()), TTL.HOUR)

    appCache.prefetch('goals', () =>
      fetch('/api/goals').then(r => r.json()), TTL.MIN5)

    appCache.prefetch('audit', () =>
      fetch('/api/audit').then(r => r.json()), TTL.MIN15)
  }, [])

  return null
}
