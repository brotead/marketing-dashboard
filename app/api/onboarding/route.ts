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
    let query = sb().from('onboarding_clients').select('*').order('created_at', { ascending: false })
    if (ctx.workspaceId) {
      query = query.eq('workspace_id', ctx.workspaceId)
    } else if (!ctx.isSuperAdmin) {
      return NextResponse.json([])
    }
    const { data, error } = await query
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
