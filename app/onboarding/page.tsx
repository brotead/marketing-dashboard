'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Plus, Trash2, ChevronRight, X, Globe, AlertTriangle, CheckCircle2, Zap, RefreshCw, ExternalLink, Pencil, Check } from 'lucide-react'
import type { OnboardingClient, Platform, BillingType } from '@/lib/onboarding'
import {
  CHECKLIST, TRACKING_CHECKLIST, getRelevantItems,
  checklistProgress, trackingProgress, getBillingType,
  PLATFORM_LABELS, PLATFORM_SHORT,
} from '@/lib/onboarding'

function fmtDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function PlatformBadge({ platform }: { platform: Platform }) {
  const colors: Record<Platform, string> = {
    meta:   'bg-blue-600/15 text-blue-400 border-blue-500/30',
    google: 'bg-red-500/15 text-red-400 border-red-500/30',
    both:   'bg-violet-500/15 text-violet-400 border-violet-500/30',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${colors[platform]}`}>
      {PLATFORM_SHORT[platform]}
    </span>
  )
}

function ProgressBar({ checked, total }: { checked: number; total: number }) {
  const pct   = total > 0 ? Math.round((checked / total) * 100) : 0
  const color = pct === 100 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-400' : 'bg-rose-400'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-200 dark:bg-[#2d2d2d] rounded-full overflow-hidden">
        <div style={{ width: `${pct}%` }} className={`h-full rounded-full transition-all ${color}`} />
      </div>
      <span className="text-[11px] text-gray-500 shrink-0 tabular-nums">{checked}/{total}</span>
    </div>
  )
}

function CheckItem({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className="flex items-center gap-2.5 w-full py-2 px-1 rounded-lg hover:bg-gray-100 dark:hover:bg-[#252525] transition-colors text-left group"
    >
      <div className={`w-4.5 h-4.5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${
        checked ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300 dark:border-gray-600 group-hover:border-gray-500 dark:group-hover:border-gray-400'
      }`} style={{ width: 18, height: 18 }}>
        {checked && <CheckCircle2 size={11} className="text-white" strokeWidth={3} />}
      </div>
      <span className={`text-sm transition-colors ${checked ? 'text-gray-800 dark:text-gray-100 font-medium' : 'text-gray-500 dark:text-gray-400'}`}>{label}</span>
    </button>
  )
}

// ── Client card ───────────────────────────────────────────────────────────────

function clientOverdueInfo(client: OnboardingClient) {
  const acc = checklistProgress(client.platform, client.checklist)
  const trk = trackingProgress(client.checklist)
  const complete = acc.checked >= acc.total && trk.checked >= trk.total
  const days = Math.floor((Date.now() - new Date(client.created_at).getTime()) / 864e5)
  return { isOverdue: !complete && days > 7, days, isComplete: complete }
}

function ClientCard({
  client, onView, onDelete, deleteConfirm, setDeleteConfirm,
}: {
  client: OnboardingClient
  onView: () => void
  onDelete: () => void
  deleteConfirm: boolean
  setDeleteConfirm: (v: boolean) => void
}) {
  const accesos  = checklistProgress(client.platform, client.checklist)
  const tracking = trackingProgress(client.checklist)
  const { isOverdue, days } = clientOverdueInfo(client)

  return (
    <div className={`rounded-2xl border shadow-sm hover:shadow-md transition-all p-5 flex flex-col gap-4 ${
      isOverdue
        ? 'bg-red-50 dark:bg-[rgba(80,0,0,0.22)] border-red-200 dark:border-[rgba(255,80,80,0.28)] hover:border-red-300 dark:hover:border-[rgba(255,80,80,0.45)] animate-overdue-pulse'
        : 'bg-white dark:bg-[#1a1a1a] border-gray-100 dark:border-[#2a2a2a] hover:border-gray-200 dark:hover:border-[#333]'
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-gray-900 dark:text-gray-100 text-base truncate">{client.name}</h3>
            {isOverdue && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/15 border border-red-400/30 text-red-500 dark:text-red-400 text-[10px] font-bold shrink-0">
                ⚠ +7 días
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <PlatformBadge platform={client.platform} />
            {client.website && (
              <a href={client.website.startsWith('http') ? client.website : `https://${client.website}`}
                 target="_blank" rel="noopener noreferrer"
                 onClick={e => e.stopPropagation()}
                 className="text-[11px] text-gray-500 hover:text-blue-400 flex items-center gap-0.5 transition-colors">
                <Globe size={10} /><span className="truncate max-w-[100px]">{client.website.replace(/^https?:\/\//, '')}</span>
              </a>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className="text-[11px] text-gray-400 dark:text-gray-500">{fmtDate(client.created_at)}</span>
          {isOverdue && (
            <span className="text-[10px] text-red-400/80">Hace {days} días</span>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <div>
          <p className={`text-[10px] font-bold uppercase tracking-widest mb-1.5 ${isOverdue ? 'text-red-400/60 dark:text-red-400/50' : 'text-gray-400 dark:text-gray-500'}`}>Accesos</p>
          <ProgressBar checked={accesos.checked} total={accesos.total} />
        </div>
        <div>
          <p className={`text-[10px] font-bold uppercase tracking-widest mb-1.5 ${isOverdue ? 'text-red-400/60 dark:text-red-400/50' : 'text-gray-400 dark:text-gray-500'}`}>Técnico</p>
          <ProgressBar checked={tracking.checked} total={tracking.total} />
        </div>
      </div>

      <div className={`flex items-center gap-2 pt-1 border-t mt-auto ${isOverdue ? 'border-red-200/60 dark:border-[rgba(255,80,80,0.15)]' : 'border-gray-100 dark:border-[#2a2a2a]'}`}>
        <button
          onClick={onView}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-white text-xs font-semibold transition ${
            isOverdue ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          Ver detalle <ChevronRight size={12} />
        </button>

        {deleteConfirm ? (
          <div className="flex items-center gap-1">
            <button onClick={onDelete} className="px-2.5 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition">
              Eliminar
            </button>
            <button onClick={() => setDeleteConfirm(false)} className="px-2.5 py-2 rounded-xl bg-gray-100 dark:bg-[#252525] text-gray-500 dark:text-gray-400 text-xs font-semibold hover:bg-gray-200 dark:hover:bg-[#2d2d2d] transition">
              Cancelar
            </button>
          </div>
        ) : (
          <button
            onClick={() => setDeleteConfirm(true)}
            className="p-2 rounded-xl text-gray-500 hover:bg-rose-500/15 hover:text-rose-400 transition"
            title="Eliminar cliente"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
  )
}

// ── New client modal ──────────────────────────────────────────────────────────

function NewClientModal({ onClose, onCreate }: {
  onClose: () => void
  onCreate: (client: OnboardingClient) => void
}) {
  const [name,     setName]     = useState('')
  const [platform, setPlatform] = useState<Platform>('meta')
  const [website,  setWebsite]  = useState('')
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('El nombre es obligatorio'); return }
    setSaving(true); setError('')
    try {
      const res  = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, platform, website }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      onCreate(data)
      onClose()
    } catch (err) {
      setError(String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-md bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#2a2a2a] rounded-2xl shadow-2xl p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">Nuevo cliente</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 dark:hover:bg-[#252525] rounded-lg text-gray-400 dark:text-gray-500 transition"><X size={16} /></button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5">Nombre del cliente *</label>
            <input
              value={name} onChange={e => setName(e.target.value)}
              placeholder="Ej: Agro Norte"
              className="w-full px-3 py-2.5 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#333] rounded-xl text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-2">Plataformas *</label>
            <div className="space-y-2">
              {(['meta', 'google', 'both'] as Platform[]).map(p => (
                <label key={p} className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl border cursor-pointer transition ${
                  platform === p ? 'border-blue-500 bg-blue-600/10' : 'border-gray-200 dark:border-[#333] hover:bg-gray-50 dark:hover:bg-[#252525]'
                }`}>
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    platform === p ? 'border-blue-500' : 'border-gray-300 dark:border-gray-600'
                  }`}>
                    {platform === p && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                  </div>
                  <input type="radio" className="hidden" checked={platform === p} onChange={() => setPlatform(p)} />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{PLATFORM_LABELS[p]}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5">
              Sitio web <span className="text-gray-400 dark:text-gray-500 font-normal">(opcional)</span>
            </label>
            <input
              value={website} onChange={e => setWebsite(e.target.value)}
              placeholder="https://cliente.com"
              className="w-full px-3 py-2.5 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#333] rounded-xl text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          {error && <p className="text-xs text-rose-400 flex items-center gap-1"><AlertTriangle size={12} />{error}</p>}

          <button
            type="submit" disabled={saving}
            className="w-full py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? 'Guardando…' : 'Guardar cliente'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ── Client drawer ─────────────────────────────────────────────────────────────

function ClientDrawer({ client, onClose, onUpdate }: {
  client: OnboardingClient
  onClose: () => void
  onUpdate: (c: OnboardingClient) => void
}) {
  const [editingName, setEditingName] = useState(false)
  const [nameValue,   setNameValue]   = useState(client.name)
  const nameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { if (editingName) { setEditingName(false); setNameValue(client.name) } else onClose() }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose, editingName, client.name])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  useEffect(() => {
    if (editingName) nameInputRef.current?.select()
  }, [editingName])

  async function saveName() {
    const trimmed = nameValue.trim()
    if (!trimmed || trimmed === client.name) { setEditingName(false); setNameValue(client.name); return }
    const res  = await fetch(`/api/onboarding/${client.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: trimmed }),
    })
    const data = await res.json()
    if (!data.error) onUpdate(data)
    setEditingName(false)
  }

  async function toggleCheck(key: string) {
    const next = { ...client.checklist, [key]: !client.checklist[key] }
    const res  = await fetch(`/api/onboarding/${client.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ checklist: next }),
    })
    const data = await res.json()
    if (!data.error) onUpdate(data)
  }

  async function updateBillingType(val: BillingType | null) {
    const next = {
      ...client.checklist,
      billing_linea_credito:   val === 'linea_credito',
      billing_tarjeta_cliente: val === 'tarjeta_cliente',
    }
    const res = await fetch(`/api/onboarding/${client.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ checklist: next }),
    })
    const data = await res.json()
    if (!data.error) onUpdate(data)
  }

  const relevantItems = getRelevantItems(client.platform)
  const metaItems     = relevantItems.filter(i => i.group === 'meta')
  const googleItems   = relevantItems.filter(i => i.group === 'google')
  const commonItems   = relevantItems.filter(i => i.group === 'common')
  const accesos       = checklistProgress(client.platform, client.checklist)
  const tracking      = trackingProgress(client.checklist)
  const billingType   = getBillingType(client.checklist)

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/60 backdrop-blur-sm cursor-pointer" onClick={onClose} />
      <div className="w-full max-w-lg bg-white dark:bg-[#1a1a1a] border-l border-gray-200 dark:border-[#2a2a2a] shadow-2xl flex flex-col overflow-hidden">

        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-[#2a2a2a] flex items-start justify-between gap-4 shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {editingName ? (
                <div className="flex items-center gap-1.5">
                  <input
                    ref={nameInputRef}
                    value={nameValue}
                    onChange={e => setNameValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveName() }}
                    className="text-base font-bold bg-white dark:bg-[#252525] border border-blue-500 rounded-lg px-2 py-0.5 text-gray-900 dark:text-gray-100 focus:outline-none w-48"
                  />
                  <button onClick={saveName} className="p-1 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition shrink-0">
                    <Check size={12} />
                  </button>
                  <button onClick={() => { setEditingName(false); setNameValue(client.name) }} className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-[#333] transition shrink-0">
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 group/name">
                  <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 truncate">{client.name}</h2>
                  <button
                    onClick={() => setEditingName(true)}
                    className="p-1 rounded-lg text-gray-400 opacity-0 group-hover/name:opacity-100 hover:bg-gray-100 dark:hover:bg-[#333] transition"
                  >
                    <Pencil size={11} />
                  </button>
                </div>
              )}
              <PlatformBadge platform={client.platform} />
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500">Cargado {fmtDate(client.created_at)}</span>
              {client.website && (
                <a href={client.website.startsWith('http') ? client.website : `https://${client.website}`}
                   target="_blank" rel="noopener noreferrer"
                   className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors">
                  <ExternalLink size={10} />{client.website.replace(/^https?:\/\//, '')}
                </a>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 dark:hover:bg-[#252525] rounded-lg text-gray-400 dark:text-gray-500 transition shrink-0">
            <X size={16} />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">

          {/* Tipo de cliente */}
          <div className="px-6 pt-5 pb-4 border-b border-gray-100 dark:border-[#2a2a2a]">
            <p className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">Tipo de cliente</p>
            <div className="flex gap-2">
              {(['linea_credito', 'tarjeta_cliente'] as BillingType[]).map(opt => (
                <button
                  key={opt}
                  onClick={() => updateBillingType(billingType === opt ? null : opt)}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${
                    billingType === opt
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'bg-white dark:bg-[#252525] border-gray-200 dark:border-[#333] text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-[#444]'
                  }`}
                >
                  {opt === 'linea_credito' ? 'Línea de crédito' : 'Tarjeta cliente'}
                </button>
              ))}
            </div>
          </div>

          {/* Accesos */}
          <div className="px-6 pt-5 pb-4 border-b border-gray-100 dark:border-[#2a2a2a]">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Accesos</p>
              <ProgressBar checked={accesos.checked} total={accesos.total} />
            </div>

            <div className={`grid gap-x-6 gap-y-0 ${client.platform === 'both' ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {metaItems.length > 0 && (
                <div>
                  {client.platform === 'both' && (
                    <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wider mb-2">Meta Ads</p>
                  )}
                  {metaItems.map(item => (
                    <CheckItem key={item.key} label={item.label}
                      checked={!!client.checklist[item.key]}
                      onChange={() => toggleCheck(item.key)} />
                  ))}
                </div>
              )}
              {googleItems.length > 0 && (
                <div>
                  {client.platform === 'both' && (
                    <p className="text-[10px] font-bold text-red-400 uppercase tracking-wider mb-2">Google Ads</p>
                  )}
                  {googleItems.map(item => (
                    <CheckItem key={item.key} label={item.label}
                      checked={!!client.checklist[item.key]}
                      onChange={() => toggleCheck(item.key)} />
                  ))}
                </div>
              )}
            </div>

            {commonItems.length > 0 && (
              <div className={`${metaItems.length > 0 || googleItems.length > 0 ? 'mt-3 pt-3 border-t border-gray-100 dark:border-[#2a2a2a]' : ''} grid grid-cols-2 gap-x-6`}>
                {commonItems.map(item => (
                  <CheckItem key={item.key} label={item.label}
                    checked={!!client.checklist[item.key]}
                    onChange={() => toggleCheck(item.key)} />
                ))}
              </div>
            )}
          </div>

          {/* Técnico */}
          <div className="px-6 pt-5 pb-6">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Técnico</p>
              <ProgressBar checked={tracking.checked} total={tracking.total} />
            </div>

            <div className="grid grid-cols-2 gap-x-6">
              {TRACKING_CHECKLIST.map(item => (
                <CheckItem key={item.key} label={item.label}
                  checked={!!client.checklist[item.key]}
                  onChange={() => toggleCheck(item.key)} />
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const [clients,       setClients]       = useState<OnboardingClient[]>([])
  const [loading,       setLoading]       = useState(true)
  const [showNew,       setShowNew]       = useState(false)
  const [selected,      setSelected]      = useState<OnboardingClient | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch('/api/onboarding')
      const data = await res.json()
      if (!data.error) setClients(data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  function updateClient(updated: OnboardingClient) {
    setClients(prev => prev.map(c => c.id === updated.id ? updated : c))
    if (selected?.id === updated.id) setSelected(updated)
  }

  async function deleteClient(id: string) {
    await fetch(`/api/onboarding/${id}`, { method: 'DELETE' })
    setClients(prev => prev.filter(c => c.id !== id))
    setDeleteConfirm(null)
    if (selected?.id === id) setSelected(null)
  }

  const overdueCount = useMemo(() => clients.filter(c => clientOverdueInfo(c).isOverdue).length, [clients])

  const sortedClients = useMemo(() => [...clients].sort((a, b) => {
    function order(c: OnboardingClient) {
      const { isOverdue, isComplete } = clientOverdueInfo(c)
      if (isOverdue)  return 0
      if (!isComplete) return 1
      return 2
    }
    return order(a) - order(b)
  }), [clients])

  return (
    <>
      <div className="space-y-6">

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-0.5">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center shrink-0">
                <Zap size={13} className="text-white" />
              </div>
              <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100">Onboarding Clientes</h1>
              {overdueCount > 0 && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-500 dark:text-red-400 text-xs font-bold">
                  ⚠ {overdueCount} retrasado{overdueCount > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 ml-9">Gestión técnica de clientes nuevos · Paid Media</p>
          </div>
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 transition shrink-0"
          >
            <Plus size={14} /> Cargar nuevo cliente
          </button>
        </div>

        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[1,2,3,4].map(i => <div key={i} className="h-52 bg-gray-100 dark:bg-[#1a1a1a] rounded-2xl border border-gray-200 dark:border-[#2a2a2a] animate-pulse" />)}
          </div>
        )}

        {!loading && clients.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-gray-200 dark:border-[#2a2a2a] rounded-2xl bg-gray-50 dark:bg-[#141414]">
            <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-[#252525] flex items-center justify-center mb-3">
              <Plus size={20} className="text-gray-400 dark:text-gray-500" />
            </div>
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Sin clientes en onboarding</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">Cargá el primer cliente para comenzar</p>
            <button
              onClick={() => setShowNew(true)}
              className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 transition"
            >
              <Plus size={13} /> Cargar cliente
            </button>
          </div>
        )}

        {!loading && sortedClients.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {sortedClients.map(c => (
              <ClientCard
                key={c.id}
                client={c}
                onView={() => setSelected(c)}
                onDelete={() => deleteClient(c.id)}
                deleteConfirm={deleteConfirm === c.id}
                setDeleteConfirm={v => setDeleteConfirm(v ? c.id : null)}
              />
            ))}
          </div>
        )}

        {!loading && clients.length > 0 && (
          <div className="flex justify-end">
            <button onClick={load} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition">
              <RefreshCw size={11} /> Actualizar
            </button>
          </div>
        )}

      </div>

      {showNew && (
        <NewClientModal
          onClose={() => setShowNew(false)}
          onCreate={c => { setClients(prev => [c, ...prev]); setSelected(c) }}
        />
      )}

      {selected && (
        <ClientDrawer
          client={selected}
          onClose={() => setSelected(null)}
          onUpdate={updateClient}
        />
      )}
    </>
  )
}
