export type DeviationStatus = 'green' | 'orange' | 'red'

// SINGLE SOURCE OF TRUTH — exact rules, no interpretation:
// GREEN:  abs <= 4
// ORANGE: abs >= 5 AND abs <= 9   (i.e. 4 < abs < 10)
// RED:    abs >= 10
export function getDeviationStatus(deviation: number | null): DeviationStatus | null {
  if (deviation === null) return null
  const abs = Math.abs(deviation)
  let status: DeviationStatus
  if (abs <= 4) status = 'green'
  else if (abs < 10) status = 'orange'
  else status = 'red'
  console.log('[deviation]', { deviation: deviation.toFixed(2), abs: abs.toFixed(2), status })
  return status
}

export interface DeviationClasses {
  dot:   string
  bar:   string
  text:  string
  label: string
}

// Render helper — ALL components must use this, never hardcode Tailwind classes for deviation.
export function getDeviationClasses(deviation: number | null): DeviationClasses {
  const status = getDeviationStatus(deviation)
  if (status === null) {
    return { dot: 'bg-gray-400', bar: 'bg-gray-400', text: 'text-gray-400 dark:text-gray-500', label: '—' }
  }
  const label = status === 'green' ? 'En ritmo' : deviation! > 0 ? 'Excediendo' : 'Bajo ritmo'
  if (status === 'green')  return { dot: 'bg-green-500', bar: 'bg-green-500', text: 'text-green-600 dark:text-green-500', label }
  if (status === 'orange') return { dot: 'bg-amber-400', bar: 'bg-amber-400', text: 'text-amber-600 dark:text-amber-500', label }
  return { dot: 'bg-red-500', bar: 'bg-red-500', text: 'text-red-600 dark:text-red-500', label }
}

// Dot-only helper for sidebar client list — returns a Tailwind bg-* class.
export function deviationDotClass(deviation: number | null): string {
  const status = getDeviationStatus(deviation)
  if (status === null) return 'bg-gray-400'
  if (status === 'green')  return 'bg-green-500'
  if (status === 'orange') return 'bg-amber-400'
  return 'bg-red-500'
}

// Keep getDeviationColor as a thin alias so nothing outside these files breaks.
/** @deprecated Use getDeviationClasses() instead */
export const getDeviationColor = getDeviationClasses
