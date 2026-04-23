import { type MatchIntent } from '@/lib/rounds'

type MatchCandidate = {
  display_name: string | null
  id: string
  max_travel_minutes: number | null
  neighbourhood: string | null
  subregion: string | null
}

export type ProposedMatch = {
  rationale: string
  score: number
  userA: MatchCandidate
  userB: MatchCandidate
}

type BuildMatchesOptions = {
  blockedPairKeys?: Set<string>
}

export function buildPairKey(userIdA: string, userIdB: string) {
  return [userIdA, userIdB].sort().join('::')
}

function isTravelCompatible(a: MatchCandidate, b: MatchCandidate) {
  if (!a.subregion || !b.subregion) {
    return false
  }

  if (a.subregion === b.subregion) {
    return true
  }

  return (a.max_travel_minutes ?? 0) >= 30 && (b.max_travel_minutes ?? 0) >= 30
}

function scorePair(a: MatchCandidate, b: MatchCandidate) {
  if (!isTravelCompatible(a, b)) {
    return null
  }

  let score = 0
  const reasons: string[] = []

  if (a.subregion === b.subregion) {
    score += 60
    reasons.push(`same ${(a.subregion ?? 'local').toLowerCase()} subregion`)
  } else {
    score += 20
    reasons.push('both allow cross-subregion travel')
  }

  if (
    a.neighbourhood &&
    b.neighbourhood &&
    a.neighbourhood.toLowerCase() === b.neighbourhood.toLowerCase()
  ) {
    score += 20
    reasons.push('same neighbourhood')
  }

  const travelBalance =
    30 - Math.abs((a.max_travel_minutes ?? 30) - (b.max_travel_minutes ?? 30))

  score += Math.max(0, travelBalance)
  reasons.push('similar travel tolerance')

  return {
    rationale: reasons.join(', '),
    score,
  }
}

export function buildMatches(
  candidates: MatchCandidate[],
  intent: MatchIntent,
  options: BuildMatchesOptions = {}
) {
  const scoredPairs: ProposedMatch[] = []
  const blockedPairKeys = options.blockedPairKeys ?? new Set<string>()

  for (let index = 0; index < candidates.length; index += 1) {
    for (
      let compareIndex = index + 1;
      compareIndex < candidates.length;
      compareIndex += 1
    ) {
      const userA = candidates[index]
      const userB = candidates[compareIndex]

      if (blockedPairKeys.has(buildPairKey(userA.id, userB.id))) {
        continue
      }

      const score = scorePair(userA, userB)

      if (!score) {
        continue
      }

      scoredPairs.push({
        rationale: `Matched for ${intent} because of ${score.rationale}.`,
        score: score.score,
        userA,
        userB,
      })
    }
  }

  scoredPairs.sort((left, right) => right.score - left.score)

  const usedUsers = new Set<string>()
  const matches: ProposedMatch[] = []

  for (const pair of scoredPairs) {
    if (usedUsers.has(pair.userA.id) || usedUsers.has(pair.userB.id)) {
      continue
    }

    usedUsers.add(pair.userA.id)
    usedUsers.add(pair.userB.id)
    matches.push(pair)
  }

  return matches
}
