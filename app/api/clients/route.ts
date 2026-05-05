import { NextRequest, NextResponse } from 'next/server'
import { removeClientAllData } from '@/lib/storage'
import { getWorkspaceCtx } from '@/lib/workspace'

export const dynamic = 'force-dynamic'

export async function DELETE(req: NextRequest) {
  const ctx = await getWorkspaceCtx()
  const { client_name, source } = await req.json()
  await removeClientAllData(client_name, source, ctx)
  return NextResponse.json({ ok: true })
}
