'use client'

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { createSupabaseBrowser } from '@/lib/supabase-browser'

export interface Profile {
  id: string
  email: string
  name: string | null
  avatar_url: string | null
  role: 'editor' | 'reader' | 'super_admin'
  active: boolean
  role_selected: boolean
  created_at: string
}

interface AuthContextValue {
  user: User | null
  profile: Profile | null
  role: 'editor' | 'reader' | 'super_admin' | null
  canEdit: boolean
  isSuperAdmin: boolean
  loading: boolean
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  profile: null,
  role: null,
  canEdit: false,
  isSuperAdmin: false,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,    setUser]    = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const supabase = createSupabaseBrowser()

  const loadProfile = useCallback(async (uid: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', uid)
      .single()
    if (data) setProfile(data as Profile)
  }, [supabase])

  const refreshProfile = useCallback(async () => {
    if (user) await loadProfile(user.id)
  }, [user, loadProfile])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) loadProfile(session.user.id).finally(() => setLoading(false))
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        loadProfile(session.user.id)
      } else {
        setProfile(null)
      }
    })

    return () => subscription.unsubscribe()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
  }

  const role        = profile?.role ?? null
  const canEdit     = role === 'editor' || role === 'super_admin'
  const isSuperAdmin = role === 'super_admin'

  return (
    <AuthContext.Provider value={{ user, profile, role, canEdit, isSuperAdmin, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
