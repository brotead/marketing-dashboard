'use client'

import { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, Minus, Loader2 } from 'lucide-react'

interface MonthlyData {
  cur:  { spend: number; conversions: number; ctr: number; cpl: number }
  prev: { spend: number; conversions: number; ctr: number; cpl: number }
  spendSeries: { day: number; curSpend: number; prevSpend: number }[]
  ctrSeries:   { day: number; curCtr: number | null; prevCtr: number | null }[]
  dateFrom: string
  dateTo:   string
  prevFrom: string
  prevTo:   string
  clientType: string
}

function ars(v: number) {
  const r = Math.round(Math.abs(v))
  return (v < 0 ? '-$' : '$') + r.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

function pctDelta(cur: number, prev: number): number | null {
  if (prev === 0) return null
  return ((cur - prev) / prev) * 100
}

// Smooth cubic bezier path from an array of [x, y] points
function buildCurve(pts: [number, number][]): string {
  if (pts.length < 2) return ''
  const d: string[] = [`M ${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`]
  for (let i = 1; i < pts.length; i++) {
    const [px, py] = pts[i - 1]
    const [cx, cy] = pts[i]
    const dx = (cx - px) / 2.5
    d.push(
      `C ${(px + dx).toFixed(1)},${py.toFixed(1)} ` +
      `${(cx - dx).toFixed(1)},${cy.toFixed(1)} ` +
      `${cx.toFixed(1)},${cy.toFixed(1)}`
    )
  }
  return d.join(' ')
}

// ── Delta badge ───────────────────────────────────────────────────────────────

function DeltaBadge({ value, invert = false }: { value: number | null; invert?: boolean }) {
  if (value === null) return <span className="text-[10px] text-gray-600">—</span>
  const flat = Math.abs(value) < 0.5
  const good = flat ? true : (invert ? value < 0 : value > 0)
  const cls  = flat
    ? 'text-gray-500 bg-gray-500/[0.08]'
    : good
    ? 'text-green-400 bg-green-500/[0.1]'
    : 'text-red-400 bg-red-500/[0.1]'
  const Icon = flat ? Minus : value > 0 ? TrendingUp : TrendingDown
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-bold px-2 py-0.5 rounded-lg shrink-0 ${cls}`}>
      <Icon size={10} strokeWidth={2.5} />
      {value > 0 ? '+' : ''}{value.toFixed(1)}%
    </span>
  )
}

// ── Sparkline (bezier curve + subtle gradient fill) ───────────────────────────

function Sparkline({ pts, color, uid }: { pts: [number, number][]; color: string; uid: string }) {
  if (pts.length < 3) return null

  const W = 300, H = 52
  const xs = pts.map(p => p[0])
  const ys = pts.map(p => p[1])
  const minX = Math.min(...xs), maxX = Math.max(...xs)
  const minY = Math.min(...ys), maxY = Math.max(...ys)
  const rX = Math.max(maxX - minX, 1)
  const rY = Math.max(maxY - minY, 0.0001)

  const mapped: [number, number][] = pts.map(([x, y]) => [
    ((x - minX) / rX) * W,
    H * 0.05 + H * 0.82 * (1 - (y - minY) / rY),
  ])

  const line = buildCurve(mapped)
  const first = mapped[0], last = mapped[mapped.length - 1]
  const area = `${line} L ${last[0].toFixed(1)},${H} L ${first[0].toFixed(1)},${H} Z`

  return (
    <svg
      width="100%" viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="w-full overflow-visible"
      style={{ height: '100%' }}
    >
      <defs>
        <linearGradient id={uid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.14" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${uid})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ── Card 1: Inversión ─────────────────────────────────────────────────────────

function SpendCard({ cur, prev, spendSeries }: Pick<MonthlyData, 'cur' | 'prev' | 'spendSeries'>) {
  const d   = pctDelta(cur.spend, prev.spend)
  const pts = spendSeries
    .filter(s => s.curSpend > 0)
    .map((s, i): [number, number] => [i, s.curSpend])

  return (
    <div className="bg-[#141414] border border-[#1e1e1e] rounded-2xl p-5 flex flex-col gap-3 overflow-hidden"
      style={{ maxHeight: 220 }}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest leading-tight">
          Inversión del mes
        </p>
        <DeltaBadge value={d} />
      </div>

      <div>
        <p className="text-[26px] font-bold text-white tabular-nums leading-none">{ars(cur.spend)}</p>
        <p className="text-[11px] text-gray-600 mt-1">{ars(prev.spend)} mes anterior</p>
      </div>

      <div className="flex-1 min-h-0">
        <Sparkline pts={pts} color="#3b82f6" uid="mc-spend" />
      </div>
    </div>
  )
}

// ── Card 2: Conversaciones + Costo ────────────────────────────────────────────

function ConvCard({ cur, prev, clientType }: Pick<MonthlyData, 'cur' | 'prev' | 'clientType'>) {
  const isMsg     = clientType === 'messaging'
  const convLabel = isMsg ? 'Conversaciones' : 'Visitas IG'
  const cplLabel  = isMsg ? 'Costo por mensaje' : 'Costo por visita'
  const dConv     = pctDelta(cur.conversions, prev.conversions)
  const dCpl      = pctDelta(cur.cpl, prev.cpl)

  return (
    <div className="bg-[#141414] border border-[#1e1e1e] rounded-2xl p-4 flex flex-col gap-3 overflow-hidden"
      style={{ maxHeight: 220 }}>
      {/* Conversaciones */}
      <div>
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest leading-tight">{convLabel}</p>
          <DeltaBadge value={dConv} />
        </div>
        <p className="text-[24px] font-bold text-white tabular-nums leading-none">
          {cur.conversions > 0 ? cur.conversions.toLocaleString('es-AR') : '—'}
        </p>
        <p className="text-[11px] text-gray-600 mt-1">
          {prev.conversions > 0 ? prev.conversions.toLocaleString('es-AR') : '—'} mes anterior
        </p>
      </div>

      <div className="border-t border-[#1e1e1e]" />

      {/* CPL */}
      <div>
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest leading-tight">{cplLabel}</p>
          <DeltaBadge value={dCpl} invert />
        </div>
        <p className="text-[24px] font-bold text-white tabular-nums leading-none">
          {cur.cpl > 0 ? ars(cur.cpl) : '—'}
        </p>
        <p className="text-[11px] text-gray-600 mt-1">
          {prev.cpl > 0 ? ars(prev.cpl) : '—'} mes anterior
        </p>
      </div>
    </div>
  )
}

// ── Card 3: CTR ───────────────────────────────────────────────────────────────

function CtrCard({ cur, prev, ctrSeries }: Pick<MonthlyData, 'cur' | 'prev' | 'ctrSeries'>) {
  const d     = pctDelta(cur.ctr, prev.ctr)
  const valid = ctrSeries.filter(s => s.curCtr !== null)
  const pts   = valid.map((s, i): [number, number] => [i, s.curCtr!])
  const color = (d ?? 0) >= 0 ? '#22c55e' : '#ef4444'

  return (
    <div className="bg-[#141414] border border-[#1e1e1e] rounded-2xl p-5 flex flex-col gap-3 overflow-hidden"
      style={{ maxHeight: 220 }}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest leading-tight">
          CTR del mes
        </p>
        <DeltaBadge value={d} />
      </div>

      <div>
        <p className="text-[26px] font-bold text-white tabular-nums leading-none">{cur.ctr.toFixed(2)}%</p>
        <p className="text-[11px] text-gray-600 mt-1">{prev.ctr.toFixed(2)}% mes anterior</p>
      </div>

      <div className="flex-1 min-h-0">
        <Sparkline pts={pts} color={color} uid="mc-ctr" />
      </div>
    </div>
  )
}

// ── Export ────────────────────────────────────────────────────────────────────

export default function MonthlyCharts({
  accountId, clientName,
}: { accountId: string; clientName: string }) {
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
        <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">Resumen del mes</p>
        {data && (
          <p className="text-[10px] text-gray-600">
            {fmtD(data.dateFrom)}–{fmtD(data.dateTo)} · vs {fmtD(data.prevFrom)}–{fmtD(data.prevTo)}
          </p>
        )}
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-gray-600 py-4">
          <Loader2 size={13} className="animate-spin" />
          Cargando…
        </div>
      )}
      {error && <p className="text-xs text-rose-400 py-2">{error}</p>}

      {!loading && !error && data && (
        <div className="grid grid-cols-3 gap-4">
          <SpendCard cur={data.cur} prev={data.prev} spendSeries={data.spendSeries} />
          <ConvCard  cur={data.cur} prev={data.prev} clientType={data.clientType} />
          <CtrCard   cur={data.cur} prev={data.prev} ctrSeries={data.ctrSeries} />
        </div>
      )}
    </div>
  )
}
