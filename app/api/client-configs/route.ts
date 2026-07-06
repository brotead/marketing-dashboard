import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getWorkspaceCtx } from '@/lib/workspace'

export const dynamic = 'force-dynamic'

const EXCLUDED_EMAILS = ['brotead@gmail.com']

// GET /api/client-configs → { configs: Record<string, string> }
// Derives responsable from user_client_assignments + profiles.
export async function GET() {
  try {
    const ctx = await getWorkspaceCtx()
    if (!ctx.userId) return NextResponse.json({ configs: {} })

    // 1. All profiles in this workspace, excluding catch-all admin accounts
    let profilesQuery = supabase
      .from('profiles')
      .select('id, name, email')
      .not('email', 'in', `(${EXCLUDED_EMAILS.join(',')})`)

    if (ctx.workspaceId) {
      profilesQuery = profilesQuery.eq('workspace_id', ctx.workspaceId)
    }

    const { data: profiles, error: pErr } = await profilesQuery
    if (pErr || !profiles?.length) return NextResponse.json({ configs: {} })

    const profileMap = new Map<string, string>(
      profiles.map(p => [p.id as string, ((p.name || p.email) as string)])
    )
    const userIds = profiles.map(p => p.id as string)

    // 2. All client assignments for those users
    const { data: assignments, error: aErr } = await supabase
      .from('user_client_assignments')
      .select('user_id, client_name')
      .in('user_id', userIds)

    if (aErr?.code === '42P01') return NextResponse.json({ configs: {} })
    if (aErr) return NextResponse.json({ configs: {} })

    // First non-excluded user per client wins
    const configs: Record<string, string> = {}
    for (const a of assignments ?? []) {
      if (!a.client_name || configs[a.client_name]) continue
      const name = profileMap.get(a.user_id)
      if (name) configs[a.client_name] = name
    }

    return NextResponse.json({ configs })
  } catch {
    return NextResponse.json({ configs: {} })
  }
}
