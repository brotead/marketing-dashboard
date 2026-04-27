import { NextRequest, NextResponse } from 'next/server'
import { removeClientAllData } from '@/lib/storage'

export async function DELETE(req: NextRequest) {
  const { client_name, source } = await req.json()
  await removeClientAllData(client_name, source)
  return NextResponse.json({ ok: true })
}
