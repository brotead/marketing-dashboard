import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceCtx } from '@/lib/workspace'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  const ctx = await getWorkspaceCtx()
  let query = supabase.from('excluded_campaigns').select('account_id, source, campaign_name_norm')
  if (ctx.workspaceId) {
    query = query.eq('workspace_id', ctx.workspaceId)
  } else if (!ctx.isSuperAdmin) {
    return NextResponse.json([])
  }
  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [], { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(req: NextRequest) {
  const ctx = await getWorkspaceCtx()
  const { account_id, source, campaign_name, campaign_name_norm } = await req.json()
  const payload: Record<string, unknown> = { account_id, source, campaign_name, campaign_name_norm }
  if (ctx.workspaceId) payload.workspace_id = ctx.workspaceId
  const { error } = await supabase.from('excluded_campaigns').upsert(payload, {
    onConflict: 'workspace_id,account_id,source,campaign_name_norm',
    ignoreDuplicates: true,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
