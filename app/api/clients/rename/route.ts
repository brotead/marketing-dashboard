import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const { oldName, newName } = await req.json()
  if (!oldName || !newName || oldName === newName) {
    return NextResponse.json({ error: 'Invalid names' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )

  // Update budgets table
  const { error: budgetsError } = await supabase
    .from('budgets')
    .update({ client_name: newName })
    .eq('client_name', oldName)

  if (budgetsError) {
    return NextResponse.json({ error: budgetsError.message }, { status: 500 })
  }

  // Update goals table if it exists
  await supabase
    .from('goals')
    .update({ client_name: newName })
    .eq('client_name', oldName)

  // Update onboarding_clients table if it exists
  await supabase
    .from('onboarding_clients')
    .update({ client_name: newName })
    .eq('client_name', oldName)

  return NextResponse.json({ ok: true })
}
