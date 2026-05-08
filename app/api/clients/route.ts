import { NextRequest, NextResponse } from 'next/server'
import { removeClientAllData } from '@/lib/storage'
import { getWorkspaceCtx } from '@/lib/workspace'

export const dynamic = 'force-dynamic'

export async function DELETE(req: NextRequest) {
  try {
    const ctx = await getWorkspaceCtx()
    const { client_name, source } = await req.json()
    await removeClientAllData(client_name, source, ctx)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[DELETE /api/clients]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
