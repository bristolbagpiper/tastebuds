export const MANHATTAN_SUBREGIONS = ['Uptown', 'Midtown', 'Downtown'] as const
export const ENERGY_LEVELS = ['Chill', 'Moderate', 'High'] as const
export const SCENE_TAGS = ['Date', 'Social', 'Solo', 'Party'] as const
export const CROWD_TAGS = ['Young', 'Mixed', 'Professional', 'Upscale'] as const
export const MUSIC_TAGS = ['None', 'Background', 'Live', 'DJ'] as const
export const SETTING_TAGS = ['Bar', 'Lounge', 'Restaurant', 'Outdoor'] as const
export const PRICE_TAGS = ['$', '$$', '$$$', '$$$$'] as const

export type ManhattanSubregion = (typeof MANHATTAN_SUBREGIONS)[number]
export type EventIntent = 'dating' | 'friendship'

export type VenueMatchBreakdown = {
  crowd: number
  cuisine: number
  energy: number
  location: number
  music: number
  price: number
  scene: number
  setting: number
}

export type EventForScoring = {
  intent: EventIntent
  restaurant_cuisines: string[] | null
  restaurant_subregion: string | null
  venue_latitude: number | null
  venue_longitude: number | null
  venue_crowd: string[] | null
  venue_energy: string | null
  venue_music: string[] | null
  venue_price: string | null
  venue_scene: string[] | null
  venue_setting: string[] | null
}

