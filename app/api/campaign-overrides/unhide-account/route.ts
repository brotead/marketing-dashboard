import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { account_id, source } = await req.json()
    if (!account_id || !source) {
      return NextResponse.json({ error: 'account_id and source required' }, { status: 400 })
    }
    await supabase
      .from('campaign_overrides')
      .delete()
      .eq('account_id', account_id)
      .eq('source', source)
      .eq('hidden', true)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
