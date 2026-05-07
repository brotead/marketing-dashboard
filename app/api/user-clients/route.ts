import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getWorkspaceCtx } from '@/lib/workspace'

export const dynamic = 'force-dynamic'

// GET /api/user-clients             → all available client names (admin only)
// GET /api/user-clients?userId=...  → clients assigned to that user
export async function GET(req: NextRequest) {
  const ctx = await getWorkspaceCtx()
  if (!ctx.isSuperAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const userId = req.nextUrl.searchParams.get('userId')

  if (!userId) {
    // Return all unique client names across the workspace
    let query = supabase.from('budgets').select('client_name')
    if (ctx.workspaceId) query = query.eq('workspace_id', ctx.workspaceId)
    const { data } = await query
    const clients = [...new Set((data ?? []).map((b: { client_name: string }) => b.client_name))].sort()
    return NextResponse.json({ clients })
  }

  // Return assignments for a specific user
  const { data, error } = await supabase
    .from('user_client_assignments')
    .select('client_name')
    .eq('user_id', userId)
    .order('client_name')

  if (error?.code === '42P01') {
    return NextResponse.json({ clients: [], tableExists: false })
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    clients: (data ?? []).map((a: { client_name: string }) => a.client_name),
    tableExists: true,
  })
}

// POST /api/user-clients { userId, clientName }  → assign client to user
export async function POST(req: NextRequest) {
  const ctx = await getWorkspaceCtx()
  if (!ctx.isSuperAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { userId, clientName } = await req.json()
  const { error } = await supabase
    .from('user_client_assignments')
    .upsert({ user_id: userId, client_name: clientName }, { onConflict: 'user_id,client_name' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// DELETE /api/user-clients { userId, clientName }  → remove client assignment
export async function DELETE(req: NextRequest) {
  const ctx = await getWorkspaceCtx()
  if (!ctx.isSuperAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { userId, clientName } = await req.json()
  const { error } = await supabase
    .from('user_client_assignments')
    .delete()
    .eq('user_id', userId)
    .eq('client_name', clientName)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
