import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getWorkspaceCtx } from '@/lib/workspace'

export const dynamic = 'force-dynamic'

function sb() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)
}

function errMsg(err: unknown): string {
  if (err instanceof Error) return err.message
  if (err && typeof err === 'object' && 'message' in err) return String((err as { message: unknown }).message)
  return JSON.stringify(err)
}

export async function GET() {
  try {
    const ctx = await getWorkspaceCtx()
    const base = sb().from('onboarding_clients').select('*').order('created_at', { ascending: false })

    if (ctx.isSuperAdmin) {
      // Admin sees all — no workspace filter
      const { data, error } = await base
      if (error) throw error
      return NextResponse.json(data ?? [])
    }

    // Non-admin: use workspace_id as the primary visibility scope.
    // All users in the same workspace see ALL onboarding entries from that workspace.
    // This fixes the persistence issue for editors: entries are always visible to
    // anyone in the same workspace, not just the creator.
    if (ctx.workspaceId) {
      const { data, error } = await base.eq('workspace_id', ctx.workspaceId)
      if (error) throw error

      // Also include legacy entries (no workspace_id) that are assigned to this user.
      if (ctx.assignedClients && ctx.assignedClients.length > 0) {
        const { data: extra } = await sb()
          .from('onboarding_clients')
          .select('*')
          .is('workspace_id', null)
          .in('name', ctx.assignedClients)
          .order('created_at', { ascending: false })
        const existingIds = new Set((data ?? []).map((c: { id: string }) => c.id))
        const merged = [
          ...(data ?? []),
          ...(extra ?? []).filter((c: { id: string }) => !existingIds.has(c.id)),
        ]
        return NextResponse.json(merged)
      }

      return NextResponse.json(data ?? [])
    }

    // Fallback for users without a workspace: filter by assigned client names.
    if (ctx.assignedClients === null || ctx.assignedClients.length === 0) {
      return NextResponse.json([])
    }
    const { data, error } = await base.in('name', ctx.assignedClients)
    if (error) throw error
    return NextResponse.json(data ?? [])
  } catch (err) {
    return NextResponse.json({ error: errMsg(err) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await getWorkspaceCtx()
    const { name, platform, website } = await req.json()
    if (!name?.trim()) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 })

    const payload: Record<string, unknown> = {
      name:      name.trim(),
      platform:  platform ?? 'meta',
      website:   website?.trim() || null,
      checklist: {},
    }
    if (ctx.workspaceId) payload.workspace_id = ctx.workspaceId

    const { data, error } = await sb()
      .from('onboarding_clients')
      .insert(payload)
      .select()
      .single()

    if (error) throw error

    // Non-admin creators: auto-assign the new client to themselves so it survives reload.
    // (GET filters by user_client_assignments for non-admins — without this the newly
    // created client disappears on the next page load.)
    if (!ctx.isSuperAdmin && ctx.userId && data?.name) {
      await sb()
        .from('user_client_assignments')
        .upsert(
          { user_id: ctx.userId, client_name: data.name },
          { onConflict: 'user_id,client_name' }
        )
    }

    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: errMsg(err) }, { status: 500 })
  }
}
