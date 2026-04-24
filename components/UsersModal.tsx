'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, Users, Shield, BookOpen, Pencil, Trash2, Ban, RefreshCw, Crown } from 'lucide-react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import type { Profile } from '@/contexts/AuthContext'
import { useAuth } from '@/contexts/AuthContext'

interface Props {
  onClose: () => void
}

const ROLE_LABELS: Record<Profile['role'], string> = {
  super_admin: 'Super Admin',
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

export default function UsersModal({ onClose }: Props) {
  const { profile: myProfile } = useAuth()
  const supabase = createSupabaseBrowser()

  const [users,   setUsers]   = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState<string | null>(null)

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
        <div className="max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="p-8 text-center text-sm text-gray-400">Cargando usuarios…</div>
          ) : users.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400">No hay usuarios registrados.</div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-[#1a1a1a]">
              {users.map(user => (
                <div key={user.id} className={`flex items-center gap-3 px-6 py-4 ${!user.active ? 'opacity-50' : ''}`}>
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

                  {/* Actions */}
                  {!isMe(user.id) && user.role !== 'super_admin' && (() => {
                    const isSuperAdmin = myProfile?.role === 'super_admin'
                    const isEditor     = myProfile?.role === 'editor'
                    // Editor can only promote readers → editor; super_admin can change any non-super role
                    const canChangeRole = isSuperAdmin || (isEditor && user.role === 'reader')
                    if (!canChangeRole && !isSuperAdmin) return null
                    return (
                      <div className="flex items-center gap-1 shrink-0">
                        {canChangeRole && (
                          <select
                            value={user.role}
                            disabled={saving === user.id}
                            onChange={e => changeRole(user.id, e.target.value as Profile['role'])}
                            className="text-[11px] bg-gray-50 dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#2a2a2a] rounded-lg px-2 py-1.5 text-gray-600 dark:text-gray-400 focus:outline-none focus:ring-1 focus:ring-violet-500/30 transition cursor-pointer"
                          >
                            <option value="editor">Editor</option>
                            <option value="reader">Lector</option>
                          </select>
                        )}

                        {isSuperAdmin && (
                          <>
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
                          </>
                        )}
                      </div>
                    )
                  })()}

                  {/* Shield icon for super_admin row */}
                  {user.role === 'super_admin' && !isMe(user.id) && (
                    <Shield size={14} className="text-violet-400 shrink-0" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 dark:border-[#1e1e1e] flex items-center justify-between">
          <p className="text-[11px] text-gray-400 dark:text-gray-600">
            {users.filter(u => u.active).length} usuario{users.filter(u => u.active).length !== 1 ? 's' : ''} activo{users.filter(u => u.active).length !== 1 ? 's' : ''}
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-[#2a2a2a] rounded-xl hover:bg-gray-50 dark:hover:bg-[#1a1a1a] transition"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
