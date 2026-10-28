'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, Plus, ChevronLeft, ChevronRight, StickyNote, Trash2 } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

type Column = 'pendiente' | 'en_curso' | 'hecho'

interface Nota {
  id: string
  text: string
  column: Column
  createdAt: number
}

// ── Config ────────────────────────────────────────────────────────────────────

const COLS: { key: Column; label: string; dot: string }[] = [
  { key: 'pendiente', label: 'Pendiente', dot: 'bg-amber-400' },
  { key: 'en_curso',  label: 'En curso',  dot: 'bg-blue-500'  },
  { key: 'hecho',     label: 'Hecho',     dot: 'bg-emerald-500' },
]

const STORAGE_KEY = 'brotead_notas_v1'
const COL_KEYS: Column[] = ['pendiente', 'en_curso', 'hecho']

// ── Storage ───────────────────────────────────────────────────────────────────

function load(): Nota[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') } catch { return [] }
}
function save(n: Nota[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(n)) } catch {}
}

// ── Card ──────────────────────────────────────────────────────────────────────

function Card({
  nota, onDelete, onMove, onSave,
}: {
  nota: Nota
  onDelete: () => void
  onMove: (dir: -1 | 1) => void
  onSave: (text: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(nota.text)
  const colIdx = COL_KEYS.indexOf(nota.column)

  const commit = () => {
    const trimmed = draft.trim()
    if (!trimmed) { onDelete(); return }
    onSave(trimmed)
    setEditing(false)
  }

  return (
    <div className="group bg-white dark:bg-[#1c1c1c] border border-gray-200 dark:border-white/[0.07] rounded-xl p-3.5 shadow-sm transition-shadow hover:shadow-md">
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
          className="w-full text-[13px] text-gray-800 dark:text-gray-100 bg-transparent resize-none outline-none leading-relaxed"
        />
      ) : (
        <p
          className="text-[13px] text-gray-800 dark:text-gray-100 leading-relaxed whitespace-pre-wrap break-words cursor-text"
          onClick={() => { setDraft(nota.text); setEditing(true) }}
        >
          {nota.text}
        </p>
      )}

      {/* Actions — visible on hover */}
      <div className="flex items-center gap-0.5 mt-2.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onMove(-1)}
          disabled={colIdx === 0}
          title="Mover izquierda"
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/[0.07] transition-colors disabled:opacity-20 disabled:cursor-default"
        >
          <ChevronLeft size={13} />
        </button>
        <button
          onClick={() => onMove(1)}
          disabled={colIdx === COL_KEYS.length - 1}
          title="Mover derecha"
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/[0.07] transition-colors disabled:opacity-20 disabled:cursor-default"
        >
          <ChevronRight size={13} />
        </button>
        <div className="flex-1" />
        <button
          onClick={onDelete}
          title="Eliminar"
          className="p-1.5 rounded-lg text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  )
}

// ── Add-card input ────────────────────────────────────────────────────────────

function AddCard({ onAdd, onCancel }: { onAdd: (text: string) => void; onCancel: () => void }) {
  const [text, setText] = useState('')

  const submit = () => {
    const t = text.trim()
    if (!t) { onCancel(); return }
    onAdd(t)
  }

  return (
    <div className="bg-white dark:bg-[#1c1c1c] border border-blue-400/60 dark:border-blue-500/40 rounded-xl p-3.5 shadow-sm">
      <textarea
        autoFocus
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() }
          if (e.key === 'Escape') onCancel()
        }}
        placeholder="Escribí tu nota..."
        rows={3}
        className="w-full text-[13px] text-gray-800 dark:text-gray-100 bg-transparent resize-none outline-none leading-relaxed placeholder:text-gray-400 dark:placeholder:text-gray-600"
      />
      <div className="flex gap-2 mt-2.5">
        <button
          onClick={submit}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg transition-colors"
        >
          Guardar
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-xs font-medium rounded-lg hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors"
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}

// ── Main modal ────────────────────────────────────────────────────────────────

interface Props {
  open: boolean
  onClose: () => void
}

export default function NotasModal({ open, onClose }: Props) {
  const [notas, setNotas] = useState<Nota[]>([])
  const [adding, setAdding] = useState<Column | null>(null)

  useEffect(() => { setNotas(load()) }, [])

  const update = useCallback((next: Nota[]) => { setNotas(next); save(next) }, [])

  const addNota = (col: Column, text: string) => {
    update([...notas, { id: `${Date.now()}-${Math.random()}`, text, column: col, createdAt: Date.now() }])
    setAdding(null)
  }

  const deleteNota = (id: string) => update(notas.filter(n => n.id !== id))

  const moveNota = (id: string, dir: -1 | 1) => {
    update(notas.map(n => {
      if (n.id !== id) return n
      const idx = COL_KEYS.indexOf(n.column) + dir
      return idx < 0 || idx >= COL_KEYS.length ? n : { ...n, column: COL_KEYS[idx] }
    }))
  }

  const saveNota = (id: string, text: string) => update(notas.map(n => n.id === id ? { ...n, text } : n))

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed z-50 inset-x-4 top-6 bottom-6 max-w-[900px] mx-auto flex flex-col bg-white dark:bg-[#111111] rounded-2xl shadow-2xl border border-gray-200 dark:border-white/[0.07] overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-white/[0.06] shrink-0">
          <div className="flex items-center gap-2.5">
            <StickyNote size={15} className="text-gray-400" />
            <span className="font-semibold text-[15px] text-gray-900 dark:text-white">Notas</span>
            <span className="text-xs text-gray-400 dark:text-gray-600">
              {notas.length} tarjeta{notas.length !== 1 ? 's' : ''}
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Columns */}
        <div className="flex-1 overflow-hidden flex gap-3 p-5">
          {COLS.map(col => {
            const cards = notas.filter(n => n.column === col.key)
            const isAdding = adding === col.key

            return (
              <div key={col.key} className="flex-1 min-w-0 flex flex-col">

                {/* Column header */}
                <div className="flex items-center gap-2 mb-3 px-0.5">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${col.dot}`} />
                  <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
                    {col.label}
                  </span>
                  {cards.length > 0 && (
                    <span className="ml-auto text-[10px] font-bold text-gray-400 dark:text-gray-600 bg-gray-100 dark:bg-white/[0.05] rounded-full w-5 h-5 flex items-center justify-center">
                      {cards.length}
                    </span>
                  )}
                </div>

                {/* Cards list */}
                <div className="flex-1 overflow-y-auto space-y-2.5 pb-1 pr-0.5 scrollbar-thin">
                  {cards.map(nota => (
                    <Card
                      key={nota.id}
                      nota={nota}
                      onDelete={() => deleteNota(nota.id)}
                      onMove={dir => moveNota(nota.id, dir)}
                      onSave={text => saveNota(nota.id, text)}
                    />
                  ))}

                  {isAdding
                    ? <AddCard onAdd={text => addNota(col.key, text)} onCancel={() => setAdding(null)} />
                    : (
                      <button
                        onClick={() => { setAdding(col.key) }}
                        className="w-full flex items-center gap-1.5 text-[12px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 px-2 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors"
                      >
                        <Plus size={13} />
                        Agregar nota
                      </button>
                    )
                  }
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}
