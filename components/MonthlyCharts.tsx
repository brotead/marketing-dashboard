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

type Dir = 'up' | 'down' | 'flat'

function direction(d: number | null): Dir {
  if (d === null || Math.abs(d) < 0.5) return 'flat'
  return d > 0 ? 'up' : 'down'
}

// Left accent color — pass isGood=true when "up" means good, false when "down" means good
function accentBar(d: number | null, upIsGood = true) {
  const dir = direction(d)
  if (dir === 'flat') return 'bg-gray-600/40'
  const good = upIsGood ? dir === 'up' : dir === 'down'
  return good ? 'bg-emerald-500' : 'bg-rose-500'
}

// Big delta pill — prominent, readable
function DeltaPill({ d, invert = false }: { d: number | null; invert?: boolean }) {
  if (d === null) return <span className="text-sm text-gray-600 font-semibold">—</span>
  const dir     = direction(d)
  const good    = dir === 'flat' ? true : (invert ? dir === 'down' : dir === 'up')
  const neutral = dir === 'flat'
  const Icon    = neutral ? Minus : d > 0 ? TrendingUp : TrendingDown
  const label   = neutral ? 'Sin cambio' : good ? 'Mejor' : 'Peor'

  const color = neutral ? 'text-gray-400' : good ? 'text-emerald-400' : 'text-rose-400'
  const bg    = neutral ? 'bg-gray-500/10 border-gray-500/20'
              : good    ? 'bg-emerald-500/10 border-emerald-500/20'
              :            'bg-rose-500/10 border-rose-500/20'

  return (
    <div className="flex flex-col items-end gap-0.5 shrink-0">
      <span className={`inline-flex items-center gap-1 text-sm font-bold px-2.5 py-1 rounded-xl border ${color} ${bg}`}>
        <Icon size={13} strokeWidth={2.5} />
        {d > 0 ? '+' : ''}{d.toFixed(1)}%
      </span>
      <span className={`text-[10px] font-semibold ${color}`}>{label} vs mes ant.</span>
    </div>
  )
}

// Comparison bar pair — current (colored) + prev (gray)
function CompareBars({
  cur, prev, max, curColor,
}: { cur: number; prev: number; max: number; curColor: string }) {
  const cW = max > 0 ? Math.min((cur / max) * 100, 100) : 0
  const pW = max > 0 ? Math.min((prev / max) * 100, 100) : 0
  return (
    <div className="space-y-1.5 mt-2">
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-gray-600 w-12 text-right shrink-0">Este mes</span>
        <div className="flex-1 h-2 bg-[#252525] rounded-full overflow-hidden">
          <div style={{ width: `${cW}%` }} className={`h-full rounded-full transition-all duration-700 ${curColor}`} />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-gray-600 w-12 text-right shrink-0">Mes ant.</span>
        <div className="flex-1 h-2 bg-[#252525] rounded-full overflow-hidden">
          <div style={{ width: `${pW}%` }} className="h-full bg-[#374151] rounded-full transition-all duration-700" />
        </div>
      </div>
    </div>
  )
}

// ── Card 1: Inversión acumulada ────────────────────────────────────────────────

