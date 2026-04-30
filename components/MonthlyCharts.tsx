'use client'

import { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, Minus, Loader2 } from 'lucide-react'

interface MonthlyData {
  cur:  { spend: number; conversions: number; ctr: number; cpl: number }
  prev: { spend: number; conversions: number; ctr: number; cpl: number }
  spendSeries: { day: number; curSpend: number; prevSpend: number }[]
  convSeries:  { day: number; curConv:  number; prevConv:  number  }[]
  ctrSeries:   { day: number; curCtr:   number | null; prevCtr: number | null }[]
  dateFrom: string; dateTo: string; prevFrom: string; prevTo: string
  clientType: string
}

function ars(v: number) {
  return '$' + Math.round(Math.abs(v)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

function pctDelta(cur: number, prev: number): number | null {
  if (prev === 0) return null
  return ((cur - prev) / prev) * 100
}

// Smooth bezier path
function curve(pts: [number, number][]): string {
  if (pts.length < 2) return ''
  const d = [`M ${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`]
  for (let i = 1; i < pts.length; i++) {
    const [px, py] = pts[i - 1], [cx, cy] = pts[i]
    const dx = (cx - px) / 2.5
    d.push(`C ${(px+dx).toFixed(1)},${py.toFixed(1)} ${(cx-dx).toFixed(1)},${cy.toFixed(1)} ${cx.toFixed(1)},${cy.toFixed(1)}`)
  }
  return d.join(' ')
}

// ── Delta badge ───────────────────────────────────────────────────────────────

function Badge({ v, invert = false }: { v: number | null; invert?: boolean }) {
  if (v === null) return <span className="text-[10px] text-gray-600">—</span>
  const flat = Math.abs(v) < 0.5
  const good = flat || (invert ? v < 0 : v > 0)
  const cls  = flat ? 'text-gray-500 bg-gray-500/10'
             : good ? 'text-green-400 bg-green-500/10'
             :        'text-red-400 bg-red-500/10'
  const Icon = flat ? Minus : v > 0 ? TrendingUp : TrendingDown
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-bold px-2 py-0.5 rounded-lg ${cls}`}>
      <Icon size={10} strokeWidth={2.5} />
      {v > 0 ? '+' : ''}{v.toFixed(1)}%
    </span>
  )
}

// ── Dual-line chart: este mes (solid) vs mes anterior (dashed) ─────────────────

function DualChart({
  cur, prev, color, uid, formatTick,
}: {
  cur:       number[]
  prev:      number[]
  color:     string
  uid:       string
  formatTick:(v: number) => string
}) {
  const W = 300, H = 110, L = 44, B = 16
  const PH = H - B  // plot height (below X axis labels)

  // Filter out trailing zeros in current (days not yet passed)
  const lastNonZero = cur.reduce((acc, v, i) => v > 0 ? i : acc, -1)
  const curTrimmed  = lastNonZero >= 0 ? cur.slice(0, lastNonZero + 1) : cur

  const allVals = [...curTrimmed, ...prev].filter(v => v > 0)
  if (allVals.length < 2) {
    return <div className="flex items-center justify-center h-full text-[11px] text-gray-700">Sin datos suficientes</div>
  }

  const maxV = Math.max(...allVals)
  const rng  = Math.max(maxV, 0.001)

  const toX = (i: number, len: number) => L + (i / Math.max(len - 1, 1)) * (W - L)
  const toY = (v: number) => PH * 0.95 - (v / rng) * PH * 0.87

  const curPts:  [number, number][] = curTrimmed.map((v, i) => [toX(i, curTrimmed.length), toY(v)])
  const prevPts: [number, number][] = prev.map((v, i)       => [toX(i, prev.length),       toY(v)])

  const curLine  = curve(curPts)
  const prevLine = curve(prevPts.filter(([, y]) => isFinite(y)))

  const f = curPts[0], l = curPts[curPts.length - 1]
  const area = curLine ? `${curLine} L ${l[0].toFixed(1)},${PH.toFixed(1)} L ${f[0].toFixed(1)},${PH.toFixed(1)} Z` : ''

  // Y axis: 3 ticks (0, mid, max)
  const yTicks = [0, maxV / 2, maxV]

  // X axis: day 1, midpoint, last day
  const nDays = curTrimmed.length
  const xTickIdxs = [...new Set([0, Math.floor((nDays - 1) / 2), nDays - 1])].filter(i => i >= 0)

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={uid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Y grid lines + labels */}
      {yTicks.map((v, i) => (
        <g key={i}>
          <line x1={L} x2={W} y1={toY(v)} y2={toY(v)} stroke="#222" strokeWidth="0.7" />
          <text x={L - 4} y={toY(v) + 3.5} textAnchor="end" fontSize="9" fill="#4b4b4b">
            {formatTick(v)}
          </text>
        </g>
      ))}

      {/* X axis baseline */}
      <line x1={L} x2={W} y1={PH} y2={PH} stroke="#2a2a2a" strokeWidth="0.8" />

      {/* X tick labels (day numbers) */}
      {xTickIdxs.map(idx => (
        <text key={idx} x={toX(idx, nDays)} y={H - 2} textAnchor="middle" fontSize="9" fill="#4b4b4b">
          {idx + 1}
        </text>
      ))}

      {/* Previous month — dashed gray */}
      {prevLine && (
        <path d={prevLine} fill="none" stroke="#3a3a3a" strokeWidth="1.2"
          strokeDasharray="4 3" strokeLinecap="round" />
      )}
      {/* Current month — fill */}
      {area && <path d={area} fill={`url(#${uid})`} />}
      {/* Current month — line */}
      {curLine && (
        <path d={curLine} fill="none" stroke={color} strokeWidth="1.8"
          strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  )
}

// ── Card wrapper ──────────────────────────────────────────────────────────────

function ChartCard({
  title, delta, invertDelta, color, uid,
  cur, prev, formatTick, total, prevTotal, formatTotal,
}: {
  title: string; delta: number | null; invertDelta?: boolean
  color: string; uid: string
  cur: number[]; prev: number[]
  formatTick:  (v: number) => string
  total: number; prevTotal: number; formatTotal: (v: number) => string
}) {
  return (
    <div className="bg-[#141414] border border-[#1e1e1e] rounded-2xl p-5 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">{title}</p>
        <Badge v={delta} invert={invertDelta} />
      </div>

      {/* Totals — secondary */}
      <div className="flex items-baseline gap-2">
        <span className="text-[22px] font-bold text-white tabular-nums leading-none">{formatTotal(total)}</span>
        <span className="text-[11px] text-gray-600 tabular-nums">vs {formatTotal(prevTotal)}</span>
      </div>

      {/* Chart — hero */}
      <div style={{ height: 110 }}>
        <DualChart cur={cur} prev={prev} color={color} uid={uid} formatTick={formatTick} />
      </div>
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function MonthlyCharts({ accountId, clientName }: { accountId: string; clientName: string }) {
  const [data,    setData]    = useState<MonthlyData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    setLoading(true); setData(null); setError(null)
    fetch(`/api/audit/monthly?account_id=${accountId}&client_name=${encodeURIComponent(clientName)}`)
      .then(r => r.json())
      .then(json => { if (json.error) throw new Error(json.error); setData(json) })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [accountId, clientName])

  const fmtD = (s: string) => { const [, m, d] = s.split('-'); return `${d}/${m}` }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">Rendimiento diario del mes</p>
        {data && (
          <p className="text-[10px] text-gray-600">
            {fmtD(data.dateFrom)}–{fmtD(data.dateTo)} · vs {fmtD(data.prevFrom)}–{fmtD(data.prevTo)}
          </p>
        )}
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-gray-600 py-4">
          <Loader2 size={13} className="animate-spin" /> Cargando…
        </div>
      )}
      {error && <p className="text-xs text-rose-400 py-2">{error}</p>}

      {!loading && !error && data && (() => {
        const isMsg     = data.clientType === 'messaging'
        const convLabel = isMsg ? 'Conversaciones' : 'Visitas IG'
        const d_spend   = pctDelta(data.cur.spend,       data.prev.spend)
        const d_conv    = pctDelta(data.cur.conversions,  data.prev.conversions)
        const d_ctr     = pctDelta(data.cur.ctr,          data.prev.ctr)

        return (
          <div className="grid grid-cols-3 gap-4">
            <ChartCard
              title="Inversión"
              delta={d_spend}
              color="#3b82f6"
              uid="mc-spend"
              cur={data.spendSeries.map(s => s.curSpend)}
              prev={data.spendSeries.map(s => s.prevSpend)}
              formatTick={ars}
              total={data.cur.spend}
              prevTotal={data.prev.spend}
              formatTotal={ars}
            />
            <ChartCard
              title={convLabel}
              delta={d_conv}
              color="#a78bfa"
              uid="mc-conv"
              cur={data.convSeries.map(s => s.curConv)}
              prev={data.convSeries.map(s => s.prevConv)}
              formatTick={v => Math.round(v).toString()}
              total={data.cur.conversions}
              prevTotal={data.prev.conversions}
              formatTotal={v => v > 0 ? v.toLocaleString('es-AR') : '—'}
            />
            <ChartCard
              title="CTR"
              delta={d_ctr}
              color={d_ctr !== null && d_ctr >= 0 ? '#22c55e' : '#ef4444'}
              uid="mc-ctr"
              cur={data.ctrSeries.map(s => s.curCtr ?? 0)}
              prev={data.ctrSeries.map(s => s.prevCtr ?? 0)}
              formatTick={v => `${v.toFixed(1)}%`}
              total={data.cur.ctr}
              prevTotal={data.prev.ctr}
              formatTotal={v => `${v.toFixed(2)}%`}
            />
          </div>
        )
      })()}
    </div>
  )
}
