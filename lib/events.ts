export const MANHATTAN_SUBREGIONS = ['Uptown', 'Midtown', 'Downtown'] as const

export type ManhattanSubregion = (typeof MANHATTAN_SUBREGIONS)[number]
export type EventIntent = 'dating' | 'friendship'

export type EventForScoring = {
  intent: EventIntent
  restaurant_cuisines: string[] | null
  restaurant_subregion: string | null
}

export type ProfileForScoring = {
  bio: string | null
  cuisine_preferences: string[] | null
  id: string
  intent: EventIntent | null
  max_travel_minutes: number | null
  subregion: string | null
}

export type PersonalScore = {
  score: number
  summary: string
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function normalizeTag(value: string) {
  return value.trim().toLowerCase()
}

export function normalizeCuisineList(values: string[] | null | undefined) {
  if (!values || values.length === 0) {
    return [] as string[]
  }

  const seen = new Set<string>()
  const normalized: string[] = []

  for (const value of values) {
    const next = normalizeTag(value)

    if (!next || seen.has(next)) {
      continue
    }

    seen.add(next)
    normalized.push(next)
  }

  return normalized
}

export function parseCuisinePreferenceInput(value: string) {
  return normalizeCuisineList(
    value
      .split(',')
      .map((token) => token.trim())
      .filter(Boolean)
  )
}

function countCuisineOverlap(a: string[], b: string[]) {
  if (a.length === 0 || b.length === 0) {
    return 0
  }

  const bSet = new Set(b)
  return a.filter((value) => bSet.has(value)).length
}

export function calculateRestaurantMatchScore(
  profile: ProfileForScoring,
  event: EventForScoring
) {
  const profileCuisines = normalizeCuisineList(profile.cuisine_preferences)
  const restaurantCuisines = normalizeCuisineList(event.restaurant_cuisines)
  const overlapCount = countCuisineOverlap(profileCuisines, restaurantCuisines)
  const overlapRatio =
    profileCuisines.length === 0 ? 0 : overlapCount / profileCuisines.length

  let score = 35 + overlapRatio * 50

  if (profileCuisines.length === 0) {
    score -= 8
  }

  if (restaurantCuisines.length === 0) {
    score -= 8
  }

  if (
    profile.subregion &&
    event.restaurant_subregion &&
    profile.subregion === event.restaurant_subregion
  ) {
    score += 15
  } else if ((profile.max_travel_minutes ?? 0) >= 30) {
    score += 8
  } else {
    score -= 8
  }

  if (profile.intent === event.intent) {
    score += 8
  }

  return clampScore(score)
}

function scoreAttendeePair(
  attendee: ProfileForScoring,
  other: ProfileForScoring,
  eventIntent: EventIntent
) {
  let score = 30
  const reasons: string[] = []

  if (attendee.intent === eventIntent && other.intent === eventIntent) {
    score += 15
    reasons.push('shared event intent')
  }

  if (attendee.subregion && other.subregion && attendee.subregion === other.subregion) {
    score += 25
    reasons.push('same subregion')
  } else if (
    (attendee.max_travel_minutes ?? 0) >= 30 &&
    (other.max_travel_minutes ?? 0) >= 30
  ) {
    score += 12
    reasons.push('both flexible on travel')
  }

  const attendeeCuisines = normalizeCuisineList(attendee.cuisine_preferences)
  const otherCuisines = normalizeCuisineList(other.cuisine_preferences)
  const overlapCount = countCuisineOverlap(attendeeCuisines, otherCuisines)

  if (overlapCount > 0) {
    score += Math.min(25, overlapCount * 12)
    reasons.push('similar cuisine preferences')
  }

  const travelDifference = Math.abs(
    (attendee.max_travel_minutes ?? 30) - (other.max_travel_minutes ?? 30)
  )
  score += Math.max(0, 12 - travelDifference / 2)

  if (attendee.bio && other.bio) {
    score += 6
    reasons.push('both added profile context')
  }

  return {
    reasons,
    score: clampScore(score),
  }
}

export function buildPersonalScores(
  attendees: ProfileForScoring[],
  eventIntent: EventIntent
) {
  const scoreByUserId = new Map<string, PersonalScore>()

  for (const attendee of attendees) {
    const otherAttendees = attendees.filter((other) => other.id !== attendee.id)

    if (otherAttendees.length === 0) {
      scoreByUserId.set(attendee.id, {
        score: 50,
        summary:
          'You are currently the first attendee. Personal match score will update as others join.',
      })
      continue
    }

    let scoreTotal = 0
    const reasonFrequency = new Map<string, number>()

    for (const other of otherAttendees) {
      const pairScore = scoreAttendeePair(attendee, other, eventIntent)
      scoreTotal += pairScore.score

      for (const reason of pairScore.reasons) {
        reasonFrequency.set(reason, (reasonFrequency.get(reason) ?? 0) + 1)
      }
    }

    const averageScore = clampScore(scoreTotal / otherAttendees.length)
    const topReasons = Array.from(reasonFrequency.entries())
      .sort((left, right) => right[1] - left[1])
      .slice(0, 2)
      .map(([reason]) => reason)

    scoreByUserId.set(attendee.id, {
      score: averageScore,
      summary:
        topReasons.length > 0
          ? `Best overlap in this event: ${topReasons.join(', ')}.`
          : 'Personal fit is based on travel flexibility and profile overlap.',
    })
  }

  return scoreByUserId
}
