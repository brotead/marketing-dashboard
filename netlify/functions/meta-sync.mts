import type { Config } from '@netlify/functions'

// META SYNC DISABLED — desconectado por precaución (bloqueos en Meta API).
// Para reactivar: descomentar el cuerpo de la función y restaurar schedule: '@hourly'.
export default async () => {
  console.log('[meta-sync cron] Sync deshabilitado.')
}

export const config: Config = {
  schedule: '@hourly',
}
