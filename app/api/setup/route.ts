import { NextResponse } from 'next/server'
import { getWorkspaceCtx } from '@/lib/workspace'
import { supabase } from '@/lib/supabase'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function adminAuth() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)
}

const SETUP_SQL = `CREATE TABLE IF NOT EXISTS user_client_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, client_name)
);`

// POST /api/setup — one-time initial setup (admin only)
// Creates brotead@gmail.com admin, demotes fdiaz to editor, assigns all clients to fdiaz
export async function POST() {
  const ctx = await getWorkspaceCtx()
  if (!ctx.isSuperAdmin) {
    return NextResponse.json({ error: 'Solo administradores pueden ejecutar el setup.' }, { status: 403 })
  }

  const results: string[] = []

  // 1. Check if assignments table exists
  const { error: tableErr } = await supabase
    .from('user_client_assignments')
    .select('user_id')
    .limit(1)

  if (tableErr?.code === '42P01') {
    return NextResponse.json({
      needsSql: true,
      sql: SETUP_SQL,
      results: ['⚠️ La tabla de asignaciones no existe. Ejecutá el SQL en Supabase y volvé a intentar.'],
    })
  }

  // 2. Get fdiaz profile
  const { data: fdiaz } = await supabase
    .from('profiles')
    .select('id, workspace_id, email, role')
    .eq('email', 'fdiaz@brotead.com')
    .single()

  // 3. Create brotead@gmail.com admin user
  const { data: newUser, error: createErr } = await adminAuth().auth.admin.createUser({
    email: 'brotead@gmail.com',
    password: 'BroteAD2025!',
    email_confirm: true,
    user_metadata: { name: 'Administrador Brote' },
  })

  if (createErr) {
    if (createErr.message.includes('already been registered') || createErr.message.includes('already exists')) {
      results.push('ℹ️ brotead@gmail.com ya existe — no se modificó')
    } else {
      results.push(`❌ Error creando brotead@gmail.com: ${createErr.message}`)
    }
  } else if (newUser?.user) {
    await supabase.from('profiles').upsert({
      id: newUser.user.id,
      email: 'brotead@gmail.com',
      name: 'Administrador Brote',
      role: 'super_admin',
      active: true,
      role_selected: true,
      workspace_id: fdiaz?.workspace_id ?? null,
    }, { onConflict: 'id' })
    results.push('✅ brotead@gmail.com creado como Administrador (contraseña: BroteAD2025!)')
  }

  // 4. Demote fdiaz to editor
  if (fdiaz) {
    if (fdiaz.role !== 'editor') {
      await supabase.from('profiles').update({ role: 'editor' }).eq('id', fdiaz.id)
      results.push('✅ fdiaz@brotead.com actualizado a Editor')
    } else {
      results.push('ℹ️ fdiaz@brotead.com ya es Editor')
    }
  } else {
    results.push('⚠️ No se encontró fdiaz@brotead.com')
  }

  // 5. Get all current clients and assign them to fdiaz
  if (fdiaz) {
    let budgetQ = supabase.from('budgets').select('client_name')
    if (fdiaz.workspace_id) budgetQ = budgetQ.eq('workspace_id', fdiaz.workspace_id)
    const { data: budgets } = await budgetQ
    const clients = [...new Set((budgets ?? []).map((b: { client_name: string }) => b.client_name))]

    if (clients.length > 0) {
      const assignments = clients.map((c) => ({ user_id: fdiaz.id, client_name: c }))
      const { error: assignErr } = await supabase
        .from('user_client_assignments')
        .upsert(assignments, { onConflict: 'user_id,client_name' })

      if (assignErr) {
        results.push(`❌ Error asignando clientes: ${assignErr.message}`)
      } else {
        results.push(`✅ ${clients.length} cliente(s) asignados a fdiaz: ${clients.join(', ')}`)
      }
    } else {
      results.push('ℹ️ No se encontraron clientes en budgets para asignar')
    }
  }

  return NextResponse.json({ ok: true, results })
}
