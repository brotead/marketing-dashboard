'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, Users, Shield, BookOpen, Pencil, Trash2, Ban, RefreshCw, Crown, KeyRound, Eye, EyeOff, Check, UserCog, ChevronDown, ChevronUp, Loader2, AlertTriangle, Copy } from 'lucide-react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import type { Profile } from '@/contexts/AuthContext'
import { useAuth } from '@/contexts/AuthContext'

interface Props {
  onClose: () => void
}

const ROLE_LABELS: Record<Profile['role'], string> = {
  super_admin: 'Administrador',
  editor: 'Editor',
  reader: 'Lector',
}

const ROLE_COLORS: Record<Profile['role'], string> = {
  super_admin: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
  editor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  reader: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
}

function RoleBadge({ role }: { role: Profile['role'] }) {
  const Icon = role === 'super_admin' ? Crown : role === 'editor' ? Pencil : BookOpen
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[10px] font-semibold ${ROLE_COLORS[role]}`}>
      <Icon size={9} />
      {ROLE_LABELS[role]}
    </span>
  )
}

function Avatar({ profile }: { profile: Profile }) {
  if (profile.avatar_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={profile.avatar_url} alt={profile.name ?? ''} className="w-9 h-9 rounded-xl object-cover" />
    )
  }
  const initials = (profile.name ?? profile.email).slice(0, 2).toUpperCase()
  const colors = ['from-violet-600 to-blue-600', 'from-emerald-600 to-teal-600', 'from-orange-500 to-red-500', 'from-pink-600 to-rose-600']
  const color = colors[profile.email.charCodeAt(0) % colors.length]
  return (
    <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
      {initials}
    </div>
  )
}

const SETUP_SQL = `CREATE TABLE IF NOT EXISTS user_client_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, client_name)
);`

export default function UsersModal({ onClose }: Props) {
  const { profile: myProfile } = useAuth()
  const supabase = createSupabaseBrowser()
  const isSuperAdmin = myProfile?.role === 'super_admin'

  const [users,        setUsers]        = useState<Profile[]>([])
  const [loading,      setLoading]      = useState(true)
  const [saving,       setSaving]       = useState<string | null>(null)
  const [changingPwId, setChangingPwId] = useState<string | null>(null)
  const [newPw,        setNewPw]        = useState('')
  const [confirmPw,    setConfirmPw]    = useState('')
  const [showNewPw,    setShowNewPw]    = useState(false)
  const [showConfirm,  setShowConfirm]  = useState(false)
  const [pwSaving,     setPwSaving]     = useState(false)
  const [pwError,      setPwError]      = useState('')
  const [pwSuccess,    setPwSuccess]    = useState(false)

  // Client assignment state
  const [assigningUserId,  setAssigningUserId]  = useState<string | null>(null)
  const [allClients,       setAllClients]       = useState<string[]>([])
  const [userAssignments,  setUserAssignments]  = useState<Record<string, string[]>>({})
  const [assignLoading,    setAssignLoading]    = useState(false)
  const [assignSaving,     setAssignSaving]     = useState<string | null>(null)
  const [tableExists,      setTableExists]      = useState(true)

  // Setup state
  const [setupRunning, setSetupRunning] = useState(false)
  const [setupResults, setSetupResults] = useState<string[] | null>(null)
  const [setupSql,     setSetupSql]     = useState<string | null>(null)
  const [sqlCopied,    setSqlCopied]    = useState(false)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: true })
    if (data) setUsers(data as Profile[])
    setLoading(false)
  }, [supabase])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  async function changeRole(uid: string, newRole: Profile['role']) {
    setSaving(uid)
    await supabase.from('profiles').update({ role: newRole }).eq('id', uid)
    setUsers(prev => prev.map(u => u.id === uid ? { ...u, role: newRole } : u))
    setSaving(null)
  }

  async function toggleActive(uid: string, active: boolean) {
    setSaving(uid)
    await supabase.from('profiles').update({ active: !active }).eq('id', uid)
    setUsers(prev => prev.map(u => u.id === uid ? { ...u, active: !active } : u))
    setSaving(null)
  }

  async function deleteUser(uid: string) {
    if (!confirm('¿Eliminar este usuario? Esta acción no se puede deshacer.')) return
    setSaving(uid)
    await supabase.from('profiles').delete().eq('id', uid)
    setUsers(prev => prev.filter(u => u.id !== uid))
    setSaving(null)
  }

  const isMe = (uid: string) => uid === myProfile?.id

  function openChangePw(uid: string) {
    setChangingPwId(uid); setNewPw(''); setConfirmPw('')
    setShowNewPw(false); setShowConfirm(false); setPwError(''); setPwSuccess(false)
  }

  async function submitChangePassword() {
    if (newPw.length < 6) { setPwError('Mínimo 6 caracteres.'); return }
    if (newPw !== confirmPw) { setPwError('Las contraseñas no coinciden.'); return }
    setPwSaving(true); setPwError('')
    const { error } = await supabase.auth.updateUser({ password: newPw })
    setPwSaving(false)
    if (error) { setPwError(error.message); return }
    setPwSuccess(true)
    setTimeout(() => { setChangingPwId(null); setNewPw(''); setConfirmPw(''); setPwSuccess(false) }, 1500)
  }

  // ── Client assignment ────────────────────────────────────────────────────────

  async function openAssignClients(uid: string) {
    if (assigningUserId === uid) { setAssigningUserId(null); return }
    setAssigningUserId(uid)
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
        setUserAssignments(prev => ({ ...prev, [uid]: userRes.clients ?? [] }))
      }
    } finally {
      setAssignLoading(false)
    }
  }

  async function toggleClientAssignment(uid: string, clientName: string) {
    const current = userAssignments[uid] ?? []
    const isAssigned = current.includes(clientName)
    const key = `${uid}:${clientName}`
    setAssignSaving(key)

    const method = isAssigned ? 'DELETE' : 'POST'
    await fetch('/api/user-clients', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: uid, clientName }),
    })

    setUserAssignments(prev => ({
      ...prev,
      [uid]: isAssigned
        ? current.filter(c => c !== clientName)
        : [...current, clientName],
    }))
    setAssignSaving(null)
  }

  // ── Setup inicial ────────────────────────────────────────────────────────────

  async function runSetup() {
    setSetupRunning(true)
    setSetupResults(null)
    setSetupSql(null)
    try {
      const res = await fetch('/api/setup', { method: 'POST' })
      const json = await res.json()
      setSetupResults(json.results ?? [])
      if (json.needsSql) setSetupSql(json.sql ?? SETUP_SQL)
      else { setTableExists(true); fetchUsers() }
    } finally {
      setSetupRunning(false)
    }
  }

  function copySql() {
    navigator.clipboard.writeText(setupSql ?? SETUP_SQL)
    setSqlCopied(true)
    setTimeout(() => setSqlCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg bg-white dark:bg-[#111] border border-gray-200 dark:border-[#222] rounded-2xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 dark:border-[#1e1e1e]">
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

        {/* User list */}
        <div className="max-h-[55vh] overflow-y-auto">
          {loading ? (
            <div className="p-8 text-center text-sm text-gray-400">Cargando usuarios…</div>
          ) : users.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400">No hay usuarios registrados.</div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-[#1a1a1a]">
              {users.map(user => (
                <div key={user.id} className={`${!user.active ? 'opacity-50' : ''}`}>
                  <div className="flex items-center gap-3 px-6 py-4">
                    <Avatar profile={user} />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">
                          {user.name ?? user.email.split('@')[0]}
                        </p>
                        {isMe(user.id) && (
                          <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">(vos)</span>
                        )}
                        <RoleBadge role={user.role} />
                        {!user.active && (
                          <span className="text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded-lg font-medium">Desactivado</span>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-400 dark:text-gray-500 truncate">{user.email}</p>
                    </div>

                    {/* Change password button — only own row */}
                    {isMe(user.id) && (
                      <button
                        onClick={() => changingPwId === user.id ? setChangingPwId(null) : openChangePw(user.id)}
                        title="Cambiar contraseña"
                        className={`p-1.5 rounded-lg transition shrink-0 ${
                          changingPwId === user.id
                            ? 'text-violet-400 bg-violet-500/10'
                            : 'text-gray-400 hover:text-violet-400 hover:bg-violet-500/10'
                        }`}
                      >
                        <KeyRound size={13} />
                      </button>
                    )}

                    {/* Actions — other non-admin users (admin-only) */}
                    {!isMe(user.id) && user.role !== 'super_admin' && isSuperAdmin && (
                      <div className="flex items-center gap-1 shrink-0">
                        {/* Assign clients button */}
                        <button
                          onClick={() => openAssignClients(user.id)}
                          title="Asignar clientes"
                          className={`p-1.5 rounded-lg transition ${
                            assigningUserId === user.id
                              ? 'text-blue-400 bg-blue-500/10'
                              : 'text-gray-400 hover:text-blue-400 hover:bg-blue-500/10'
                          }`}
                        >
                          <UserCog size={13} />
                        </button>

                        {/* Role selector */}
                        <select
                          value={user.role}
                          disabled={saving === user.id}
                          onChange={e => changeRole(user.id, e.target.value as Profile['role'])}
                          className="text-[11px] bg-gray-50 dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#2a2a2a] rounded-lg px-2 py-1.5 text-gray-600 dark:text-gray-400 focus:outline-none focus:ring-1 focus:ring-violet-500/30 transition cursor-pointer"
                        >
                          <option value="editor">Editor</option>
                          <option value="reader">Lector</option>
                        </select>

                        <button
                          onClick={() => toggleActive(user.id, user.active)}
                          disabled={saving === user.id}
                          title={user.active ? 'Desactivar acceso' : 'Reactivar acceso'}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-amber-500 hover:bg-amber-500/10 disabled:opacity-40 transition"
                        >
                          <Ban size={13} />
                        </button>
                        <button
                          onClick={() => deleteUser(user.id)}
                          disabled={saving === user.id}
                          title="Eliminar usuario"
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-500/10 disabled:opacity-40 transition"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}

                    {/* Shield icon for super_admin row (not own) */}
                    {user.role === 'super_admin' && !isMe(user.id) && (
                      <Shield size={14} className="text-violet-400 shrink-0" />
                    )}
                  </div>

                  {/* Inline client assignment panel */}
                  {assigningUserId === user.id && isSuperAdmin && (
                    <div className="mx-6 mb-4 rounded-xl border border-blue-500/20 bg-blue-500/5 overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-2.5 bg-blue-500/10 border-b border-blue-500/15">
                        <p className="text-xs font-semibold text-blue-400">Clientes asignados a {user.name ?? user.email.split('@')[0]}</p>
                        <button onClick={() => setAssigningUserId(null)} className="text-blue-400/60 hover:text-blue-400 transition">
                          <X size={12} />
                        </button>
                      </div>

                      {assignLoading ? (
                        <div className="flex items-center justify-center gap-2 py-5 text-xs text-gray-400">
                          <Loader2 size={13} className="animate-spin" /> Cargando clientes…
                        </div>
                      ) : !tableExists ? (
                        <div className="p-4">
                          <p className="text-xs text-amber-400 flex items-center gap-1.5 mb-2">
                            <AlertTriangle size={12} /> La tabla de asignaciones no existe aún.
                          </p>
                          <p className="text-[11px] text-gray-400">Ejecutá el setup inicial (botón de abajo) para habilitarla.</p>
                        </div>
                      ) : allClients.length === 0 ? (
                        <div className="p-4 text-xs text-gray-400">
                          No hay clientes cargados en el sistema.
                        </div>
                      ) : (
                        <div className="p-3 space-y-1 max-h-48 overflow-y-auto">
                          {allClients.map(client => {
                            const assigned = (userAssignments[user.id] ?? []).includes(client)
                            const key = `${user.id}:${client}`
                            const isSavingThis = assignSaving === key
                            return (
                              <label
                                key={client}
                                className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-white/5 cursor-pointer transition group"
                              >
                                <div className={`w-4 h-4 rounded flex items-center justify-center border transition shrink-0 ${
                                  assigned
                                    ? 'bg-blue-600 border-blue-600'
                                    : 'border-gray-300 dark:border-[#444] group-hover:border-blue-400'
                                }`}>
                                  {isSavingThis
                                    ? <Loader2 size={9} className="animate-spin text-white" />
                                    : assigned && <Check size={9} className="text-white" />}
                                </div>
                                <input
                                  type="checkbox"
                                  className="sr-only"
                                  checked={assigned}
                                  onChange={() => !isSavingThis && toggleClientAssignment(user.id, client)}
                                />
                                <span className="text-xs text-gray-700 dark:text-gray-300">{client}</span>
                              </label>
                            )
                          })}
                        </div>
                      )}

                      {tableExists && allClients.length > 0 && (
                        <div className="px-4 py-2 border-t border-blue-500/15 text-[11px] text-gray-400">
                          {(userAssignments[user.id] ?? []).length} de {allClients.length} cliente(s) asignado(s)
                        </div>
                      )}
                    </div>
                  )}

                  {/* Inline password change form */}
                  {changingPwId === user.id && (
                    <div className="mx-6 mb-4 p-4 bg-gray-50 dark:bg-[#161616] border border-gray-200 dark:border-[#252525] rounded-xl">
                      <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-3">Cambiar contraseña</p>
                      <div className="space-y-2">
                        <div className="relative">
                          <input
                            type={showNewPw ? 'text' : 'password'}
                            value={newPw}
                            onChange={e => { setNewPw(e.target.value); setPwError('') }}
                            placeholder="Nueva contraseña (mín. 6 caracteres)"
                            className="w-full pr-9 pl-3 py-2 text-xs bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#2a2a2a] rounded-lg text-gray-700 dark:text-gray-300 placeholder:text-gray-400 dark:placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-violet-500/40 transition"
                          />
                          <button type="button" onClick={() => setShowNewPw(v => !v)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition">
                            {showNewPw ? <EyeOff size={12} /> : <Eye size={12} />}
                          </button>
                        </div>
                        <div className="relative">
                          <input
                            type={showConfirm ? 'text' : 'password'}
                            value={confirmPw}
                            onChange={e => { setConfirmPw(e.target.value); setPwError('') }}
                            placeholder="Repetir nueva contraseña"
                            onKeyDown={e => e.key === 'Enter' && submitChangePassword()}
                            className="w-full pr-9 pl-3 py-2 text-xs bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#2a2a2a] rounded-lg text-gray-700 dark:text-gray-300 placeholder:text-gray-400 dark:placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-violet-500/40 transition"
                          />
                          <button type="button" onClick={() => setShowConfirm(v => !v)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition">
                            {showConfirm ? <EyeOff size={12} /> : <Eye size={12} />}
                          </button>
                        </div>
                      </div>

                      {pwError && (
                        <p className="mt-2 text-[11px] text-red-400">{pwError}</p>
                      )}
                      {pwSuccess && (
                        <p className="mt-2 text-[11px] text-emerald-400 flex items-center gap-1">
                          <Check size={11} /> Contraseña actualizada correctamente.
                        </p>
                      )}

                      <div className="flex items-center gap-2 mt-3">
                        <button
                          onClick={submitChangePassword}
                          disabled={pwSaving || !newPw || !confirmPw}
                          className="flex-1 py-1.5 text-xs font-semibold bg-gradient-to-r from-violet-600 to-blue-600 text-white rounded-lg hover:from-violet-700 hover:to-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
                        >
                          {pwSaving ? 'Guardando…' : 'Guardar contraseña'}
                        </button>
                        <button
                          onClick={() => setChangingPwId(null)}
                          className="px-3 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-[#2a2a2a] rounded-lg hover:bg-gray-100 dark:hover:bg-[#1e1e1e] transition"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Setup results panel */}
        {setupResults && (
          <div className="mx-6 mb-4 mt-2 rounded-xl border border-gray-200 dark:border-[#2a2a2a] bg-gray-50 dark:bg-[#161616] p-4">
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Resultado del setup:</p>
            <ul className="space-y-1">
              {setupResults.map((r, i) => (
                <li key={i} className="text-[11px] text-gray-600 dark:text-gray-400">{r}</li>
              ))}
            </ul>
            {setupSql && (
              <div className="mt-3">
                <p className="text-[11px] text-amber-400 font-semibold mb-1.5">Ejecutá este SQL en Supabase → SQL Editor:</p>
                <div className="relative">
                  <pre className="text-[10px] bg-gray-900 text-emerald-400 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">{setupSql}</pre>
                  <button
                    onClick={copySql}
                    className="absolute top-2 right-2 p-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 transition"
                    title="Copiar SQL"
                  >
                    {sqlCopied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                  </button>
                </div>
                <p className="text-[10px] text-gray-500 mt-1.5">Después de ejecutar el SQL, presioná "Setup inicial" nuevamente.</p>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 dark:border-[#1e1e1e] flex items-center justify-between gap-3">
          <p className="text-[11px] text-gray-400 dark:text-gray-600">
            {users.filter(u => u.active).length} usuario{users.filter(u => u.active).length !== 1 ? 's' : ''} activo{users.filter(u => u.active).length !== 1 ? 's' : ''}
          </p>
          <div className="flex items-center gap-2">
            {isSuperAdmin && (
              <button
                onClick={runSetup}
                disabled={setupRunning}
                title="Crear admin brotead@gmail.com, actualizar fdiaz a editor y asignar todos sus clientes"
                className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-violet-400 border border-violet-500/30 bg-violet-500/5 hover:bg-violet-500/10 rounded-xl disabled:opacity-50 transition"
              >
                {setupRunning ? <Loader2 size={11} className="animate-spin" /> : <UserCog size={11} />}
                Setup inicial
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-[#2a2a2a] rounded-xl hover:bg-gray-50 dark:hover:bg-[#1a1a1a] transition"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