export type ProfileForScoring = {
  bio: string | null
  cuisine_preferences: string[] | null
  home_latitude: number | null
  home_longitude: number | null
  id: string
  intent: EventIntent | null
  max_travel_minutes: number | null
  preferred_crowd: string[] | null
  preferred_energy: string[] | null
  preferred_music: string[] | null
  preferred_price: string[] | null
  preferred_scene: string[] | null
  preferred_setting: string[] | null
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

function normalizeCanonicalList<T extends readonly string[]>(
  values: string[] | null | undefined,
  allowed: T
) {
  if (!values || values.length === 0) {
    return [] as T[number][]
  }

  const canonicalByLower = new Map(
    allowed.map((value) => [value.toLowerCase(), value] as const)
  )
  const seen = new Set<string>()
  const normalized: T[number][] = []

  for (const value of values) {
    const canonical = canonicalByLower.get(normalizeTag(value))

    if (!canonical || seen.has(canonical)) {
      continue
    }

    seen.add(canonical)
    normalized.push(canonical)
  }

  return normalized
}

function normalizeCanonicalSingle<T extends readonly string[]>(
  value: string | null | undefined,
  allowed: T
) {
  if (!value) {
    return null
  }

  const canonicalByLower = new Map(
    allowed.map((option) => [option.toLowerCase(), option] as const)
  )

  return canonicalByLower.get(normalizeTag(value)) ?? null
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

export function normalizeEnergyList(values: string[] | null | undefined) {
  return normalizeCanonicalList(values, ENERGY_LEVELS)
}

export function normalizeSceneList(values: string[] | null | undefined) {
  return normalizeCanonicalList(values, SCENE_TAGS)
}

export function normalizeCrowdList(values: string[] | null | undefined) {
  return normalizeCanonicalList(values, CROWD_TAGS)
}

export function normalizeMusicList(values: string[] | null | undefined) {
  return normalizeCanonicalList(values, MUSIC_TAGS)
}

export function normalizeSettingList(values: string[] | null | undefined) {
  return normalizeCanonicalList(values, SETTING_TAGS)
}

export function normalizePriceList(values: string[] | null | undefined) {
  return normalizeCanonicalList(values, PRICE_TAGS)
}

export function normalizeVenueEnergy(value: string | null | undefined) {
  return normalizeCanonicalSingle(value, ENERGY_LEVELS)
}

export function normalizeVenuePrice(value: string | null | undefined) {
  return normalizeCanonicalSingle(value, PRICE_TAGS)
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

function scoreOrderedMatch<T extends readonly string[]>(
  preferences: string[] | null | undefined,
  eventValue: string | null | undefined,
  order: T
) {
  const normalizedPreferences = normalizeCanonicalList(preferences, order)
  const normalizedEventValue = normalizeCanonicalSingle(eventValue, order)

  if (normalizedPreferences.length === 0 || !normalizedEventValue) {
    return 0.45
  }

  const eventIndex = order.indexOf(normalizedEventValue)
  let bestScore = 0

  for (const preference of normalizedPreferences) {
    const preferenceIndex = order.indexOf(preference)
    const distance = Math.abs(preferenceIndex - eventIndex)
    const nextScore = distance === 0 ? 1 : distance === 1 ? 0.55 : 0.1
    bestScore = Math.max(bestScore, nextScore)
  }

  return bestScore
}

function scoreOverlap(
  preferences: string[] | null | undefined,
  eventValues: string[] | null | undefined
) {
  if (!preferences?.length || !eventValues?.length) {
    return 0.45
  }

  const eventValueSet = new Set(eventValues)
  const overlapCount = preferences.filter((value) => eventValueSet.has(value)).length

  if (overlapCount === 0) {
    return 0
  }

  return Math.min(1, overlapCount / Math.min(preferences.length, eventValues.length))
}

export function calculateDistanceKm(
  startLatitude: number,
  startLongitude: number,
  endLatitude: number,
  endLongitude: number
) {
  const toRadians = (value: number) => (value * Math.PI) / 180
  const earthRadiusKm = 6371
  const latitudeDelta = toRadians(endLatitude - startLatitude)
  const longitudeDelta = toRadians(endLongitude - startLongitude)
  const a =
    Math.sin(latitudeDelta / 2) * Math.sin(latitudeDelta / 2) +
    Math.cos(toRadians(startLatitude)) *
      Math.cos(toRadians(endLatitude)) *
      Math.sin(longitudeDelta / 2) *
      Math.sin(longitudeDelta / 2)

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function scoreLocation(profile: ProfileForScoring, event: EventForScoring) {
  if (
    profile.home_latitude !== null &&
    profile.home_longitude !== null &&
    event.venue_latitude !== null &&
    event.venue_longitude !== null
  ) {
    const distanceKm = calculateDistanceKm(
      profile.home_latitude,
      profile.home_longitude,
      event.venue_latitude,
      event.venue_longitude
    )
    const comfortableDistanceKm = Math.max(2, (profile.max_travel_minutes ?? 30) * 0.6)

    if (distanceKm <= comfortableDistanceKm * 0.6) {
      return 1
    }

    if (distanceKm <= comfortableDistanceKm) {
      return 0.8
    }

    if (distanceKm <= comfortableDistanceKm * 1.35) {
      return 0.45
    }

    if (distanceKm <= comfortableDistanceKm * 1.75) {
      return 0.15
    }

    return 0
  }

  if (!profile.subregion || !event.restaurant_subregion) {
    return 0.4
  }

  if (profile.subregion === event.restaurant_subregion) {
    return 1
  }

  const maxTravelMinutes = profile.max_travel_minutes ?? 30

  if (maxTravelMinutes >= 45) {
    return 0.85
  }

  if (maxTravelMinutes >= 30) {
    return 0.6
  }

  return 0.2
}

export function buildVenueMatchBreakdown(
  profile: ProfileForScoring,
  event: EventForScoring
): VenueMatchBreakdown {
  return {
    crowd: scoreOverlap(
      normalizeCrowdList(profile.preferred_crowd),
      normalizeCrowdList(event.venue_crowd)
    ),
    cuisine: scoreOverlap(
      normalizeCuisineList(profile.cuisine_preferences),
      normalizeCuisineList(event.restaurant_cuisines)
    ),
    energy: scoreOrderedMatch(
      normalizeEnergyList(profile.preferred_energy),
      normalizeVenueEnergy(event.venue_energy),
      ENERGY_LEVELS
    ),
    location: scoreLocation(profile, event),
    music: scoreOverlap(
      normalizeMusicList(profile.preferred_music),
      normalizeMusicList(event.venue_music)
    ),
    price: scoreOrderedMatch(
      normalizePriceList(profile.preferred_price),
      normalizeVenuePrice(event.venue_price),
      PRICE_TAGS
    ),
    scene: scoreOverlap(
      normalizeSceneList(profile.preferred_scene),
      normalizeSceneList(event.venue_scene)
    ),
    setting: scoreOverlap(
      normalizeSettingList(profile.preferred_setting),
      normalizeSettingList(event.venue_setting)
    ),
  }
}

export function describeVenueMatch(
  profile: ProfileForScoring,
  event: EventForScoring
) {
  const breakdown = buildVenueMatchBreakdown(profile, event)
  const strengths = [
    breakdown.energy >= 0.8 ? 'energy' : null,
    breakdown.scene >= 0.8 ? 'scene' : null,
    breakdown.price >= 0.8 ? 'price' : null,
    breakdown.crowd >= 0.8 ? 'crowd' : null,
    breakdown.location >= 0.8 ? 'location' : null,
    breakdown.setting >= 0.8 ? 'setting' : null,
    breakdown.music >= 0.8 ? 'music' : null,
    breakdown.cuisine >= 0.8 ? 'cuisine' : null,
  ].filter(Boolean) as string[]

  const tensions = [
    breakdown.energy <= 0.15 ? 'energy' : null,
    breakdown.scene <= 0.15 ? 'scene' : null,
    breakdown.price <= 0.15 ? 'price' : null,
    breakdown.crowd <= 0.15 ? 'crowd' : null,
    breakdown.location <= 0.15 ? 'location' : null,
  ].filter(Boolean) as string[]

  if (strengths.length >= 2) {
    return `Strongest alignment: ${strengths.slice(0, 3).join(', ')}.`
  }

  if (strengths.length === 1) {
    return `Best match dimension: ${strengths[0]}.`
  }

  if (tensions.length > 0) {
    return `Weakest alignment: ${tensions.slice(0, 2).join(', ')}.`
  }

  return 'Built from venue mood, crowd, spend, and location fit.'
}

export function calculateRestaurantMatchScore(
  profile: ProfileForScoring,
  event: EventForScoring
) {
  const breakdown = buildVenueMatchBreakdown(profile, event)

  const baseScore =
    breakdown.energy * 30 +
    breakdown.scene * 25 +
    breakdown.price * 15 +
    breakdown.crowd * 15 +
    breakdown.location * 15

  const secondaryBonus =
    breakdown.setting * 4 + breakdown.music * 3 + breakdown.cuisine * 5

  return clampScore(Math.min(100, baseScore + secondaryBonus))
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

  const attendeeScenes = normalizeSceneList(attendee.preferred_scene)
  const otherScenes = normalizeSceneList(other.preferred_scene)
  if (scoreOverlap(attendeeScenes, otherScenes) >= 0.8) {
    score += 10
    reasons.push('similar night preferences')
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
          'You are currently the first attendee. Group fit will update as others join.',
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
          : 'Group fit updates as attendee preferences settle.',
    })
  }

  return scoreByUserId
}
