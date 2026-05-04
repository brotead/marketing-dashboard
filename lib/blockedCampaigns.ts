// Permanent campaign name blacklist -- these are never added to budgets, not even via sync.
// Names are matched after normalization (lowercase, no accents, separators -> spaces).

function norm(s: string): string {
  return s.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[|\-_]+/g, ' ')
    .replace(/\s+/g, ' ').trim()
}

const BLOCKED = new Set([
  norm('Ib - Consutlas'),
  norm('Ib - Follower ads'),
  norm('Ib - Consultas - Equipamientos Comerciales'),
])

export function isBlocked(campaignName: string): boolean {
  return BLOCKED.has(norm(campaignName))
}
