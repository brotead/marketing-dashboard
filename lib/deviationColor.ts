export interface DeviationColors {
  dot:   string  // Tailwind bg-* class for dot/bar
  bar:   string  // same as dot (bar fill)
  text:  string  // Tailwind text-* class
  label: string  // human label
}

// Rules: ±4% green, ±5-9% orange, ±10%+ red
export function getDeviationColor(deviation: number | null): DeviationColors {
  if (deviation === null) return {
    dot: 'bg-gray-400', bar: 'bg-gray-400',
    text: 'text-gray-400 dark:text-gray-500', label: '—',
  }
  const abs = Math.abs(deviation)
  if (abs <= 4) return {
    dot: 'bg-green-500', bar: 'bg-green-500',
    text: 'text-green-600 dark:text-green-500', label: 'En ritmo',
  }
  if (abs < 10) return {
    dot: 'bg-amber-400', bar: 'bg-amber-400',
    text: 'text-amber-600 dark:text-amber-500',
    label: deviation > 0 ? 'Excediendo' : 'Bajo ritmo',
  }
  return {
    dot: 'bg-red-500', bar: 'bg-red-500',
    text: 'text-red-600 dark:text-red-500',
    label: deviation > 0 ? 'Excediendo' : 'Bajo ritmo',
  }
}
