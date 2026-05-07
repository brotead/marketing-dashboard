'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  X, Users, Shield, BookOpen, Pencil, Trash2, Ban, RefreshCw,
  Crown, KeyRound, Eye, EyeOff, Check, UserCog, Loader2,
  AlertTriangle, Copy, Save, RotateCcw, CheckCircle2, Search,
} from 'lucide-react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import type { Profile } from '@/contexts/AuthContext'
import { useAuth } from '@/contexts/AuthContext'

interface Props { onClose: () => void }

// ── Role helpers ─────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<Profile['role'], string> = {
  super_admin: 'Administrador',
  editor: 'Editor',
  reader: 'Lector',
}
const ROLE_COLORS: Record<Profile['role'], string> = {
  super_admin: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
  editor:      'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  reader:      'text-blue-400 bg-blue-500/10 border-blue-500/20',
}
function RoleBadge({ role }: { role: Profile['role'] }) {
  const Icon = role === 'super_admin' ? Crown : role === 'editor' ? Pencil : BookOpen
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[10px] font-semibold ${ROLE_COLORS[role]}`}>
      <Icon size={9} />{ROLE_LABELS[role]}
    </span>
  )
}
function Avatar({ profile }: { profile: Profile }) {
  if (profile.avatar_url) return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={profile.avatar_url} alt={profile.name ?? ''} className="w-9 h-9 rounded-xl object-cover" />
  )
  const initials = (profile.name ?? profile.email).slice(0, 2).toUpperCase()
  const colors = ['from-violet-600 to-blue-600','from-emerald-600 to-teal-600','from-orange-500 to-red-500','from-pink-600 to-rose-600']
  const color = colors[profile.email.charCodeAt(0) % colors.length]
  return (
    <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
      {initials}
    </div>
  )
}

// ── Draft state types ─────────────────────────────────────────────────────────

interface AssignmentDraft {
  original: string[]   // loaded from DB
  current:  string[]   // current staged state
}
interface Draft {
  roles:       Record<string, Profile['role']>      // userId → staged role
  active:      Record<string, boolean>              // userId → staged active
  deletes:     Set<string>                          // userIds staged for deletion
  assignments: Record<string, AssignmentDraft>      // userId → assignment draft
}
function emptyDraft(): Draft {
  return { roles: {}, active: {}, deletes: new Set(), assignments: {} }
}

// ── SQL for table creation ────────────────────────────────────────────────────

const SETUP_SQL = `CREATE TABLE IF NOT EXISTS user_client_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, client_name)
);`

// ── Component ─────────────────────────────────────────────────────────────────

export default function UsersModal({ onClose }: Props) {
  const { profile: myProfile } = useAuth()
  const supabase = createSupabaseBrowser()
  const isSuperAdmin = myProfile?.role === 'super_admin'

  // ── Core state ──────────────────────────────────────────────────────────────
  const [users,       setUsers]       = useState<Profile[]>([])
  const [loading,     setLoading]     = useState(true)
  const [draft,       setDraft]       = useState<Draft>(emptyDraft)
  const [saving,      setSaving]      = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // ── Assignment panel state ───────────────────────────────────────────────────
  const [assigningUserId, setAssigningUserId] = useState<string | null>(null)
  const [allClients,      setAllClients]      = useState<string[]>([])
  const [assignLoading,   setAssignLoading]   = useState(false)
  const [tableExists,     setTableExists]     = useState(true)
  const [clientSearch,    setClientSearch]    = useState('')

  // ── Password change state ────────────────────────────────────────────────────
  const [changingPwId, setChangingPwId] = useState<string | null>(null)
  const [newPw,        setNewPw]        = useState('')
  const [confirmPw,    setConfirmPw]    = useState('')
  const [showNewPw,    setShowNewPw]    = useState(false)
  const [showConfirm,  setShowConfirm]  = useState(false)
  const [pwSaving,     setPwSaving]     = useState(false)
  const [pwError,      setPwError]      = useState('')
  const [pwSuccess,    setPwSuccess]    = useState(false)

  // ── Setup state ──────────────────────────────────────────────────────────────
  const [setupRunning, setSetupRunning] = useState(false)
  const [setupResults, setSetupResults] = useState<string[] | null>(null)
  const [setupSql,     setSetupSql]     = useState<string | null>(null)
  const [sqlCopied,    setSqlCopied]    = useState(false)

  // ── Pending count ─────────────────────────────────────────────────────────────
  const pendingCount = useMemo(() => {
    let n = 0
    n += draft.deletes.size
    n += Object.keys(draft.roles).length
    n += Object.keys(draft.active).length
    for (const [uid, asgn] of Object.entries(draft.assignments)) {
      if (draft.deletes.has(uid)) continue
      const added   = asgn.current.filter(c => !asgn.original.includes(c)).length
      const removed = asgn.original.filter(c => !asgn.current.includes(c)).length
      if (added + removed > 0) n++
    }
    return n
  }, [draft])

  // ── Load users ────────────────────────────────────────────────────────────────
  const fetchUsers = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: true })
    if (data) setUsers(data as Profile[])
    setLoading(false)
  }, [supabase])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  // ── Draft helpers ─────────────────────────────────────────────────────────────
  function stageRole(uid: string, newRole: Profile['role']) {
    const original = users.find(u => u.id === uid)?.role
    setDraft(prev => {
      const roles = { ...prev.roles }
      if (newRole === original) delete roles[uid]
      else roles[uid] = newRole
      return { ...prev, roles }
    })
  }

  function stageActive(uid: string) {
    const original = users.find(u => u.id === uid)?.active ?? true
    const currentActive = draft.active[uid] ?? original
    const next = !currentActive
    setDraft(prev => {
      const active = { ...prev.active }
      if (next === original) delete active[uid]
      else active[uid] = next
      return { ...prev, active }
    })
  }

  function stageDelete(uid: string) {
    setDraft(prev => {
      const deletes = new Set(prev.deletes)
      if (deletes.has(uid)) deletes.delete(uid)
      else deletes.add(uid)
      return { ...prev, deletes }
    })
    // If this user's assignment panel is open, close it
    if (assigningUserId === uid) setAssigningUserId(null)
  }

  function toggleClientInDraft(uid: string, clientName: string) {
    setDraft(prev => {
      const asgn = prev.assignments[uid]
      if (!asgn) return prev
      const isAssigned = asgn.current.includes(clientName)
      const newCurrent = isAssigned
        ? asgn.current.filter(c => c !== clientName)
        : [...asgn.current, clientName]
      return { ...prev, assignments: { ...prev.assignments, [uid]: { ...asgn, current: newCurrent } } }
    })
  }

  function discardDraft() {
    setDraft(emptyDraft())
    setAssigningUserId(null)
    setClientSearch('')
  }

  // ── Open assignment panel ─────────────────────────────────────────────────────
  async function openAssignPanel(uid: string) {
    if (assigningUserId === uid) { setAssigningUserId(null); return }
    setAssigningUserId(uid)
    setClientSearch('')

    // Already loaded this user's assignments into draft
    if (draft.assignments[uid]) return

    setAssignLoading(true)
    try {
      const [allRes, userRes] = await Promise.all([
        fetch('/api/user-clients').then(r => r.json()),
        fetch(`/api/user-clients?userId=${uid}`).then(r => r.json()),
      ])
      setAllClients(allRes.clients ?? [])
      if (userRes.tableExists === false) {
        setTableExists(false)
      } else {
        setTableExists(true)
        const assigned: string[] = userRes.clients ?? []
        setDraft(prev => ({
          ...prev,
          assignments: { ...prev.assignments, [uid]: { original: assigned, current: [...assigned] } }
        }))
      }
    } finally {
      setAssignLoading(false)
    }
  }

  // ── Save all pending changes ───────────────────────────────────────────────────
  async function saveAll() {
    setSaving(true)
    setSaveSuccess(false)

    const ops: Promise<Response>[] = []

    // Deletes
    for (const uid of draft.deletes) {
      ops.push(fetch('/api/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid }),
      }))
    }

    // Wait for deletes first, then role/active changes
    await Promise.all(ops)
    const patchOps: Promise<Response>[] = []

    for (const [uid, role] of Object.entries(draft.roles)) {
      if (draft.deletes.has(uid)) continue
      patchOps.push(fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid, role }),
      }))
    }
    for (const [uid, active] of Object.entries(draft.active)) {
      if (draft.deletes.has(uid)) continue
      patchOps.push(fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid, active }),
      }))
    }

    // Assignment changes
    for (const [uid, asgn] of Object.entries(draft.assignments)) {
      if (draft.deletes.has(uid)) continue
      const toAdd    = asgn.current.filter(c => !asgn.original.includes(c))
      const toRemove = asgn.original.filter(c => !asgn.current.includes(c))
      for (const clientName of toAdd) {
        patchOps.push(fetch('/api/user-clients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: uid, clientName }),
        }))
      }
      for (const clientName of toRemove) {
        patchOps.push(fetch('/api/user-clients', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: uid, clientName }),
        }))
      }
    }

    await Promise.all(patchOps)

    setDraft(emptyDraft())
    setAssigningUserId(null)
    await fetchUsers()
    setSaving(false)
    setSaveSuccess(true)
    setTimeout(() => setSaveSuccess(false), 3000)
  }

  // ── Password change ───────────────────────────────────────────────────────────
  function openChangePw(uid: string) {
    setChangingPwId(uid); setNewPw(''); setConfirmPw('')
    setShowNewPw(false); setShowConfirm(false); setPwError(''); setPwSuccess(false)
  }
  async function submitChangePassword() {
    if (newPw.length < 6)  { setPwError('Mínimo 6 caracteres.'); return }
    if (newPw !== confirmPw) { setPwError('Las contraseñas no coinciden.'); return }
    setPwSaving(true); setPwError('')
    const { error } = await supabase.auth.updateUser({ password: newPw })
    setPwSaving(false)
    if (error) { setPwError(error.message); return }
    setPwSuccess(true)
    setTimeout(() => { setChangingPwId(null); setNewPw(''); setConfirmPw(''); setPwSuccess(false) }, 1500)
  }

  // ── Setup inicial ─────────────────────────────────────────────────────────────
  async function runSetup() {
    setSetupRunning(true); setSetupResults(null); setSetupSql(null)
    const res  = await fetch('/api/setup', { method: 'POST' })
    const json = await res.json()
    setSetupResults(json.results ?? [])
    if (json.needsSql) setSetupSql(json.sql ?? SETUP_SQL)
    else { setTableExists(true); fetchUsers() }
    setSetupRunning(false)
  }
  function copySql() {
    navigator.clipboard.writeText(setupSql ?? SETUP_SQL)
    setSqlCopied(true); setTimeout(() => setSqlCopied(false), 2000)
  }

  const isMe = (uid: string) => uid === myProfile?.id

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-xl bg-white dark:bg-[#111] border border-gray-200 dark:border-[#222] rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        style={{ maxHeight: '90vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 dark:border-[#1e1e1e] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center shrink-0">
              <Users size={15} className="text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">Usuarios y permisos</h2>
              <p className="text-[11px] text-gray-400 dark:text-gray-500">Gestioná accesos del equipo</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchUsers} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#1e1e1e] transition">
              <RefreshCw size={13} />
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#1e1e1e] transition">
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Pending changes banner */}
        {pendingCount > 0 && (
          <div className="mx-6 mt-4 shrink-0 flex items-center gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/25 rounded-xl text-xs text-amber-400 font-medium">
            <AlertTriangle size={12} className="shrink-0" />
            <span className="flex-1">{pendingCount} cambio{pendingCount !== 1 ? 's' : ''} sin guardar</span>
          </div>
        )}

        {/* User list */}
        <div className="overflow-y-auto flex-1 min-h-0">
          {loading ? (
            <div className="p-8 text-center text-sm text-gray-400">Cargando usuarios…</div>
          ) : users.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400">No hay usuarios registrados.</div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-[#1a1a1a]">
              {users.map(user => {
                const isStagedDelete  = draft.deletes.has(user.id)
                const displayRole     = draft.roles[user.id] ?? user.role
                const displayActive   = draft.active[user.id] ?? user.active
                const asgn            = draft.assignments[user.id]
                const assignChanged   = asgn
                  ? asgn.current.filter(c => !asgn.original.includes(c)).length +
                    asgn.original.filter(c => !asgn.current.includes(c)).length
                  : 0

                return (
                  <div key={user.id} className={`transition-opacity ${(!displayActive || isStagedDelete) ? 'opacity-50' : ''}`}>
                    <div className={`flex items-center gap-3 px-6 py-4 ${isStagedDelete ? 'bg-red-500/5' : ''}`}>
                      <Avatar profile={user} />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                          <p className={`text-sm font-semibold text-gray-800 dark:text-gray-200 truncate ${isStagedDelete ? 'line-through text-red-400 dark:text-red-400' : ''}`}>
                            {user.name ?? user.email.split('@')[0]}
                          </p>
                          {isMe(user.id) && <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">(vos)</span>}
                          <RoleBadge role={displayRole} />
                          {isStagedDelete && (
                            <span className="text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded-lg font-medium">Pendiente de eliminar</span>
                          )}
                          {!displayActive && !isStagedDelete && (
                            <span className="text-[10px] text-gray-400 bg-gray-100 dark:bg-[#2a2a2a] border border-gray-200 dark:border-[#333] px-1.5 py-0.5 rounded-lg font-medium">Desactivado</span>
                          )}
                          {assignChanged > 0 && !isStagedDelete && (
                            <span className="text-[10px] text-blue-400 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded-lg font-medium">{assignChanged} asig. pendiente{assignChanged !== 1 ? 's' : ''}</span>
                          )}
                        </div>
                        <p className="text-[11px] text-gray-400 dark:text-gray-500 truncate">{user.email}</p>
                      </div>

                      {/* Own row: password change only */}
                      {isMe(user.id) && (
                        <button
                          onClick={() => changingPwId === user.id ? setChangingPwId(null) : openChangePw(user.id)}
                          title="Cambiar contraseña"
                          className={`p-1.5 rounded-lg transition shrink-0 ${changingPwId === user.id ? 'text-violet-400 bg-violet-500/10' : 'text-gray-400 hover:text-violet-400 hover:bg-violet-500/10'}`}
                        >
                          <KeyRound size={13} />
                        </button>
                      )}

                      {/* Admin controls for other non-admin users */}
                      {!isMe(user.id) && user.role !== 'super_admin' && isSuperAdmin && !isStagedDelete && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          {/* Assign clients — visible text button */}
                          <button
                            onClick={() => openAssignPanel(user.id)}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition border ${
                              assigningUserId === user.id
                                ? 'text-blue-400 bg-blue-500/15 border-blue-500/30'
                                : 'text-blue-400 bg-blue-500/5 border-blue-500/20 hover:bg-blue-500/15'
                            }`}
                          >
                            <UserCog size={12} />
                            Gestionar accesos
                          </button>
                          {/* Role dropdown */}
                          <select
                            value={displayRole}
                            onChange={e => stageRole(user.id, e.target.value as Profile['role'])}
                            className={`text-[11px] border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-violet-500/30 transition cursor-pointer ${
                              draft.roles[user.id]
                                ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-300 dark:border-amber-500/30 text-amber-700 dark:text-amber-400'
                                : 'bg-gray-50 dark:bg-[#1a1a1a] border-gray-200 dark:border-[#2a2a2a] text-gray-600 dark:text-gray-400'
                            }`}
                          >
                            <option value="editor">Editor</option>
                            <option value="reader">Lector</option>
                          </select>
                          {/* Toggle active */}
                          <button
                            onClick={() => stageActive(user.id)}
                            title={displayActive ? 'Marcar como inactivo' : 'Marcar como activo'}
                            className={`p-1.5 rounded-lg transition ${draft.active[user.id] !== undefined ? 'text-amber-500 bg-amber-500/10' : 'text-gray-400 hover:text-amber-500 hover:bg-amber-500/10'}`}
                          >
                            <Ban size={13} />
                          </button>
                          {/* Delete */}
                          <button
                            onClick={() => stageDelete(user.id)}
                            title="Eliminar usuario"
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-500/10 transition"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      )}

                      {/* Un-stage delete button */}
                      {!isMe(user.id) && isStagedDelete && isSuperAdmin && (
                        <button
                          onClick={() => stageDelete(user.id)}
                          title="Cancelar eliminación"
                          className="p-1.5 rounded-lg text-red-400 hover:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#1e1e1e] transition shrink-0"
                        >
                          <RotateCcw size={13} />
                        </button>
                      )}

                      {/* Admin badge — full access, no assignment panel needed */}
                      {user.role === 'super_admin' && !isMe(user.id) && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Shield size={12} className="text-violet-400" />
                          <span className="text-[10px] font-semibold text-violet-400 whitespace-nowrap">Acceso total</span>
                        </div>
                      )}
                    </div>

                    {/* Assignment panel */}
                    {assigningUserId === user.id && isSuperAdmin && !isStagedDelete && (
                      <div className="mx-6 mb-4 rounded-xl border border-blue-500/25 bg-[#0a0f1e] dark:bg-[#080d1a] overflow-hidden shadow-lg shadow-blue-950/30">
                        {/* Panel header */}
                        <div className="flex items-center justify-between px-4 py-3 bg-blue-600/10 border-b border-blue-500/20">
                          <div className="flex items-center gap-2">
                            <UserCog size={13} className="text-blue-400" />
                            <p className="text-xs font-bold text-blue-300">
                              Accesos de {user.name ?? user.email.split('@')[0]}
                            </p>
                          </div>
                          <button onClick={() => { setAssigningUserId(null); setClientSearch('') }} className="text-blue-400/50 hover:text-blue-300 transition p-0.5 rounded">
                            <X size={13} />
                          </button>
                        </div>

                        {assignLoading && !draft.assignments[user.id] ? (
                          <div className="flex items-center justify-center gap-2 py-6 text-xs text-gray-400">
                            <Loader2 size={13} className="animate-spin" /> Cargando clientes…
                          </div>
                        ) : !tableExists ? (
                          <div className="p-4">
                            <p className="text-xs text-amber-400 flex items-center gap-1.5 mb-1">
                              <AlertTriangle size={12} /> Tabla de asignaciones no existe.
                            </p>
                            <p className="text-[11px] text-gray-400">Ejecutá el Setup inicial primero.</p>
                          </div>
                        ) : allClients.length === 0 ? (
                          <div className="p-4 text-xs text-gray-400">No hay clientes en el sistema.</div>
                        ) : (
                          <>
                            {/* Search */}
                            <div className="px-3 pt-3 pb-2">
                              <div className="relative">
                                <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                                <input
                                  type="text"
                                  value={clientSearch}
                                  onChange={e => setClientSearch(e.target.value)}
                                  placeholder="Buscar cliente…"
                                  className="w-full pl-7 pr-3 py-1.5 text-[11px] bg-white/5 border border-white/10 rounded-lg text-gray-300 placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500/40 transition"
                                />
                              </div>
                            </div>
                            {/* Client list */}
                            <div className="px-3 pb-2 space-y-0.5 max-h-48 overflow-y-auto">
                              {allClients
                                .filter(c => !clientSearch || c.toLowerCase().includes(clientSearch.toLowerCase()))
                                .map(client => {
                                  const assigned = (draft.assignments[user.id]?.current ?? []).includes(client)
                                  const wasAssigned = (draft.assignments[user.id]?.original ?? []).includes(client)
                                  const changed = assigned !== wasAssigned
                                  return (
                                    <label key={client} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-white/5 cursor-pointer transition group">
                                      <div className={`w-4 h-4 rounded flex items-center justify-center border transition shrink-0 ${
                                        assigned ? 'bg-blue-600 border-blue-600' : 'border-gray-600 group-hover:border-blue-400'
                                      }`}>
                                        {assigned && <Check size={9} className="text-white" />}
                                      </div>
                                      <input type="checkbox" className="sr-only" checked={assigned} onChange={() => toggleClientInDraft(user.id, client)} />
                                      <span className={`text-xs flex-1 truncate ${changed ? 'font-semibold' : ''} ${assigned ? 'text-gray-100' : 'text-gray-500'}`}>
                                        {client}
                                      </span>
                                      {changed && (
                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0 ${assigned ? 'text-emerald-400 bg-emerald-500/15' : 'text-red-400 bg-red-500/15'}`}>
                                          {assigned ? '+' : '−'}
                                        </span>
                                      )}
                                    </label>
                                  )
                                })}
                              {clientSearch && !allClients.some(c => c.toLowerCase().includes(clientSearch.toLowerCase())) && (
                                <p className="py-3 text-center text-[11px] text-gray-500">Sin resultados</p>
                              )}
                            </div>
                          </>
                        )}

                        {/* Panel footer */}
                        <div className="px-4 py-2.5 border-t border-blue-500/15 flex items-center justify-between">
                          <span className="text-[11px] text-gray-500">
                            {(draft.assignments[user.id]?.current ?? []).length} / {allClients.length} asignado(s)
                          </span>
                          {assignChanged > 0 && (
                            <span className="text-[11px] text-amber-400 font-semibold">{assignChanged} cambio{assignChanged !== 1 ? 's' : ''} pendiente{assignChanged !== 1 ? 's' : ''} · guardar abajo</span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Password change form */}
                    {changingPwId === user.id && (
                      <div className="mx-6 mb-4 p-4 bg-gray-50 dark:bg-[#161616] border border-gray-200 dark:border-[#252525] rounded-xl">
                        <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-3">Cambiar contraseña</p>
                        <div className="space-y-2">
                          <div className="relative">
                            <input type={showNewPw ? 'text' : 'password'} value={newPw}
                              onChange={e => { setNewPw(e.target.value); setPwError('') }}
                              placeholder="Nueva contraseña (mín. 6 caracteres)"
                              className="w-full pr-9 pl-3 py-2 text-xs bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#2a2a2a] rounded-lg text-gray-700 dark:text-gray-300 placeholder:text-gray-400 dark:placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-violet-500/40 transition"
                            />
                            <button type="button" onClick={() => setShowNewPw(v => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition">
                              {showNewPw ? <EyeOff size={12} /> : <Eye size={12} />}
                            </button>
                          </div>
                          <div className="relative">
                            <input type={showConfirm ? 'text' : 'password'} value={confirmPw}
                              onChange={e => { setConfirmPw(e.target.value); setPwError('') }}
                              placeholder="Repetir nueva contraseña"
                              onKeyDown={e => e.key === 'Enter' && submitChangePassword()}
                              className="w-full pr-9 pl-3 py-2 text-xs bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#2a2a2a] rounded-lg text-gray-700 dark:text-gray-300 placeholder:text-gray-400 dark:placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-violet-500/40 transition"
                            />
                            <button type="button" onClick={() => setShowConfirm(v => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition">
                              {showConfirm ? <EyeOff size={12} /> : <Eye size={12} />}
                            </button>
                          </div>
                        </div>
                        {pwError && <p className="mt-2 text-[11px] text-red-400">{pwError}</p>}
                        {pwSuccess && <p className="mt-2 text-[11px] text-emerald-400 flex items-center gap-1"><Check size={11} /> Contraseña actualizada.</p>}
                        <div className="flex items-center gap-2 mt-3">
                          <button onClick={submitChangePassword} disabled={pwSaving || !newPw || !confirmPw}
                            className="flex-1 py-1.5 text-xs font-semibold bg-gradient-to-r from-violet-600 to-blue-600 text-white rounded-lg hover:from-violet-700 hover:to-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition">
                            {pwSaving ? 'Guardando…' : 'Guardar contraseña'}
                          </button>
                          <button onClick={() => setChangingPwId(null)}
                            className="px-3 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-[#2a2a2a] rounded-lg hover:bg-gray-100 dark:hover:bg-[#1e1e1e] transition">
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Setup results */}
        {setupResults && (
          <div className="mx-6 mt-3 shrink-0 rounded-xl border border-gray-200 dark:border-[#2a2a2a] bg-gray-50 dark:bg-[#161616] p-4">
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Resultado del setup:</p>
            <ul className="space-y-1">
              {setupResults.map((r, i) => <li key={i} className="text-[11px] text-gray-600 dark:text-gray-400">{r}</li>)}
            </ul>
            {setupSql && (
              <div className="mt-3">
                <p className="text-[11px] text-amber-400 font-semibold mb-1.5">Ejecutá en Supabase → SQL Editor:</p>
                <div className="relative">
                  <pre className="text-[10px] bg-gray-900 text-emerald-400 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">{setupSql}</pre>
                  <button onClick={copySql} className="absolute top-2 right-2 p-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 transition" title="Copiar SQL">
                    {sqlCopied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                  </button>
                </div>
                <p className="text-[10px] text-gray-500 mt-1.5">Después ejecutá "Setup inicial" de nuevo.</p>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 dark:border-[#1e1e1e] shrink-0 flex items-center justify-between gap-3">
          <p className="text-[11px] text-gray-400 dark:text-gray-600 shrink-0">
            {users.filter(u => u.active).length} activo{users.filter(u => u.active).length !== 1 ? 's' : ''}
          </p>

          <div className="flex items-center gap-2 flex-wrap justify-end">
            {/* Success feedback */}
            {saveSuccess && (
              <span className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-medium">
                <CheckCircle2 size={12} /> Guardado
              </span>
            )}

            {/* Pending changes controls */}
            {pendingCount > 0 && !saving && (
              <button onClick={discardDraft} title="Descartar cambios"
                className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-[#2a2a2a] rounded-xl hover:bg-gray-50 dark:hover:bg-[#1a1a1a] transition">
                <RotateCcw size={11} /> Descartar
              </button>
            )}
            {pendingCount > 0 && (
              <button onClick={saveAll} disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm">
                {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                {saving ? 'Guardando…' : `Guardar cambios${pendingCount > 0 ? ` (${pendingCount})` : ''}`}
              </button>
            )}

            {isSuperAdmin && (
              <button onClick={runSetup} disabled={setupRunning}
                title="Setup inicial: crear admin brotead, actualizar fdiaz, asignar clientes"
                className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-violet-400 border border-violet-500/30 bg-violet-500/5 hover:bg-violet-500/10 rounded-xl disabled:opacity-50 transition">
                {setupRunning ? <Loader2 size={11} className="animate-spin" /> : <UserCog size={11} />}
                Setup inicial
              </button>
            )}

            <button onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-[#2a2a2a] rounded-xl hover:bg-gray-50 dark:hover:bg-[#1a1a1a] transition">
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
