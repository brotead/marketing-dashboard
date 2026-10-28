'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { X, Plus, StickyNote, Trash2, GripVertical, ChevronLeft, ChevronRight } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

type Column = 'pendiente' | 'en_curso' | 'hecho'

interface Nota {
  id: string
  text: string
  column: Column
  createdAt: number
}

// ── Config ────────────────────────────────────────────────────────────────────

const COLS: {
  key: Column
  label: string
  accent: string        // top border + dot
  ring: string          // drag-over ring
  cardBorder: string    // card left border
  bg: string            // column bg tint
  dropBg: string        // column drag-over bg
}[] = [
  {
    key: 'pendiente',
    label: 'YO',
    accent: '#f59e0b',
    ring: 'ring-amber-400/60',
    cardBorder: 'border-l-amber-400',
    bg: 'bg-gray-50/60 dark:bg-white/[0.02]',
    dropBg: 'bg-amber-50/80 dark:bg-amber-500/[0.07]',
  },
  {
    key: 'en_curso',
    label: 'Interno',
    accent: '#3b82f6',
    ring: 'ring-blue-400/60',
    cardBorder: 'border-l-blue-500',
    bg: 'bg-gray-50/60 dark:bg-white/[0.02]',
    dropBg: 'bg-blue-50/80 dark:bg-blue-500/[0.07]',
  },
  {
    key: 'hecho',
    label: 'Cliente',
    accent: '#10b981',
    ring: 'ring-emerald-400/60',
    cardBorder: 'border-l-emerald-500',
    bg: 'bg-gray-50/60 dark:bg-white/[0.02]',
    dropBg: 'bg-emerald-50/80 dark:bg-emerald-500/[0.07]',
  },
]

const COL_KEYS: Column[] = ['pendiente', 'en_curso', 'hecho']
const STORAGE_KEY = 'brotead_notas_v1'

// ── Storage ───────────────────────────────────────────────────────────────────

function load(): Nota[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') } catch { return [] }
}
function save(n: Nota[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(n)) } catch {}
}

// ── Card ──────────────────────────────────────────────────────────────────────

function NoteCard({
  nota,
  colConfig,
  isDragging,
  onDragStart,
  onDragEnd,
  onDelete,
  onMove,
  onSave,
}: {
  nota: Nota
  colConfig: typeof COLS[number]
  isDragging: boolean
  onDragStart: () => void
  onDragEnd: () => void
  onDelete: () => void
  onMove: (dir: -1 | 1) => void
  onSave: (text: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(nota.text)
  const colIdx = COL_KEYS.indexOf(nota.column)

  const commit = () => {
    const t = draft.trim()
    if (!t) { onDelete(); return }
    onSave(t)
    setEditing(false)
  }

  return (
    <div
      draggable={!editing}
      onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; onDragStart() }}
      onDragEnd={onDragEnd}
      className={`group relative bg-white dark:bg-[#1e1e1e] border border-l-[3px] ${colConfig.cardBorder} border-gray-200/80 dark:border-white/[0.07] rounded-xl p-3.5 shadow-sm transition-all duration-150 select-none
        ${isDragging ? 'opacity-40 scale-[0.97] shadow-none rotate-1 cursor-grabbing' : 'hover:shadow-md hover:border-gray-300 dark:hover:border-white/[0.12] cursor-grab active:cursor-grabbing'}`}
    >
      {/* Grip handle */}
      <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-40 transition-opacity cursor-grab">
        <GripVertical size={13} className="text-gray-400" />
      </div>

      {editing ? (
        <textarea
          autoFocus
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commit() }
            if (e.key === 'Escape') { setDraft(nota.text); setEditing(false) }
          }}
          rows={3}
          className="w-full pr-5 text-[13px] text-gray-800 dark:text-gray-100 bg-transparent resize-none outline-none leading-relaxed cursor-text"
        />
      ) : (
        <p
          className="text-[13px] text-gray-700 dark:text-gray-200 leading-relaxed whitespace-pre-wrap break-words pr-5 cursor-text"
          onClick={() => { setDraft(nota.text); setEditing(true) }}
        >
          {nota.text}
        </p>
      )}

      {/* Bottom actions — appear on hover */}
      <div className="flex items-center gap-0.5 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onMove(-1)}
          disabled={colIdx === 0}
          title="Mover a la izquierda"
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-white/[0.08] transition-colors disabled:opacity-20 disabled:cursor-default"
        >
          <ChevronLeft size={12} />
        </button>
        <button
          onClick={() => onMove(1)}
          disabled={colIdx === COL_KEYS.length - 1}
          title="Mover a la derecha"
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-white/[0.08] transition-colors disabled:opacity-20 disabled:cursor-default"
        >
          <ChevronRight size={12} />
        </button>
        <div className="flex-1" />
        <button
          onClick={onDelete}
          title="Eliminar"
          className="p-1.5 rounded-lg text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  )
}

// ── Add card input ─────────────────────────────────────────────────────────────

function AddCard({ onAdd, onCancel }: { onAdd: (text: string) => void; onCancel: () => void }) {
  const [text, setText] = useState('')
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { ref.current?.focus() }, [])

  const submit = () => {
    const t = text.trim()
    if (!t) { onCancel(); return }
    onAdd(t)
  }

  return (
    <div className="bg-white dark:bg-[#1e1e1e] border border-blue-400/50 dark:border-blue-500/40 rounded-xl p-3.5 shadow-sm ring-2 ring-blue-400/20">
      <textarea
        ref={ref}
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() }
          if (e.key === 'Escape') onCancel()
        }}
        placeholder="Escribí tu nota…"
        rows={3}
        className="w-full text-[13px] text-gray-800 dark:text-gray-100 bg-transparent resize-none outline-none leading-relaxed placeholder:text-gray-400 dark:placeholder:text-gray-600"
      />
      <div className="flex items-center gap-2 mt-3">
        <button
          onClick={submit}
          className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-[12px] font-semibold rounded-lg transition-colors shadow-sm"
        >
          Guardar
        </button>
        <button
          onClick={onCancel}
          className="px-3.5 py-1.5 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-[12px] font-medium rounded-lg hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors"
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}

