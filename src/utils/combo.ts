import type { Combo, PlayerProfile, TournamentParticipant } from '@/types/bxtm'
import { canonicalizeBeyValue } from '@/utils/bladeResolver'

export function splitComboText(text: string | undefined): string[] {
  return (text ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

export function normalizeBeys(values: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of values) {
    const bey = raw.trim()
    const canonical = bey ? canonicalizeBeyValue(bey) : ''
    if (!canonical || seen.has(canonical)) continue
    seen.add(canonical)
    out.push(canonical)
  }
  return out
}

export function comboLabel(combo: Combo): string {
  return combo.name?.trim() || combo.beys.join(', ')
}

export function participantComboParts(
  player: Pick<TournamentParticipant, 'beys' | 'bey_name'>,
): string[] {
  const fromBeys = player.beys?.map((item) => item.trim()).filter(Boolean) ?? []
  if (fromBeys.length > 0) return fromBeys
  return splitComboText(player.bey_name)
}

export function profilePreviewComboParts(
  profile: Pick<PlayerProfile, 'combos' | 'default_bey_name'>,
): string[] {
  const fromCombo = profile.combos?.[0]?.beys?.map((item) => item.trim()).filter(Boolean) ?? []
  if (fromCombo.length > 0) return fromCombo
  return splitComboText(profile.default_bey_name)
}
