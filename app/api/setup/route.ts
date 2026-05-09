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
);

CREATE TABLE IF NOT EXISTS hidden_clients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id TEXT,
  client_name TEXT NOT NULL,
  source TEXT NOT NULL,
  hidden_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_name, source)
);

CREATE TABLE IF NOT EXISTS excluded_campaigns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id TEXT,
  account_id TEXT NOT NULL,
  source TEXT NOT NULL,
  campaign_name TEXT NOT NULL,
  campaign_name_norm TEXT NOT NULL,
  excluded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS campaign_overrides (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id TEXT NOT NULL,
  source TEXT NOT NULL,
  campaign_name_norm TEXT NOT NULL,
  hidden BOOLEAN DEFAULT FALSE,
  manual_spent NUMERIC,
  manual_budget NUMERIC,
  paused BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(account_id, source, campaign_name_norm)
);`

// POST /api/setup — idempotent initial setup (admin only).
// Creates brotead@gmail.com admin, demotes fdiaz to editor,
// and assigns ALL existing shared clients to BOTH users.
// Data is never duplicated — all users read/write the same budgets rows.
export async function POST() {
  const ctx = await getWorkspaceCtx()
  if (!ctx.isSuperAdmin) {
    return NextResponse.json({ error: 'Solo administradores pueden ejecutar el setup.' }, { status: 403 })
  }

  const results: string[] = []

  // 1. Verify assignments table exists
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
    .select('id, email, role')
    .eq('email', 'fdiaz@brotead.com')
    .single()

  // 3. Create / find brotead@gmail.com admin user
  let broteadId: string | null = null

  const { data: newUser, error: createErr } = await adminAuth().auth.admin.createUser({
    email: 'brotead@gmail.com',
    password: 'BroteAD2025!',
    email_confirm: true,
    user_metadata: { name: 'Administrador Brote' },
  })

  if (createErr) {
    if (createErr.message.includes('already been registered') || createErr.message.includes('already exists')) {
      results.push('ℹ️ brotead@gmail.com ya existe')
      // Look up existing profile
      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', 'brotead@gmail.com')
        .single()
      broteadId = existing?.id ?? null
    } else {
      results.push(`❌ Error creando brotead@gmail.com: ${createErr.message}`)
    }
  } else if (newUser?.user) {
    broteadId = newUser.user.id
    await supabase.from('profiles').upsert({
      id: broteadId,
      email: 'brotead@gmail.com',
      name: 'Administrador Brote',
      role: 'super_admin',
      active: true,
      role_selected: true,
      workspace_id: null,
    }, { onConflict: 'id' })
    results.push('✅ brotead@gmail.com creado como Administrador')
  }

  // Ensure brotead's profile role is super_admin (in case it was reset)
  if (broteadId) {
    await supabase.from('profiles').update({ role: 'super_admin' }).eq('id', broteadId)
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

  // 5. Get ALL unique client names from the shared budgets table (no workspace filter —
  //    all clients live in the same table and are shared between all users)
  const { data: budgets } = await supabase.from('budgets').select('client_name')
  const clients = [...new Set((budgets ?? []).map((b: { client_name: string }) => b.client_name))].sort()

  if (clients.length === 0) {
    results.push('ℹ️ No se encontraron clientes en la tabla de presupuestos')
    return NextResponse.json({ ok: true, results })
  }

  results.push(`📋 Clientes encontrados (${clients.length}): ${clients.join(', ')}`)

  // 6. Assign ALL clients to fdiaz
  if (fdiaz) {
    const { error: e } = await supabase
      .from('user_client_assignments')
      .upsert(clients.map(c => ({ user_id: fdiaz.id, client_name: c })), { onConflict: 'user_id,client_name' })
    if (e) results.push(`❌ Error asignando clientes a fdiaz: ${e.message}`)
    else results.push(`✅ ${clients.length} cliente(s) asignados a fdiaz@brotead.com`)
  }

  // 7. Assign ALL clients to brotead (explicit record — brotead also sees everything via
  //    super_admin role bypass, but explicit assignment keeps the data consistent)
  if (broteadId) {
    const { error: e } = await supabase
      .from('user_client_assignments')
      .upsert(clients.map(c => ({ user_id: broteadId!, client_name: c })), { onConflict: 'user_id,client_name' })
    if (e) results.push(`❌ Error asignando clientes a brotead: ${e.message}`)
    else results.push(`✅ ${clients.length} cliente(s) asignados a brotead@gmail.com`)
  }

  return NextResponse.json({ ok: true, results })
}
