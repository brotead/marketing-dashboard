'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, MessageCircle } from 'lucide-react'
import type { ClientAudit, AuditData } from '@/lib/audit'
import type { AccountData } from '@/lib/types'
import { appCache, TTL } from '@/lib/appCache'

// ── Types ──────────────────────────────────────────────────────────────────────

type AlertType = 'cpa' | 'ctr' | 'spend' | 'fallback_cpa' | 'fallback_ctr'

interface Alert {
  client_name: string
  account_id:  string
  type:        AlertType
  change:      number
}

interface Top3Item {
  client_name: string
  account_id:  string
  count:       number
  cpa:         number | null
  ctr:         number
}

interface ClientSignals {
  account_id:  string
  client_name: string
  spend:       number
  cpaChange:   number | null
  ctrChange:   number | null
  spendChange: number | null
}

// ── Logic (unchanged) ──────────────────────────────────────────────────────────

function prevMonthOf(year: number, month: number) {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 }
}

function monthlyCpaChange(
  id: string,
  accsCurr: AccountData[], accsPrev: AccountData[],
  convCurr: Record<string, number>, convPrev: Record<string, number>,
): number | null {
  const sCurr = accsCurr.find(a => a.account_id === id && a.source === 'facebook')?.spend ?? 0
  const sPrev = accsPrev.find(a => a.account_id === id && a.source === 'facebook')?.spend ?? 0
  const cC = convCurr[id] ?? 0
  const cP = convPrev[id] ?? 0
  if (cC <= 0 || cP <= 0 || sCurr <= 0 || sPrev <= 0) return null
  const cpaN = sCurr / cC
  const cpaP = sPrev / cP
  if (cpaP <= 0) return null
  return ((cpaN - cpaP) / cpaP) * 100
}

function monthlySpendChange(
  id: string,
  accsCurr: AccountData[], accsPrev: AccountData[],
): number | null {
  const curr = accsCurr.find(a => a.account_id === id && a.source === 'facebook')?.spend ?? 0
  const prev = accsPrev.find(a => a.account_id === id && a.source === 'facebook')?.spend ?? 0
  if (prev <= 0) return null
  return ((curr - prev) / prev) * 100
}

function buildAlerts(signals: ClientSignals[]): Alert[] {
  const active = signals.filter(c => c.spend > 0)

  const cpaCandidates = active
    .filter(c => c.cpaChange !== null && c.cpaChange > 10)
    .sort((a, b) => (b.cpaChange ?? 0) - (a.cpaChange ?? 0))

  const ctrCandidates = active
    .filter(c => c.ctrChange !== null && c.ctrChange < -10)
    .sort((a, b) => (a.ctrChange ?? 0) - (b.ctrChange ?? 0))

  if (cpaCandidates.length > 0 || ctrCandidates.length > 0) {
    const out: Alert[] = []
    const seen = new Set<string>()
    for (const c of cpaCandidates.slice(0, 5)) {
      out.push({ client_name: c.client_name, account_id: c.account_id, type: 'cpa', change: c.cpaChange! })
      seen.add(c.account_id)
    }
    for (const c of ctrCandidates) {
      if (out.length >= 5) break
      if (seen.has(c.account_id)) continue
      out.push({ client_name: c.client_name, account_id: c.account_id, type: 'ctr', change: c.ctrChange! })
    }
    return out
  }

  const spendCandidates = active
    .filter(c => c.spendChange !== null && Math.abs(c.spendChange) > 10)
    .sort((a, b) => Math.abs(b.spendChange ?? 0) - Math.abs(a.spendChange ?? 0))

  if (spendCandidates.length > 0) {
    return spendCandidates.slice(0, 5).map(c => ({
      client_name: c.client_name, account_id: c.account_id,
      type: 'spend' as AlertType, change: c.spendChange!,
    }))
  }

  const fallback = active
    .filter(c =>
      (c.cpaChange !== null && Math.abs(c.cpaChange) > 5) ||
      (c.ctrChange !== null && Math.abs(c.ctrChange) > 5)
    )
    .sort((a, b) =>
      Math.max(Math.abs(b.cpaChange ?? 0), Math.abs(b.ctrChange ?? 0)) -
      Math.max(Math.abs(a.cpaChange ?? 0), Math.abs(a.ctrChange ?? 0))
    )
    .slice(0, 5)

  return fallback.map(c => {
    if (c.cpaChange !== null && Math.abs(c.cpaChange) >= Math.abs(c.ctrChange ?? 0)) {
      return { client_name: c.client_name, account_id: c.account_id, type: 'fallback_cpa' as AlertType, change: c.cpaChange }
    }
    return { client_name: c.client_name, account_id: c.account_id, type: 'fallback_ctr' as AlertType, change: c.ctrChange! }
  })
}

