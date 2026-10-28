import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { supabase as adminClient } from './supabase'

export type WorkspaceCtx = {
  workspaceId: string | null
  userId: string | null
  role: 'super_admin' | 'editor' | 'reader' | null
  isSuperAdmin: boolean
  assignedClients: string[] | null  // null = see all (admin), [...] = filter to these only
}

const EMPTY_CTX: WorkspaceCtx = { workspaceId: null, userId: null, role: null, isSuperAdmin: false, assignedClients: null }

// Server-side cache: eliminates repeated auth/profile/assignment queries when
// multiple API routes are called in the same page load (e.g. 6 parallel prefetches).
const _ctxCache = new Map<string, { ctx: WorkspaceCtx; ts: number }>()
const CTX_TTL = 60_000

export async function getWorkspaceCtx(): Promise<WorkspaceCtx> {
  try {
    const cookieStore = cookies()
    const authClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll() {},
        },
      }
    )

    // Read session from cookie (no network call) — gives us user ID for cache lookup
    const { data: { session } } = await authClient.auth.getSession()
    const cachedId = session?.user?.id
    if (cachedId) {
      const hit = _ctxCache.get(cachedId)
      if (hit && Date.now() - hit.ts < CTX_TTL) return hit.ctx
    }

    // Cache miss — verify JWT with server (one network call)
    const { data: { user } } = await authClient.auth.getUser()
    if (!user) return EMPTY_CTX

    // Fetch profile + assignments in parallel (was sequential: 2 round-trips → 1)
    const [profileRes, assignRes] = await Promise.all([
      adminClient.from('profiles').select('workspace_id, role, id').eq('id', user.id).single(),
      adminClient.from('user_client_assignments').select('client_name').eq('user_id', user.id),
    ])

    const role = (profileRes.data?.role ?? null) as WorkspaceCtx['role']
    const isSuperAdmin = role === 'super_admin'

    let assignedClients: string[] | null = null
    if (!isSuperAdmin) {
      if (assignRes.error?.code === '42P01') {
        assignedClients = null  // table not created yet — degrade gracefully
      } else {
        assignedClients = (assignRes.data ?? []).map((a: { client_name: string }) => a.client_name)
      }
    }

    const ctx: WorkspaceCtx = {
      workspaceId: (profileRes.data?.workspace_id as string | null) ?? null,
      userId: user.id,
      role,
      isSuperAdmin,
      assignedClients,
    }
    _ctxCache.set(user.id, { ctx, ts: Date.now() })
    return ctx
  } catch {
    return EMPTY_CTX
  }
}

// Apply workspace filter to a Supabase query builder.
// Returns null if the user has no workspace and is not super_admin (→ caller returns []).
export function applyWorkspaceFilter<T extends { eq: (col: string, val: string) => T }>(
  query: T,
  ctx: WorkspaceCtx
): T | null {
  if (ctx.workspaceId) return query.eq('workspace_id', ctx.workspaceId)
  if (ctx.isSuperAdmin) return query   // transition period: no workspace yet, show all
  return null                          // unknown user → no data
}
