import { NextRequest, NextResponse } from 'next/server'
import { getHiddenClients, hideClient, unhideClient } from '@/lib/storage'
import { getWorkspaceCtx } from '@/lib/workspace'

export const dynamic = 'force-dynamic'

export async function GET() {
  const ctx = await getWorkspaceCtx()
  const data = await getHiddenClients(ctx)
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await getWorkspaceCtx()
    const { client_name, source } = await req.json()
    await hideClient(client_name, source, ctx)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[POST /api/hidden-clients]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { client_name, source } = await req.json()
    await unhideClient(client_name, source)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[DELETE /api/hidden-clients]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
