/** Last segment of ids like `pl-ab12cd34` (8 hex chars). */
export function shortPlayerIdSuffix(playerId: string): string {
  const parts = playerId.split('-')
  const tail = parts[parts.length - 1] ?? playerId
  return tail.length >= 4 ? tail.slice(-4) : tail
}
