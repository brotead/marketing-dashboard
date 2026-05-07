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
      const q = ctx.workspaceId ? base.eq('workspace_id', ctx.workspaceId) : base
      const { data, error } = await q
      if (error) throw error
      return NextResponse.json(data ?? [])
    }

    // Non-admin: filter by assigned client names (onboarding_clients.name = budgets.client_name)
    if (ctx.assignedClients === null) {
      // Table missing — degrade to workspace scope or deny
      if (ctx.workspaceId) {
        const { data, error } = await base.eq('workspace_id', ctx.workspaceId)
        if (error) throw error
        return NextResponse.json(data ?? [])
      }
      return NextResponse.json([])
    }
    if (ctx.assignedClients.length === 0) return NextResponse.json([])

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
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: errMsg(err) }, { status: 500 })
  }
}
