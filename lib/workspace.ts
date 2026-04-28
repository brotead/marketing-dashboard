import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { supabase as adminClient } from './supabase'

export type WorkspaceCtx = {
  workspaceId: string | null
  isSuperAdmin: boolean
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
    if (!user) return { workspaceId: null, isSuperAdmin: false }

    const { data } = await adminClient
      .from('profiles')
      .select('workspace_id, role')
      .eq('id', user.id)
      .single()

    return {
      workspaceId: (data?.workspace_id as string | null) ?? null,
      isSuperAdmin: data?.role === 'super_admin',
    }
  } catch {
    return { workspaceId: null, isSuperAdmin: false }
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
