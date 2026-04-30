import { bladeList } from '@/constants/bladeList'

const normalizedToId = new Map<string, string>()
const strictNormalizedToId = new Map<string, string>()

function normalizeText(input: string): string {
  return input.trim().toLowerCase()
}

for (const blade of bladeList) {
  normalizedToId.set(normalizeText(blade.id), blade.id)
  normalizedToId.set(normalizeText(blade.zhName), blade.id)
  normalizedToId.set(normalizeText(blade.enName), blade.id)
  normalizedToId.set(normalizeText(blade.label), blade.id)

  strictNormalizedToId.set(normalizeText(blade.id), blade.id)
  strictNormalizedToId.set(normalizeText(blade.zhName), blade.id)
  strictNormalizedToId.set(normalizeText(blade.enName), blade.id)
  strictNormalizedToId.set(normalizeText(blade.label), blade.id)
}

const idRegex = /\b([A-Z]{2,4}-\d{2}(?:-\d{2})?)\b/i

export function resolveBladeId(input: string): string | undefined {
  const trimmed = input.trim()
  if (!trimmed) return undefined

  const idMatch = trimmed.match(idRegex)?.[1]
  if (idMatch) {
    const normalizedId = normalizeText(idMatch)
    if (normalizedToId.has(normalizedId)) {
      return normalizedToId.get(normalizedId)
    }
  }

  return normalizedToId.get(normalizeText(trimmed))
}

export function canonicalizeBeyValue(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) return ''
  // Keep user-customized labels editable; only canonicalize strict known values.
  return strictNormalizedToId.get(normalizeText(trimmed)) ?? trimmed
}
