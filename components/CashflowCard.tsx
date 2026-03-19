'use client'

import { Settings, Trash2, TrendingDown, TrendingUp, Minus } from 'lucide-react'
import type { CampaignData, BudgetEntry, CashflowResult } from '@/lib/types'

interface Props {
  campaign: CampaignData
  budget: BudgetEntry | null
  cashflow: CashflowResult | null
  year: number
  month: number
  onEdit: () => void
  onDelete: () => void
}

const MONTHS_SHORT = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

function currency(n: number) {
  return n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
}

function SourceBadge({ source }: { source: string }) {
  return source === 'google' ? (
    <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full font-medium">Google Ads</span>
  ) : (
    <span className="bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded-full font-medium">Meta Ads</span>
  )
}

export default function CashflowCard({ campaign, budget, cashflow, year, month, onEdit, onDelete }: Props) {
  const displayName = budget?.campaign_name || campaign.campaign_name || `Campaña ${campaign.campaign_id}`

  // Unconfigured
  if (!budget || !cashflow) {
    return (
      <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-5 flex flex-col gap-3 hover:border-gray-300 transition">
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-1.5">
            <SourceBadge source={campaign.source} />
            <p className="font-semibold text-gray-800 text-sm leading-snug">{displayName}</p>
          </div>
          <button
            onClick={onEdit}
            className="text-blue-600 hover:text-blue-700 text-xs font-medium flex items-center gap-1 bg-blue-50 px-2.5 py-1.5 rounded-lg hover:bg-blue-100 transition"
          >
            <Settings size={12} /> Configurar
          </button>
        </div>
        <div className="flex items-center justify-between pt-1 border-t border-gray-100">
          <p className="text-xs text-gray-400">Sin presupuesto asignado</p>
          <p className="text-sm font-semibold text-gray-600">{currency(campaign.spend)} gastado</p>
        </div>
      </div>
    )
  }

  const STATUS = {
    on_track: {
      bg: 'bg-green-50', border: 'border-green-100', bar: 'bg-green-500',
      badge: 'bg-green-100 text-green-700', label: 'En línea', Icon: Minus,
    },
    overspending: {
      bg: 'bg-red-50', border: 'border-red-100', bar: 'bg-red-500',
      badge: 'bg-red-100 text-red-700', label: 'Sobreinversión', Icon: TrendingUp,
    },
    underspending: {
      bg: 'bg-amber-50', border: 'border-amber-100', bar: 'bg-amber-400',
      badge: 'bg-amber-100 text-amber-700', label: 'Subinversión', Icon: TrendingDown,
    },
  }[cashflow.status]

  const barWidth = Math.min(cashflow.pctConsumed, 100)
  const expectedWidth = Math.min(cashflow.pctExpected, 100)

  return (
    <div className={`${STATUS.bg} rounded-2xl border ${STATUS.border} p-5 flex flex-col gap-4`}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <SourceBadge source={campaign.source} />
            <span className={`${STATUS.badge} text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1`}>
              <STATUS.Icon size={10} />
              {STATUS.label}
            </span>
          </div>
          <p className="font-semibold text-gray-900 text-sm leading-snug">{displayName}</p>
          <p className="text-xs text-gray-500">{budget.client_name} · {MONTHS_SHORT[month - 1]} {year}</p>
        </div>
        <div className="flex items-center gap-0.5">
          <button onClick={onEdit} className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-white/60 transition">
            <Settings size={14} />
          </button>
          <button onClick={onDelete} className="text-gray-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-white/60 transition">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <p className="text-xs text-gray-500 mb-0.5">Presupuesto</p>
          <p className="font-bold text-gray-900 text-sm">{currency(cashflow.budgetTotal)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-0.5">Invertido</p>
          <p className="font-bold text-gray-900 text-sm">{currency(cashflow.spendToDate)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-0.5">Restante</p>
          <p className={`font-bold text-sm ${cashflow.budgetRemaining < 0 ? 'text-red-600' : 'text-gray-900'}`}>
            {currency(cashflow.budgetRemaining)}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex justify-between text-xs text-gray-500 mb-1.5">
          <span>Consumido: <strong>{cashflow.pctConsumed.toFixed(1)}%</strong></span>
          <span>Esperado: {cashflow.pctExpected.toFixed(1)}%</span>
        </div>
        <div className="relative h-2.5 bg-white/70 rounded-full overflow-hidden">
          {/* Expected marker */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-gray-400/60 z-10"
            style={{ left: `${expectedWidth}%` }}
          />
          <div
            className={`h-full rounded-full transition-all duration-500 ${STATUS.bar}`}
            style={{ width: `${barWidth}%` }}
          />
        </div>
        <p className="text-xs mt-1.5 text-gray-500">
          Desvío:{' '}
          <strong className={cashflow.deviation > 0 ? 'text-red-600' : cashflow.deviation < 0 ? 'text-amber-600' : 'text-green-600'}>
            {cashflow.deviation > 0 ? '+' : ''}{cashflow.deviation.toFixed(1)}%
          </strong>
        </p>
      </div>

      {/* Daily recommended */}
      <div className="bg-white/70 rounded-xl p-3 flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500">Presupuesto diario recomendado</p>
          <p className="text-lg font-bold text-gray-900">
            {currency(Math.max(cashflow.dailyRecommended, 0))}
            <span className="text-xs font-normal text-gray-400">/día</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-400">{cashflow.daysLeft} días</p>
          <p className="text-xs text-gray-400">restantes</p>
        </div>
      </div>
    </div>
  )
}
