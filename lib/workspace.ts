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

    const { data: { user } } = await authClient.auth.getUser()
    if (!user) return { workspaceId: null, userId: null, role: null, isSuperAdmin: false, assignedClients: null }

    const { data } = await adminClient
      .from('profiles')
      .select('workspace_id, role, id')
      .eq('id', user.id)
      .single()

    const role = (data?.role ?? null) as WorkspaceCtx['role']
    const isSuperAdmin = role === 'super_admin'

    // Admins see all clients; non-admins only see their assigned clients
    let assignedClients: string[] | null = null
    if (!isSuperAdmin) {
      const { data: assignments, error: assignErr } = await adminClient
        .from('user_client_assignments')
        .select('client_name')
        .eq('user_id', user.id)

      if (assignErr?.code === '42P01') {
        // Table doesn't exist yet — degrade gracefully, show all clients
        assignedClients = null
      } else {
        assignedClients = (assignments ?? []).map((a: { client_name: string }) => a.client_name)
      }
    }

    return {
      workspaceId: (data?.workspace_id as string | null) ?? null,
      userId: user.id,
      role,
      isSuperAdmin,
      assignedClients,
    }
  } catch {
    return { workspaceId: null, userId: null, role: null, isSuperAdmin: false, assignedClients: null }
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
