// Pure parsing/matching logic for bulk site plan import — no 'use client' or
// 'use server' directive so it can be imported from either side. Kept
// side-effect free and easy to unit-test independently of the upload UI.

// Known filename prefixes used across the different developments this app
// tracks. If a new development uses a prefix outside this set, filenames
// just won't auto-match — the admin still gets a manual "Matched lot"
// picker per row in the preview table, so nothing is silently mis-filed.
export const KNOWN_SITE_PREFIXES = ['TL', 'HB', 'PW', 'MH'] as const

export type ParsedFilename = {
  sitePrefix: string | null
  lotNumber: number | null
  homeDesign: string | null
}

// Examples this must satisfy (see task spec):
//   "TLB328_KINGFISH_SITE PLAN_Rev 5.pdf" -> { sitePrefix: 'TL', lotNumber: 328, homeDesign: 'Kingfish' }
//   "HB_070_LANDSCAPING_REV A.pdf"        -> { sitePrefix: 'HB', lotNumber: 70,  homeDesign: null }
export function parseSitePlanFilename(filename: string): ParsedFilename {
  const base = filename.replace(/\.[^/.]+$/, '') // strip extension
  const upper = base.toUpperCase()

  const sitePrefix = KNOWN_SITE_PREFIXES.find((p) => upper.startsWith(p)) ?? null
  if (!sitePrefix) return { sitePrefix: null, lotNumber: null, homeDesign: null }

  const afterPrefix = base.slice(sitePrefix.length)

  // First 2-4 digit run after the prefix (a leading non-digit like the "B" in
  // "TLB328", or an underscore like in "HB_070", is skipped automatically).
  const lotMatch = afterPrefix.match(/\d{2,4}/)
  if (!lotMatch || lotMatch.index == null) {
    return { sitePrefix, lotNumber: null, homeDesign: null }
  }
  const lotNumber = parseInt(lotMatch[0], 10) // strips leading zeros, e.g. "070" -> 70

  // Home design (NLV only) — the underscore/space/dash-delimited word(s)
  // sitting directly between the lot number and a "SITE PLAN"/"LANDSCAPING"
  // marker. Providence filenames have no such word (marker follows the lot
  // number immediately), so this naturally comes back null for them.
  let homeDesign: string | null = null
  const afterLot = afterPrefix.slice(lotMatch.index + lotMatch[0].length)
  const markerMatch = afterLot.match(/SITE\s*PLAN|LANDSCAPING/i)
  if (markerMatch && markerMatch.index != null) {
    const between = afterLot.slice(0, markerMatch.index).replace(/^[_\s-]+|[_\s-]+$/g, '')
    if (between) {
      homeDesign = between
        .split(/[_\s-]+/)
        .filter(Boolean)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ')
    }
  }

  return { sitePrefix, lotNumber, homeDesign }
}

// The DB has no explicit "site abbreviation" column, so this derives a
// best-effort short code from the site name to compare against a parsed
// filename prefix (e.g. "Tuart Lakes" -> "TL"). It's intentionally a
// heuristic — the preview table always lets the admin pick/correct the
// matched lot by hand, so a wrong or missing guess here never causes a
// silent mismatch.
export function deriveSiteAbbreviation(siteName: string): string {
  const STOPWORDS = new Set(['the', 'estate', 'stage', 'park', 'of', 'and', 'at'])
  const words = siteName
    .split(/\s+/)
    .map((w) => w.replace(/[^a-zA-Z]/g, ''))
    .filter((w) => w.length > 0 && !STOPWORDS.has(w.toLowerCase()))

  if (words.length >= 2) return words.map((w) => w[0].toUpperCase()).join('').slice(0, 3)
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return ''
}

export type MatchableLot = {
  id: string
  lotNumber: string
  siteId: string
  siteName: string
  stageId: string
  stageName: string
  homeDesign: string | null
}

export type BulkMatchStatus = 'ready' | 'no_match'

export type BulkFileMatch = {
  parsedLotNumber: number | null
  parsedHomeDesign: string | null
  matchedLotId: string | null
  status: BulkMatchStatus
}

// Requires both the derived site abbreviation AND the lot number to match —
// lot numbers routinely repeat across different sites, so matching on lot
// number alone would risk silently attaching a plan to the wrong site's lot.
// Anything ambiguous (zero or multiple candidates) comes back as no_match
// for the admin to resolve manually.
export function matchFilenameToLot(filename: string, lots: MatchableLot[]): BulkFileMatch {
  const parsed = parseSitePlanFilename(filename)

  if (parsed.sitePrefix == null || parsed.lotNumber == null) {
    return { parsedLotNumber: parsed.lotNumber, parsedHomeDesign: parsed.homeDesign, matchedLotId: null, status: 'no_match' }
  }

  const candidates = lots.filter((lot) => {
    const lotNum = parseInt(lot.lotNumber, 10)
    if (isNaN(lotNum) || lotNum !== parsed.lotNumber) return false
    return deriveSiteAbbreviation(lot.siteName) === parsed.sitePrefix
  })

  const matchedLotId = candidates.length === 1 ? candidates[0].id : null

  return {
    parsedLotNumber: parsed.lotNumber,
    parsedHomeDesign: parsed.homeDesign,
    matchedLotId,
    status: matchedLotId ? 'ready' : 'no_match',
  }
}
