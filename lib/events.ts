export const MANHATTAN_SUBREGIONS = ['Uptown', 'Midtown', 'Downtown'] as const
export const ENERGY_LEVELS = ['Chill', 'Moderate', 'High'] as const
export const SCENE_TAGS = ['Date', 'Social', 'Solo', 'Party'] as const
export const CROWD_TAGS = ['Young', 'Mixed', 'Professional', 'Upscale'] as const
export const MUSIC_TAGS = ['None', 'Background', 'Live', 'DJ'] as const
export const SETTING_TAGS = ['Bar', 'Lounge', 'Restaurant', 'Outdoor'] as const
export const PRICE_TAGS = ['$', '$$', '$$$', '$$$$'] as const
export const NOISE_LEVEL_TAGS = ['Quiet', 'Moderate', 'Lively'] as const
export const SEATING_TYPE_TAGS = ['Tables', 'Booths', 'Bar seating', 'Counter', 'Communal'] as const
export const VENUE_FORMAT_TAGS = ['Bar', 'Restaurant', 'Lounge'] as const
export const INDOOR_OUTDOOR_TAGS = ['Indoor', 'Outdoor'] as const
export const VIBE_TAGS = [
  'Chill',
  'Social',
  'Upscale',
  'Casual',
  'Trendy',
  'Cozy',
  'High-energy',
  'Date-night',
  'Foodie',
  'After-work',
  'Outdoor',
  'Live music',
  'Sports/bar scene',
] as const
export const MENU_EXPERIENCE_TAGS = [
  'Cocktails',
  'Wine',
  'Beer',
  'Small plates',
  'Full dinner',
  'Dessert',
  'Vegan/vegetarian options',
  'Gluten-free options',
  'Shareable food',
  'Brunch',
  'Late-night food',
] as const
export const DRINKING_PREFERENCE_TAGS = [
  'No alcohol focus',
  'Cocktails',
  'Wine',
  'Beer',
  'Open to anything',
] as const
export const DIETARY_RESTRICTION_TAGS = [
  'No dietary restrictions',
  'Vegetarian',
  'Vegan',
  'Gluten-free',
  'Pescatarian',
  'Dairy-free',
] as const
export const CONVERSATION_ACTIVITY_TAGS = [
  'Conversation-first',
  'Balanced',
  'Activity-led',
] as const
export const AGE_RANGE_COMFORT_TAGS = ['20s', '30s', '40s+', 'Mixed ages'] as const
export const GROUP_SIZE_COMFORT_TAGS = ['2-4', '4-6', '6-8', '8+'] as const

export type ManhattanSubregion = (typeof MANHATTAN_SUBREGIONS)[number]
export type EventIntent = 'dating' | 'friendship'

export type VenueMatchBreakdown = {
  conversation: number
  crowd: number
  cuisine: number
  dietary: number
  drinking: number
  energy: number
  groupSize: number
  location: number
  music: number
  price: number
  quality: number
  scene: number
  setting: number
  vibe: number
}

export type EventForScoring = {
  capacity?: number | null
  google_good_for_groups?: boolean | null
  google_good_for_watching_sports?: boolean | null
  google_live_music?: boolean | null
  google_open_now?: boolean | null
  google_opening_hours?: string[] | null
  google_outdoor_seating?: boolean | null
  google_price_level?: string | null
  google_rating?: number | null
  google_reservable?: boolean | null
  google_review_count?: number | null
  google_serves_beer?: boolean | null
  google_serves_brunch?: boolean | null
  google_serves_cocktails?: boolean | null
  google_serves_dessert?: boolean | null
  google_serves_dinner?: boolean | null
  google_serves_vegetarian_food?: boolean | null
  google_serves_wine?: boolean | null
  intent: EventIntent
  menu_experience_tags?: string[] | null
  restaurant_cuisines: string[] | null
  restaurant_subregion: string | null
  venue_formats?: string[] | null
  venue_latitude: number | null
  venue_longitude: number | null
  venue_crowd: string[] | null
  venue_energy: string | null
  venue_good_for_casual_meetups?: boolean | null
  venue_good_for_cocktails?: boolean | null
  venue_good_for_conversation?: boolean | null
  venue_good_for_dinner?: boolean | null
  venue_group_friendly?: boolean | null
  venue_indoor_outdoor?: string[] | null
  venue_music: string[] | null
  venue_noise_level?: string | null
  venue_price: string | null
  venue_reservation_friendly?: boolean | null
  venue_scene: string[] | null
  venue_seating_types?: string[] | null
  venue_setting: string[] | null
  venue_vibes?: string[] | null
}