// ── Main modal ─────────────────────────────────────────────────────────────────

interface Props {
  open: boolean
  onClose: () => void
}

export default function NotasModal({ open, onClose }: Props) {
  const [notas, setNotas] = useState<Nota[]>([])
  const [adding, setAdding] = useState<Column | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverCol, setDragOverCol] = useState<Column | null>(null)

  useEffect(() => { setNotas(load()) }, [])

  const update = useCallback((next: Nota[]) => { setNotas(next); save(next) }, [])

  const addNota = (col: Column, text: string) => {
    update([
      ...notas,
      { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, text, column: col, createdAt: Date.now() },
    ])
    setAdding(null)
  }

  const deleteNota = (id: string) => update(notas.filter(n => n.id !== id))

  const moveNota = (id: string, dir: -1 | 1) =>
    update(notas.map(n => {
      if (n.id !== id) return n
      const idx = COL_KEYS.indexOf(n.column) + dir
      return idx < 0 || idx >= COL_KEYS.length ? n : { ...n, column: COL_KEYS[idx] }
    }))

  const moveNotaToCol = (id: string, col: Column) =>
    update(notas.map(n => n.id === id ? { ...n, column: col } : n))

  const saveNota = (id: string, text: string) =>
    update(notas.map(n => n.id === id ? { ...n, text } : n))

  const handleDrop = (col: Column) => {
    if (draggingId) moveNotaToCol(draggingId, col)
    setDraggingId(null)
    setDragOverCol(null)
  }

  if (!open) return null

  const total = notas.length

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[3px]"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="fixed z-50 inset-x-4 top-5 bottom-5 max-w-[920px] mx-auto flex flex-col rounded-2xl overflow-hidden shadow-2xl"
        style={{ boxShadow: '0 25px 80px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.06)' }}
      >
        {/* Header gradient bar */}
        <div className="h-[3px] shrink-0 bg-gradient-to-r from-violet-500 via-blue-500 to-emerald-500" />

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-white dark:bg-[#141414] border-b border-gray-100 dark:border-white/[0.05] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-sm shadow-violet-500/30">
              <StickyNote size={14} className="text-white" />
            </div>
            <div>
              <h2 className="font-semibold text-[15px] text-gray-900 dark:text-white leading-none">Notas</h2>
              <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
                {total} tarjeta{total !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/[0.07] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Columns */}
        <div className="flex-1 overflow-hidden flex gap-4 p-5 bg-gray-50 dark:bg-[#111111]">
          {COLS.map(col => {
            const cards = notas.filter(n => n.column === col.key)
            const isOver = dragOverCol === col.key && draggingId !== null

            return (
              <div
                key={col.key}
                className="flex-1 min-w-0 flex flex-col"
                onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverCol(col.key) }}
                onDragLeave={e => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverCol(null)
                }}
                onDrop={e => { e.preventDefault(); handleDrop(col.key) }}
              >
                {/* Column header */}
                <div className="flex items-center gap-2.5 mb-3 px-1">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ background: col.accent, boxShadow: `0 0 6px ${col.accent}60` }}
                  />
                  <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-[0.08em]">
                    {col.label}
                  </span>
                  {cards.length > 0 && (
                    <span
                      className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full tabular-nums"
                      style={{ background: `${col.accent}20`, color: col.accent }}
                    >
                      {cards.length}
                    </span>
                  )}
                </div>

                {/* Drop zone + cards */}
                <div
                  className={`flex-1 overflow-y-auto rounded-xl transition-all duration-150 p-2 space-y-2.5
                    ${isOver
                      ? `${col.dropBg} ring-2 ${col.ring}`
                      : col.bg
                    }`}
                >
                  {cards.map(nota => {
                    const colCfg = COLS.find(c => c.key === nota.column)!
                    return (
                      <NoteCard
                        key={nota.id}
                        nota={nota}
                        colConfig={colCfg}
                        isDragging={draggingId === nota.id}
                        onDragStart={() => setDraggingId(nota.id)}
                        onDragEnd={() => { setDraggingId(null); setDragOverCol(null) }}
                        onDelete={() => deleteNota(nota.id)}
                        onMove={dir => moveNota(nota.id, dir)}
                        onSave={text => saveNota(nota.id, text)}
                      />
                    )
                  })}

                  {/* Drop indicator when dragging over empty / bottom of column */}
                  {isOver && draggingId && (
                    <div
                      className="h-1 rounded-full opacity-60 transition-all"
                      style={{ background: col.accent }}
                    />
                  )}

                  {/* Add card */}
                  {adding === col.key ? (
                    <AddCard
                      onAdd={text => addNota(col.key, text)}
                      onCancel={() => setAdding(null)}
                    />
                  ) : (
                    <button
                      onClick={() => setAdding(col.key)}
                      className="w-full flex items-center gap-1.5 text-[12px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 px-2 py-2.5 rounded-xl hover:bg-white/60 dark:hover:bg-white/[0.04] transition-all group"
                    >
                      <Plus size={13} className="group-hover:scale-110 transition-transform" />
                      Agregar nota
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}
