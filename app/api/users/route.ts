import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceCtx } from '@/lib/workspace'
import { supabase } from '@/lib/supabase'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function authAdmin() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)
}

export async function PATCH(req: NextRequest) {
  const ctx = await getWorkspaceCtx()
  if (!ctx.isSuperAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { uid, role, active } = await req.json()
  const updates: Record<string, unknown> = {}
  if (role   !== undefined) updates.role   = role
  if (active !== undefined) updates.active = active

  const { error } = await supabase.from('profiles').update(updates).eq('id', uid)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const ctx = await getWorkspaceCtx()
  if (!ctx.isSuperAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { uid } = await req.json()
  // Delete auth user — profile is cascade-deleted automatically
  const { error } = await authAdmin().auth.admin.deleteUser(uid)
  if (error) {
    // Fallback: delete profile only
    await supabase.from('profiles').delete().eq('id', uid)
  }
  return NextResponse.json({ ok: true })
}