export type ProfileForScoring = {
  age_range_comfort?: string[] | null
  bio: string | null
  cuisine_preferences: string[] | null
  conversation_preference?: string[] | null
  dietary_restrictions?: string[] | null
  drinking_preferences?: string[] | null
  group_size_comfort?: string[] | null
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
  preferred_vibes?: string[] | null
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

export function normalizeNoiseLevel(value: string | null | undefined) {
  return normalizeCanonicalSingle(value, NOISE_LEVEL_TAGS)
}

export function normalizeSeatingTypeList(values: string[] | null | undefined) {
  return normalizeCanonicalList(values, SEATING_TYPE_TAGS)
}

export function normalizeVenueFormatList(values: string[] | null | undefined) {
  return normalizeCanonicalList(values, VENUE_FORMAT_TAGS)
}

export function normalizeIndoorOutdoorList(values: string[] | null | undefined) {
  return normalizeCanonicalList(values, INDOOR_OUTDOOR_TAGS)
}

export function normalizeVibeList(values: string[] | null | undefined) {
  return normalizeCanonicalList(values, VIBE_TAGS)
}

export function normalizeMenuExperienceList(values: string[] | null | undefined) {
  return normalizeCanonicalList(values, MENU_EXPERIENCE_TAGS)
}

export function normalizeDrinkingPreferenceList(values: string[] | null | undefined) {
  return normalizeCanonicalList(values, DRINKING_PREFERENCE_TAGS)
}

export function normalizeDietaryRestrictionList(values: string[] | null | undefined) {
  return normalizeCanonicalList(values, DIETARY_RESTRICTION_TAGS)
}

export function normalizeConversationPreferenceList(values: string[] | null | undefined) {
  return normalizeCanonicalList(values, CONVERSATION_ACTIVITY_TAGS)
}

export function normalizeAgeRangeComfortList(values: string[] | null | undefined) {
  return normalizeCanonicalList(values, AGE_RANGE_COMFORT_TAGS)
}

export function normalizeGroupSizeComfortList(values: string[] | null | undefined) {
  return normalizeCanonicalList(values, GROUP_SIZE_COMFORT_TAGS)
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

function scoreQuality(rating: number | null | undefined, reviewCount: number | null | undefined) {
  if (typeof rating !== 'number' || Number.isNaN(rating)) {
    return 0.5
  }

  const normalizedRating = Math.max(0, Math.min(1, (rating - 3.5) / 1.5))
  const normalizedReviewCount =
    typeof reviewCount === 'number' && reviewCount > 0
      ? Math.max(0, Math.min(1, Math.log10(reviewCount + 1) / 3))
      : 0.25

  return Math.max(0, Math.min(1, normalizedRating * 0.75 + normalizedReviewCount * 0.25))
}

function getVenueVibeTags(event: EventForScoring) {
  const derived: string[] = [...normalizeVibeList(event.venue_vibes)]

  if (normalizeVenueEnergy(event.venue_energy) === 'Chill') {
    derived.push('Chill')
  }
  if (normalizeVenueEnergy(event.venue_energy) === 'High') {
    derived.push('High-energy')
  }
  if (normalizeIndoorOutdoorList(event.venue_indoor_outdoor).includes('Outdoor') || event.google_outdoor_seating) {
    derived.push('Outdoor')
  }
  if (event.google_live_music || normalizeMusicList(event.venue_music).includes('Live')) {
    derived.push('Live music')
  }
  if (event.google_good_for_watching_sports) {
    derived.push('Sports/bar scene')
  }
  if (event.venue_good_for_casual_meetups) {
    derived.push('Casual')
  }
  if (event.venue_good_for_conversation) {
    derived.push('Cozy')
  }

  return normalizeVibeList(derived)
}

function getVenueDrinkingTags(event: EventForScoring) {
  const derived: string[] = []
  const menuTags = normalizeMenuExperienceList(event.menu_experience_tags)

  if (menuTags.includes('Cocktails') || event.google_serves_cocktails || event.venue_good_for_cocktails) {
    derived.push('Cocktails')
  }
  if (menuTags.includes('Wine') || event.google_serves_wine) {
    derived.push('Wine')
  }
  if (menuTags.includes('Beer') || event.google_serves_beer) {
    derived.push('Beer')
  }

  return normalizeDrinkingPreferenceList(derived)
}

function getVenueDietaryTags(event: EventForScoring) {
  const derived: string[] = []
  const menuTags = normalizeMenuExperienceList(event.menu_experience_tags)

  if (menuTags.includes('Vegan/vegetarian options') || event.google_serves_vegetarian_food) {
    derived.push('Vegetarian', 'Vegan')
  }
  if (menuTags.includes('Gluten-free options')) {
    derived.push('Gluten-free')
  }

  return normalizeDietaryRestrictionList(derived)
}

function getVenueConversationTags(event: EventForScoring) {
  const tags: string[] = []

  if (event.venue_good_for_conversation || normalizeNoiseLevel(event.venue_noise_level) === 'Quiet') {
    tags.push('Conversation-first')
  }

  if (
    event.google_live_music ||
    event.google_good_for_watching_sports ||
    normalizeVenueEnergy(event.venue_energy) === 'High'
  ) {
    tags.push('Activity-led')
  }

  if (tags.length === 0 || event.venue_good_for_casual_meetups) {
    tags.push('Balanced')
  }

  return normalizeConversationPreferenceList(tags)
}

function getEventGroupSizeTag(event: EventForScoring) {
  const capacity = event.capacity ?? null

  if (capacity === null || !Number.isFinite(capacity)) {
    return null
  }

  if (capacity <= 4) {
    return '2-4'
  }

  if (capacity <= 6) {
    return '4-6'
  }

  if (capacity <= 8) {
    return '6-8'
  }

  return '8+'
}

function scoreDrinkingPreferences(profile: ProfileForScoring, event: EventForScoring) {
  const preferences = normalizeDrinkingPreferenceList(profile.drinking_preferences)

  if (preferences.length === 0 || preferences.includes('Open to anything')) {
    return 0.6
  }

  if (preferences.includes('No alcohol focus')) {
    const venueTags = getVenueDrinkingTags(event)
    return venueTags.length === 0 ? 1 : 0.45
  }

  return scoreOverlap(preferences, getVenueDrinkingTags(event))
}

function scoreDietaryPreferences(profile: ProfileForScoring, event: EventForScoring) {
  const preferences = normalizeDietaryRestrictionList(profile.dietary_restrictions)

  if (preferences.length === 0 || preferences.includes('No dietary restrictions')) {
    return 0.6
  }

  return scoreOverlap(preferences, getVenueDietaryTags(event))
}

function scoreConversationPreferences(profile: ProfileForScoring, event: EventForScoring) {
  const preferences = normalizeConversationPreferenceList(profile.conversation_preference)

  if (preferences.length === 0) {
    return 0.55
  }

  return scoreOverlap(preferences, getVenueConversationTags(event))
}

function scoreGroupSizePreferences(profile: ProfileForScoring, event: EventForScoring) {
  const preferences = normalizeGroupSizeComfortList(profile.group_size_comfort)
  const eventGroupSize = getEventGroupSizeTag(event)

  if (preferences.length === 0 || !eventGroupSize) {
    return 0.55
  }

  return preferences.includes(eventGroupSize) ? 1 : 0.25
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
    conversation: scoreConversationPreferences(profile, event),
    crowd: scoreOverlap(
      normalizeCrowdList(profile.preferred_crowd),
      normalizeCrowdList(event.venue_crowd)
    ),
    cuisine: scoreOverlap(
      normalizeCuisineList(profile.cuisine_preferences),
      normalizeCuisineList(event.restaurant_cuisines)
    ),
    dietary: scoreDietaryPreferences(profile, event),
    drinking: scoreDrinkingPreferences(profile, event),
    energy: scoreOrderedMatch(
      normalizeEnergyList(profile.preferred_energy),
      normalizeVenueEnergy(event.venue_energy),
      ENERGY_LEVELS
    ),
    groupSize: scoreGroupSizePreferences(profile, event),
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
    quality: scoreQuality(event.google_rating, event.google_review_count),
    vibe: scoreOverlap(
      normalizeVibeList(profile.preferred_vibes),
      getVenueVibeTags(event)
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
    breakdown.vibe >= 0.8 ? 'vibe' : null,
    breakdown.scene >= 0.8 ? 'scene' : null,
    breakdown.price >= 0.8 ? 'price' : null,
    breakdown.crowd >= 0.8 ? 'crowd' : null,
    breakdown.location >= 0.8 ? 'location' : null,
    breakdown.conversation >= 0.8 ? 'conversation' : null,
    breakdown.drinking >= 0.8 ? 'drinks' : null,
    breakdown.dietary >= 0.8 ? 'dietary fit' : null,
    breakdown.setting >= 0.8 ? 'setting' : null,
    breakdown.music >= 0.8 ? 'music' : null,
    breakdown.cuisine >= 0.8 ? 'cuisine' : null,
  ].filter(Boolean) as string[]

  const tensions = [
    breakdown.energy <= 0.15 ? 'energy' : null,
    breakdown.vibe <= 0.15 ? 'vibe' : null,
    breakdown.scene <= 0.15 ? 'scene' : null,
    breakdown.price <= 0.15 ? 'price' : null,
    breakdown.crowd <= 0.15 ? 'crowd' : null,
    breakdown.location <= 0.15 ? 'location' : null,
    breakdown.conversation <= 0.15 ? 'conversation' : null,
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

  return 'Built from vibe, food, spend, and table fit.'
}

export function calculateRestaurantMatchScore(
  profile: ProfileForScoring,
  event: EventForScoring
) {
  const breakdown = buildVenueMatchBreakdown(profile, event)
  const weightedScore =
    breakdown.energy * 18 +
    breakdown.vibe * 16 +
    breakdown.cuisine * 12 +
    breakdown.price * 10 +
    breakdown.location * 12 +
    breakdown.conversation * 10 +
    breakdown.drinking * 5 +
    breakdown.dietary * 6 +
    breakdown.scene * 4 +
    breakdown.crowd * 3 +
    breakdown.setting * 3 +
    breakdown.music * 3 +
    breakdown.groupSize * 6 +
    breakdown.quality * 6

  return clampScore((weightedScore / 114) * 100)
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