// ── Display config ─────────────────────────────────────────────────────────────

const ALERT_META: Record<AlertType, { label: string; color: string }> = {
  cpa:          { label: 'CPA',       color: 'text-red-400'    },
  ctr:          { label: 'CTR',       color: 'text-orange-400' },
  spend:        { label: 'Inversión', color: 'text-amber-400'  },
  fallback_cpa: { label: 'CPA',       color: 'text-yellow-400' },
  fallback_ctr: { label: 'CTR',       color: 'text-yellow-400' },
}

function pctFmt(n: number) {
  return `${n > 0 ? '+' : ''}${n.toFixed(1)}%`
}

function fmtArs(n: number) {
  return n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
}

// ── Fetchers ───────────────────────────────────────────────────────────────────

async function fetchWindsor(year: number, month: number): Promise<AccountData[]> {
  try {
    const r = await fetch(`/api/windsor?year=${year}&month=${month}`)
    if (!r.ok) return []
    return (await r.json()).data ?? []
  } catch { return [] }
}

async function fetchKpis(year: number, month: number): Promise<Record<string, number>> {
  try {
    const r = await fetch(`/api/kpis?year=${year}&month=${month}`)
    if (!r.ok) return {}
    return (await r.json()).conversations ?? {}
  } catch { return {} }
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function AlertasTop3Widget({ year, month }: { year: number; month: number }) {
  const [alerts,  setAlerts]  = useState<Alert[]>([])
  const [top3,    setTop3]    = useState<Top3Item[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const prev = prevMonthOf(year, month)

        const [auditData, accsCurr, accsPrev, convCurr, convPrev] = await Promise.all([
          appCache.fetch<AuditData>('audit', async () => {
            const r = await fetch('/api/audit')
            if (!r.ok) throw new Error(`Audit ${r.status}`)
            return r.json()
          }, TTL.MIN5),
          appCache.fetch<AccountData[]>(`windsor-accs-${year}-${month}`,           () => fetchWindsor(year, month),           TTL.HOUR),
          appCache.fetch<AccountData[]>(`windsor-accs-${prev.year}-${prev.month}`, () => fetchWindsor(prev.year, prev.month), TTL.HOUR),
          appCache.fetch<Record<string, number>>(`conv-${year}-${month}`,           () => fetchKpis(year, month),           TTL.MIN5),
          appCache.fetch<Record<string, number>>(`conv-${prev.year}-${prev.month}`, () => fetchKpis(prev.year, prev.month), TTL.HOUR),
        ])

        if (cancelled) return

        const clients: ClientAudit[] = Array.isArray(auditData?.results) ? auditData.results : []

        const signals: ClientSignals[] = clients.map(c => ({
          account_id:  c.account_id,
          client_name: c.client_name,
          spend:       c.spend,
          cpaChange:   monthlyCpaChange(c.account_id, accsCurr, accsPrev, convCurr, convPrev),
          ctrChange:   c.ctr_change !== null ? c.ctr_change : c.mom_ctr_change,
          spendChange: monthlySpendChange(c.account_id, accsCurr, accsPrev),
        }))

        setAlerts(buildAlerts(signals))

        setTop3(
          clients
            .filter(c => (convCurr[c.account_id] ?? 0) > 0)
            .sort((a, b) => (convCurr[b.account_id] ?? 0) - (convCurr[a.account_id] ?? 0))
            .slice(0, 3)
            .map(c => {
              const conv = convCurr[c.account_id] ?? 0
              return {
                client_name: c.client_name,
                account_id:  c.account_id,
                count:       conv,
                cpa:         conv > 0 && c.spend > 0 ? c.spend / conv : null,
                ctr:         c.ctr,
              }
            })
        )
      } catch {
        // fail silently — empty state shown
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [year, month])

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="h-48 bg-gray-100 dark:bg-[#1a1a1a] rounded-2xl border border-gray-200 dark:border-[#2a2a2a] animate-pulse" />
        <div className="h-48 bg-gray-100 dark:bg-[#1a1a1a] rounded-2xl border border-gray-200 dark:border-[#2a2a2a] animate-pulse" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">

      {/* ── Widget 1: Alertas del Mes ── */}
      <div className="bg-white dark:bg-[#111111] rounded-2xl border border-gray-100 dark:border-white/[0.06] shadow-sm px-5 py-4">
        <div className="flex items-center gap-2 mb-3.5">
          <AlertTriangle size={12} className="text-amber-400 flex-shrink-0" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
            Alertas del Mes
          </span>
        </div>

        {alerts.length === 0 ? (
          <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-3">
            Sin anomalías este mes
          </p>
        ) : (
          <div className="flex flex-col">
            {alerts.map((a, i) => {
              const meta = ALERT_META[a.type]
              return (
                <div
                  key={i}
                  className="flex items-center justify-between gap-2 py-2 border-b border-gray-100 dark:border-white/[0.04] last:border-0"
                >
                  <span className="text-[12px] font-medium text-gray-700 dark:text-gray-200 truncate leading-tight">
                    {a.client_name}
                  </span>
                  <span className={`text-[11px] font-semibold tabular-nums whitespace-nowrap flex-shrink-0 ${meta.color}`}>
                    {meta.label} {pctFmt(a.change)}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Widget 2: Top 3 Clientes ── */}
      <div className="bg-white dark:bg-[#111111] rounded-2xl border border-gray-100 dark:border-white/[0.06] shadow-sm px-5 py-4">
        <div className="flex items-center gap-2 mb-3.5">
          <MessageCircle size={12} className="text-blue-400 flex-shrink-0" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
            Top 3 del Mes
          </span>
        </div>

        {top3.length === 0 ? (
          <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-3">
            Sin datos de mensajes
          </p>
        ) : (
          <div className="flex flex-col">
            {top3.map((c, i) => (
              <div
                key={c.account_id}
                className="py-3 border-b border-gray-100 dark:border-white/[0.04] last:border-0 first:pt-0 last:pb-0"
              >
                {/* Rank + name */}
                <div className="flex items-baseline gap-1.5 mb-2">
                  <span className="text-[10px] font-bold text-gray-400 dark:text-gray-600 flex-shrink-0">
                    #{i + 1}
                  </span>
                  <span className="text-[12px] font-semibold text-gray-800 dark:text-gray-100 truncate leading-tight">
                    {c.client_name}
                  </span>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-3 gap-x-2">
                  <div>
                    <p className="text-[9px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-600 mb-0.5">
                      Msgs
                    </p>
                    <p className="text-[11px] font-semibold text-blue-400 tabular-nums">
                      {c.count.toLocaleString('es-AR')}
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-600 mb-0.5">
                      CPA
                    </p>
                    <p className="text-[11px] font-semibold text-gray-700 dark:text-gray-200 tabular-nums">
                      {c.cpa !== null ? fmtArs(c.cpa) : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-600 mb-0.5">
                      CTR
                    </p>
                    <p className="text-[11px] font-semibold text-gray-700 dark:text-gray-200 tabular-nums">
                      {c.ctr > 0 ? `${c.ctr.toFixed(1)}%` : '—'}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}
