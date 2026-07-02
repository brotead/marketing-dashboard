import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getWorkspaceCtx } from '@/lib/workspace'

export const dynamic = 'force-dynamic'

// GET /api/client-configs → { configs: Record<string, string> }
export async function GET() {
  try {
    const ctx = await getWorkspaceCtx()
    if (!ctx.userId) return NextResponse.json({ configs: {} })

    const { data, error } = await supabase
      .from('client_configs')
      .select('client_name, responsable')
      .or(
        ctx.workspaceId
          ? `workspace_id.eq.${ctx.workspaceId}`
          : 'workspace_id.is.null'
      )

    if (error?.code === '42P01') {
      // Table doesn't exist yet — return empty gracefully
      return NextResponse.json({ configs: {} })
    }
    if (error) return NextResponse.json({ configs: {} })

    const configs: Record<string, string> = {}
    for (const row of data ?? []) {
      if (row.client_name && row.responsable) {
        configs[row.client_name] = row.responsable
      }
    }
    return NextResponse.json({ configs })
  } catch {
    return NextResponse.json({ configs: {} })
  }
}

// PATCH /api/client-configs { client_name, responsable } → upsert
export async function PATCH(req: NextRequest) {
  try {
    const ctx = await getWorkspaceCtx()
    if (!ctx.isSuperAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { client_name, responsable } = await req.json()
    if (!client_name) return NextResponse.json({ error: 'client_name required' }, { status: 400 })

    const payload: Record<string, unknown> = { client_name, responsable: responsable || null }
    if (ctx.workspaceId) payload.workspace_id = ctx.workspaceId

    const { error } = await supabase
      .from('client_configs')
      .upsert(payload, { onConflict: 'client_name,workspace_id' })

    if (error?.code === '42P01') {
      return NextResponse.json({ error: 'Table not created yet. Run supabase_client_configs.sql first.' }, { status: 500 })
    }
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