function SpendCard({ cur, prev, spendSeries }: Pick<MonthlyData, 'cur' | 'prev' | 'spendSeries'>) {
  const d    = pctDelta(cur.spend, prev.spend)
  const W = 260, H = 48

  const validN = spendSeries.filter(s => s.curSpend > 0).length
  const maxVal = Math.max(...spendSeries.map(s => Math.max(s.curSpend, s.prevSpend)), 1)

  const toX = (i: number) => (i / Math.max(spendSeries.length - 1, 1)) * W
  const toY = (v: number) => H - (v / maxVal) * H * 0.88

  const curPts  = spendSeries.map((s, i) => `${toX(i)},${toY(s.curSpend)}`).join(' ')
  const prevPts = spendSeries.map((s, i) => `${toX(i)},${toY(s.prevSpend)}`).join(' ')
  const showChart = validN > 3

  return (
    <div className="relative bg-[#141414] border border-[#272727] rounded-2xl p-5 overflow-hidden flex flex-col gap-4">
      <div className={`absolute left-0 top-0 bottom-0 w-[3px] rounded-l-2xl ${accentBar(d)}`} />

      {/* Header */}
      <div className="flex items-start justify-between pl-1">
        <div>
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Inversión del mes</p>
          <p className="text-[28px] font-bold text-white tabular-nums leading-none">{ars(cur.spend)}</p>
          <p className="text-xs text-gray-500 mt-1.5">{ars(prev.spend)} mes anterior</p>
        </div>
        <DeltaPill d={d} />
      </div>

      {/* Sparkline */}
      {showChart && (
        <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="overflow-visible">
          <defs>
            <linearGradient id="spend-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#3b82f6" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
            </linearGradient>
          </defs>
          <polyline points={prevPts} fill="none" stroke="#374151" strokeWidth="1.5" strokeDasharray="4 3" />
          <polygon  points={`0,${H} ${curPts} ${toX(spendSeries.length - 1)},${H}`} fill="url(#spend-fill)" />
          <polyline points={curPts}  fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}

      <CompareBars cur={cur.spend} prev={prev.spend} max={Math.max(cur.spend, prev.spend, 1)} curColor="bg-blue-500" />
    </div>
  )
}

// ── Card 2: Conversaciones + CPL — stacked layout (NO 2-col grid) ──────────────

function ConvCard({ cur, prev, clientType }: Pick<MonthlyData, 'cur' | 'prev' | 'clientType'>) {
  const isMsg = clientType === 'messaging'
  const convLabel = isMsg ? 'Conversaciones iniciadas' : 'Visitas al perfil IG'
  const cplLabel  = isMsg ? 'Costo por mensaje' : 'Costo por visita'

  const dConv = pctDelta(cur.conversions, prev.conversions)
  const dCpl  = pctDelta(cur.cpl, prev.cpl)

  const maxConv = Math.max(cur.conversions, prev.conversions, 1)
  const maxCpl  = Math.max(cur.cpl, prev.cpl, 1)

  // Card accent: primarily driven by conversions (more = better)
  const overallGood = (() => {
    const convDir = direction(dConv)
    const cplDir  = direction(dCpl)
    const convGood = convDir === 'up'
    const cplGood  = cplDir === 'down'
    if (convGood && cplGood) return true
    if (!convGood && !cplGood && convDir !== 'flat' && cplDir !== 'flat') return false
    return convDir !== 'flat' ? convGood : cplGood
  })()
  const accentCls = (dConv === null && dCpl === null) ? 'bg-gray-600/40'
    : overallGood ? 'bg-emerald-500' : 'bg-rose-500'

  return (
    <div className="relative bg-[#141414] border border-[#272727] rounded-2xl p-5 overflow-hidden flex flex-col gap-0">
      <div className={`absolute left-0 top-0 bottom-0 w-[3px] rounded-l-2xl ${accentCls}`} />

      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4 pl-1">
        {isMsg ? 'Conversaciones · Costo/Mensaje' : 'Visitas IG · Costo/Visita'}
      </p>

      {/* Metric 1: Conversaciones */}
      <div className="pl-1 pb-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] text-gray-500 mb-1">{convLabel}</p>
            <p className="text-2xl font-bold text-white tabular-nums leading-none">
              {cur.conversions > 0 ? cur.conversions.toLocaleString('es-AR') : '—'}
            </p>
            <p className="text-[11px] text-gray-600 mt-1">
              {prev.conversions > 0 ? prev.conversions.toLocaleString('es-AR') : '—'} mes anterior
            </p>
          </div>
          <DeltaPill d={dConv} />
        </div>
        <CompareBars cur={cur.conversions} prev={prev.conversions} max={maxConv} curColor="bg-emerald-500" />
      </div>

      {/* Divider */}
      <div className="border-t border-[#222] my-1" />

      {/* Metric 2: CPL */}
      <div className="pl-1 pt-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] text-gray-500 mb-1">{cplLabel}</p>
            <p className="text-2xl font-bold text-white tabular-nums leading-none">
              {cur.cpl > 0 ? ars(cur.cpl) : '—'}
            </p>
            <p className="text-[11px] text-gray-600 mt-1">
              {prev.cpl > 0 ? ars(prev.cpl) : '—'} mes anterior
            </p>
          </div>
          <DeltaPill d={dCpl} invert />
        </div>
        <CompareBars
          cur={cur.cpl} prev={prev.cpl} max={maxCpl}
          curColor={direction(dCpl) === 'down' ? 'bg-emerald-500' : direction(dCpl) === 'up' ? 'bg-rose-500' : 'bg-blue-500'}
        />
      </div>
    </div>
  )
}

// ── Card 3: CTR trend ──────────────────────────────────────────────────────────

function CtrCard({ cur, prev, ctrSeries }: Pick<MonthlyData, 'cur' | 'prev' | 'ctrSeries'>) {
  const d    = pctDelta(cur.ctr, prev.ctr)
  const isUp = direction(d) !== 'down'
  const W = 260, H = 56

  const validCur = ctrSeries.filter(s => s.curCtr !== null)
  const showChart = validCur.length > 3

  const allVals = ctrSeries.flatMap(s => [s.curCtr, s.prevCtr]).filter((v): v is number => v !== null)
  const maxV = allVals.length > 0 ? Math.max(...allVals) * 1.05 : 1
  const minV = allVals.length > 0 ? Math.min(...allVals) * 0.95 : 0
  const range = Math.max(maxV - minV, 0.01)

  const toX = (day: number) => ((day - 1) / Math.max(ctrSeries.length - 1, 1)) * W
  const toY = (v: number)   => H - ((v - minV) / range) * H * 0.9

  const lineCol = isUp ? '#10b981' : '#f43f5e'
  const gradId  = 'ctr-area'

  const curPts = validCur.map(s => `${toX(s.day)},${toY(s.curCtr!)}`).join(' ')
  const lastPt = validCur.at(-1)

  return (
    <div className="relative bg-[#141414] border border-[#272727] rounded-2xl p-5 overflow-hidden flex flex-col gap-4">
      <div className={`absolute left-0 top-0 bottom-0 w-[3px] rounded-l-2xl ${accentBar(d)}`} />

      {/* Header */}
      <div className="flex items-start justify-between pl-1">
        <div>
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">CTR del mes</p>
          <p className="text-[28px] font-bold text-white tabular-nums leading-none">{cur.ctr.toFixed(2)}%</p>
          <p className="text-xs text-gray-500 mt-1.5">{prev.ctr.toFixed(2)}% mes anterior</p>
        </div>
        <DeltaPill d={d} />
      </div>

      {/* Sparkline */}
      {showChart ? (
        <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="overflow-visible">
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={lineCol} stopOpacity="0.25" />
              <stop offset="100%" stopColor={lineCol} stopOpacity="0" />
            </linearGradient>
          </defs>
          {/* Prev avg reference line */}
          {prev.ctr > 0 && (
            <line x1="0" y1={toY(prev.ctr)} x2={W} y2={toY(prev.ctr)}
              stroke="#374151" strokeWidth="1" strokeDasharray="4 3" />
          )}
          {lastPt && (
            <polygon
              points={`0,${H} ${curPts} ${toX(lastPt.day)},${H}`}
              fill={`url(#${gradId})`}
            />
          )}
          <polyline points={curPts} fill="none" stroke={lineCol} strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round" />
          {lastPt && (
            <circle cx={toX(lastPt.day)} cy={toY(lastPt.curCtr!)} r="3" fill={lineCol} />
          )}
        </svg>
      ) : (
        <CompareBars cur={cur.ctr} prev={prev.ctr} max={Math.max(cur.ctr, prev.ctr, 0.01)} curColor={isUp ? 'bg-emerald-500' : 'bg-rose-500'} />
      )}

      {showChart && (
        <div className="flex items-center gap-4 text-[10px] text-gray-600">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 rounded-full inline-block" style={{ backgroundColor: lineCol }} />
            CTR diario
          </span>
          <span className="flex items-center gap-1.5 opacity-70">
            <span className="w-4 inline-block border-t border-dashed border-gray-600" />
            Promedio mes ant.
          </span>
        </div>
      )}
    </div>
  )
}

// ── Main export ────────────────────────────────────────────────────────────────

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
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Resumen visual del mes</p>
        {data && (
          <p className="text-[10px] text-gray-600">
            {fmtD(data.dateFrom)}–{fmtD(data.dateTo)} · vs {fmtD(data.prevFrom)}–{fmtD(data.prevTo)}
          </p>
        )}
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-gray-500 py-3">
          <Loader2 size={13} className="animate-spin" />
          Cargando datos del mes…
        </div>
      )}
      {error && <p className="text-xs text-rose-400 py-2">{error}</p>}

      {!loading && !error && data && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <SpendCard cur={data.cur} prev={data.prev} spendSeries={data.spendSeries} />
          <ConvCard  cur={data.cur} prev={data.prev} clientType={data.clientType} />
          <CtrCard   cur={data.cur} prev={data.prev} ctrSeries={data.ctrSeries} />
        </div>
      )}
    </div>
  )
}
