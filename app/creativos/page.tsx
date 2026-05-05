'use client'

import { useState, useMemo } from 'react'
import Image from 'next/image'
import { RefreshCw, AlertTriangle, Eye, CheckCircle } from 'lucide-react'
import type { FatigueAd } from '@/lib/types'
import { appCache, TTL } from '@/lib/appCache'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function currency(n: number) {
  return n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
}

function pct(n: number) {
  return `${n.toFixed(2)}%`
}

function fmt(dateStr: string) {
  return new Date(dateStr).toLocaleString('es-AR', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

const REC_CONFIG = {
  PAUSAR:  { label: 'Pausar urgente', bg: 'bg-red-600',     light: 'bg-red-500/10 border-red-500/30 text-red-400',           dot: 'bg-red-500'    },
  REVISAR: { label: 'Revisar',        bg: 'bg-amber-500',   light: 'bg-amber-500/10 border-amber-500/30 text-amber-400',     dot: 'bg-amber-400'  },
  ACTIVO:  { label: 'Activo',         bg: 'bg-emerald-500', light: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400', dot: 'bg-emerald-400' },
}

const SIGNAL_CONFIG = {
  frequency: { icon: '🔁', color: 'bg-orange-500/15 text-orange-300' },
  ctr_drop:  { icon: '📉', color: 'bg-red-500/15 text-red-300'       },
  cpa_rise:  { icon: '💸', color: 'bg-purple-500/15 text-purple-300' },
  cpm_rise:  { icon: '📈', color: 'bg-blue-600/15 text-blue-300'     },
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CreativosPage() {
  const [ads, setAds]             = useState<FatigueAd[]>(() =>
    appCache.peek<{ ads: FatigueAd[] }>('fatigue')?.ads ?? [])
  const [analyzedAt, setAnalyzedAt] = useState<string | null>(() =>
    appCache.peek<{ analyzed_at: string | null }>('fatigue')?.analyzed_at ?? null)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [filterRec, setFilterRec] = useState<FatigueAd['recommendation'] | 'ALL'>('PAUSAR')
  const [filterClient, setFilterClient] = useState<string>('ALL')
  const [expandedAd, setExpandedAd]     = useState<string | null>(null)

  async function analyze() {
    appCache.invalidateHard('fatigue')
    setLoading(true)
    setError(null)
    try {
      const json = await appCache.fetch('fatigue', () =>
        fetch('/api/fatigue').then(r => r.json()), TTL.MIN5)
      if (json.error) throw new Error(json.error)
      setAds(json.ads ?? [])
      setAnalyzedAt(json.analyzed_at)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  // Derived
  const clients = useMemo(
    () => Array.from(new Set(ads.map(a => a.account_name))).sort(),
    [ads]
  )

  const filtered = useMemo(
    () => ads.filter(a => {
      if (filterRec !== 'ALL' && a.recommendation !== filterRec) return false
      if (filterClient !== 'ALL' && a.account_name !== filterClient) return false
      return true
    }),
    [ads, filterRec, filterClient]
  )

  const { pausarCount, revisarCount, activoCount, totalBurned } = useMemo(() => {
    let pausar = 0, revisar = 0, activo = 0, burned = 0
    for (const a of ads) {
      if (a.recommendation === 'PAUSAR') { pausar++; burned += a.spend_projection }
      else if (a.recommendation === 'REVISAR') revisar++
      else if (a.recommendation === 'ACTIVO') activo++
    }
    return { pausarCount: pausar, revisarCount: revisar, activoCount: activo, totalBurned: burned }
  }, [ads])

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Detector de Creativos Muertos</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            Analiza los últimos 14 días · detecta ads en fatiga que siguen quemando presupuesto
          </p>
          {analyzedAt && (
            <p className="text-xs text-gray-500 mt-1">Último análisis: {fmt(analyzedAt)}</p>
          )}
        </div>
        <button
          onClick={analyze}
          disabled={loading}
          className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700 transition disabled:opacity-60 shrink-0"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Analizando...' : ads.length > 0 ? 'Volver a analizar' : 'Analizar ahora'}
        </button>
      </div>

      {/* Empty state */}
      {!loading && ads.length === 0 && !error && (
        <div className="bg-[#1a1a1a] rounded-xl border border-[#2a2a2a] flex flex-col items-center justify-center py-24 gap-4">
          <div className="w-14 h-14 rounded-full bg-[#252525] flex items-center justify-center text-2xl">🔍</div>
          <div className="text-center">
            <p className="font-semibold text-gray-300">Ningún análisis ejecutado</p>
            <p className="text-sm text-gray-500 mt-1">Presioná &ldquo;Analizar ahora&rdquo; para detectar creativos en fatiga</p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-500/15 border border-red-500/30 text-red-400 rounded-xl p-4 mb-4 text-sm">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-3">
          {[1,2,3,4,5].map(i => (
            <div key={i} className="h-20 bg-[#1a1a1a] rounded-xl border border-[#2a2a2a] animate-pulse" />
          ))}
        </div>
      )}

      {/* Results */}
      {!loading && ads.length > 0 && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            <div className="bg-[#1a1a1a] rounded-xl border border-[#2a2a2a] px-4 py-3">
              <p className="text-xs text-gray-400 mb-0.5">Ads analizados</p>
              <p className="text-2xl font-bold text-gray-100">{ads.length}</p>
              <p className="text-xs text-gray-400">últimos 7 días con gasto</p>
            </div>
            <div className="bg-red-500/10 rounded-xl border border-red-500/20 px-4 py-3">
              <p className="text-xs text-red-400 mb-0.5">Pausar urgente</p>
              <p className="text-2xl font-bold text-red-400">{pausarCount}</p>
              <p className="text-xs text-red-400">≥ 2 señales de fatiga</p>
            </div>
            <div className="bg-amber-500/10 rounded-xl border border-amber-500/20 px-4 py-3">
              <p className="text-xs text-amber-400 mb-0.5">Revisar</p>
              <p className="text-2xl font-bold text-amber-400">{revisarCount}</p>
              <p className="text-xs text-amber-400">1 señal detectada</p>
            </div>
            <div className="bg-[#1a1a1a] rounded-xl border border-[#2a2a2a] px-4 py-3">
              <p className="text-xs text-gray-400 mb-0.5">Presupuesto estimado en riesgo</p>
              <p className="text-lg font-bold text-red-400">{currency(totalBurned)}</p>
              <p className="text-xs text-gray-400">proyección próx. 7 días · ads a pausar</p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              onClick={() => setFilterRec('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition border ${filterRec === 'ALL' ? 'bg-blue-600 text-white border-blue-600' : 'bg-[#1a1a1a] text-gray-400 border-[#333] hover:bg-[#252525]'}`}
            >
              Ver todos ({ads.length})
            </button>
            <button
              onClick={() => setFilterRec('PAUSAR')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition border ${filterRec === 'PAUSAR' ? 'bg-red-600 text-white border-red-600' : 'bg-[#1a1a1a] text-red-400 border-red-500/30 hover:bg-red-500/10'}`}
            >
              Pausar urgente ({pausarCount})
            </button>
            <button
              onClick={() => setFilterRec('REVISAR')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition border ${filterRec === 'REVISAR' ? 'bg-amber-500 text-white border-amber-500' : 'bg-[#1a1a1a] text-amber-400 border-amber-500/30 hover:bg-amber-500/10'}`}
            >
              Revisar ({revisarCount})
            </button>
            <button
              onClick={() => setFilterRec('ACTIVO')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition border ${filterRec === 'ACTIVO' ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-[#1a1a1a] text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10'}`}
            >
              Activos ({activoCount})
            </button>

            {clients.length > 1 && (
              <div className="flex items-center gap-1.5 ml-2 pl-2 border-l border-[#333]">
                <span className="text-xs text-gray-500">Cliente:</span>
                <select
                  value={filterClient}
                  onChange={e => setFilterClient(e.target.value)}
                  className="bg-[#1a1a1a] border border-[#333] rounded-lg px-2 py-1 text-xs text-gray-100"
                >
                  <option value="ALL">Todos</option>
                  {clients.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            )}
          </div>

          {/* Ad list — grouped by recommendation */}
          <div className="space-y-6">
            {filtered.length === 0 && (
              <div className="bg-[#1a1a1a] rounded-xl border border-[#2a2a2a] py-12 text-center text-gray-500 text-sm">
                No hay ads con este filtro
              </div>
            )}

            {(['PAUSAR', 'REVISAR', 'ACTIVO'] as const)
              .map(rec => {
                const group = filtered.filter(a => a.recommendation === rec)
                if (group.length === 0) return null
                const cfg = REC_CONFIG[rec]
                return (
                  <div key={rec}>
                    {/* Group header */}
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{cfg.label}</span>
                      <span className="text-xs text-gray-600">· {group.length} ad{group.length !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="space-y-2">
                      {group.map(ad => {
                        const isExpanded = expandedAd === ad.ad_id
                        return (
                          <div
                            key={ad.ad_id}
                            className={`bg-[#1a1a1a] rounded-xl border transition-all ${
                              rec === 'PAUSAR' ? 'border-red-500/30' : rec === 'REVISAR' ? 'border-amber-500/30' : 'border-[#2a2a2a]'
                            }`}
                          >
                            {/* Main row */}
                            <div
                              className="flex items-start gap-4 px-5 py-4 cursor-pointer"
                              onClick={() => setExpandedAd(isExpanded ? null : ad.ad_id)}
                            >
                              {/* Thumbnail */}
                              <div className="shrink-0">
                                {ad.thumbnail_url ? (
                                  <div className="w-11 h-11 rounded-lg overflow-hidden bg-[#252525] border border-[#333]">
                                    <Image
                                      src={ad.thumbnail_url}
                                      alt={ad.ad_name}
                                      width={44}
                                      height={44}
                                      className="w-full h-full object-cover"
                                      unoptimized
                                    />
                                  </div>
                                ) : (
                                  <div className="w-11 h-11 rounded-lg bg-[#252525] border border-[#333] flex items-center justify-center text-gray-500 text-lg font-bold">
                                    {ad.ad_name.charAt(0)}
                                  </div>
                                )}
                              </div>

                              {/* Ad info */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                  <span className="text-[11px] bg-[#252525] text-gray-400 px-1.5 py-0.5 rounded font-medium shrink-0">{ad.account_name}</span>
                                  <span className="text-[11px] text-gray-500 truncate">{ad.campaign_name}</span>
                                </div>
                                <p className="font-semibold text-gray-100 text-sm leading-snug">{ad.ad_name}</p>
                                {ad.adset_name && (
                                  <p className="text-xs text-gray-500 mt-0.5 truncate">Conjunto: {ad.adset_name}</p>
                                )}

                                {/* Signal pills */}
                                <div className="flex flex-wrap gap-1.5 mt-2">
                                  {ad.signals.map(sig => {
                                    const sc = SIGNAL_CONFIG[sig.type]
                                    return (
                                      <span key={sig.type} className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium ${sc.color}`}>
                                        {sc.icon} {sig.label} <strong>{sig.detail}</strong>
                                      </span>
                                    )
                                  })}
                                  {ad.signals.length === 0 && (
                                    <span className="text-[11px] text-emerald-400 flex items-center gap-1">
                                      <CheckCircle size={11} /> Rendimiento estable
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Metrics column */}
                              <div className="shrink-0 text-right hidden sm:flex flex-col items-end gap-0.5">
                                <div className="flex items-baseline gap-2">
                                  <div className="text-right">
                                    <p className="text-base font-bold text-gray-100">{currency(ad.spend_recent)}</p>
                                    <p className="text-[10px] text-gray-500">últimos 7d</p>
                                  </div>
                                  <div className="text-right border-l border-[#2a2a2a] pl-2">
                                    <p className="text-base font-bold text-gray-300">{currency(ad.spend_month)}</p>
                                    <p className="text-[10px] text-gray-500">mes actual</p>
                                  </div>
                                </div>
                                {rec === 'PAUSAR' && (
                                  <p className="text-xs text-red-400 font-medium mt-0.5">+{currency(ad.spend_projection)} proyectado</p>
                                )}
                                <p className="text-xs text-gray-500 mt-1">
                                  CTR {pct(ad.ctr_recent)} · Frec. {ad.frequency_recent.toFixed(1)}x
                                </p>
                              </div>

                              <div className="shrink-0 text-gray-600 text-xs mt-1">
                                {isExpanded ? '▴' : '▾'}
                              </div>
                            </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="border-t border-[#2a2a2a] px-5 py-4 bg-[#252525]/30">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                        {/* Frequency */}
                        <div>
                          <p className="text-[11px] text-gray-500 uppercase tracking-wide mb-1">Frecuencia</p>
                          <p className={`text-lg font-bold ${ad.frequency_recent >= 4 ? 'text-red-400' : 'text-gray-100'}`}>
                            {ad.frequency_recent.toFixed(2)}x
                          </p>
                          <p className="text-[11px] text-gray-500">umbral: 4.0x</p>
                        </div>

                        {/* CTR */}
                        <div>
                          <p className="text-[11px] text-gray-500 uppercase tracking-wide mb-1">CTR · 7d vs 7d ant.</p>
                          <p className={`text-lg font-bold ${ad.ctr_prev > 0 && ad.ctr_recent < ad.ctr_prev * 0.65 ? 'text-red-400' : 'text-gray-100'}`}>
                            {pct(ad.ctr_recent)}
                          </p>
                          {ad.ctr_prev > 0 ? (
                            <p className="text-[11px] text-gray-500">
                              sem. ant.: {pct(ad.ctr_prev)} ·{' '}
                              <span className={ad.ctr_recent < ad.ctr_prev ? 'text-red-400' : 'text-emerald-400'}>
                                {`${(((ad.ctr_recent - ad.ctr_prev) / ad.ctr_prev) * 100).toFixed(0)}%`}
                              </span>
                            </p>
                          ) : (
                            <p className="text-[11px] text-gray-500">ad nuevo · sin comparación</p>
                          )}
                        </div>

                        {/* CPM */}
                        <div>
                          <p className="text-[11px] text-gray-500 uppercase tracking-wide mb-1">CPM · 7d vs 7d ant.</p>
                          <p className={`text-lg font-bold ${ad.cpm_prev > 0 && ad.cpm_recent > ad.cpm_prev * 1.25 ? 'text-red-400' : 'text-gray-100'}`}>
                            {currency(ad.cpm_recent)}
                          </p>
                          {ad.cpm_prev > 0 ? (
                            <p className="text-[11px] text-gray-500">
                              sem. ant.: {currency(ad.cpm_prev)} ·{' '}
                              <span className={ad.cpm_recent > ad.cpm_prev ? 'text-red-400' : 'text-emerald-400'}>
                                {`${(((ad.cpm_recent - ad.cpm_prev) / ad.cpm_prev) * 100).toFixed(0)}%`}
                              </span>
                            </p>
                          ) : (
                            <p className="text-[11px] text-gray-500">ad nuevo · sin comparación</p>
                          )}
                        </div>

                        {/* CPA */}
                        <div>
                          <p className="text-[11px] text-gray-500 uppercase tracking-wide mb-1">CPA / Conversiones</p>
                          {ad.conversions_recent > 0 ? (
                            <>
                              <p className={`text-lg font-bold ${ad.cpa_recent > ad.cpa_prev * 1.30 && ad.cpa_prev > 0 ? 'text-red-400' : 'text-gray-100'}`}>
                                {currency(ad.cpa_recent)}
                              </p>
                              <p className="text-[11px] text-gray-500">
                                {ad.conversions_recent} conv.
                                {ad.cpa_prev > 0 && ` · antes: ${currency(ad.cpa_prev)}`}
                              </p>
                            </>
                          ) : (
                            <p className="text-sm text-gray-500">Sin conversiones</p>
                          )}
                        </div>
                      </div>

                      {/* Recommendation detail */}
                      <div className={`rounded-lg border px-4 py-3 ${REC_CONFIG[ad.recommendation].light}`}>
                        <div className="flex items-start gap-2">
                          {ad.recommendation === 'PAUSAR' ? (
                            <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                          ) : ad.recommendation === 'REVISAR' ? (
                            <Eye size={15} className="shrink-0 mt-0.5" />
                          ) : (
                            <CheckCircle size={15} className="shrink-0 mt-0.5" />
                          )}
                          <div className="text-xs leading-relaxed">
                            {ad.recommendation === 'PAUSAR' && (
                              <>
                                <strong>Este ad cumple {ad.signal_count} de las condiciones de fatiga.</strong> Se recomienda pausarlo inmediatamente.
                                Si continúa activo, se estima un gasto adicional de <strong>{currency(ad.spend_projection)}</strong> en los próximos 7 días con rendimiento deteriorado.
                              </>
                            )}
                            {ad.recommendation === 'REVISAR' && (
                              <>
                                <strong>Este ad muestra 1 señal de alerta.</strong> Revisá el creativo y evaluá si es necesario refrescar la audiencia o el contenido.
                                Monitoreá la evolución en los próximos 3-4 días antes de tomar una decisión.
                              </>
                            )}
                            {ad.recommendation === 'ACTIVO' && (
                              <>
                                <strong>Sin señales críticas detectadas.</strong> El ad está rindiendo dentro de parámetros normales.
                                Seguí monitoreando frecuencia y CTR regularmente.
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
          </div>
        </>
      )}
    </div>
  )
}
