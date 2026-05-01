import { NextResponse } from 'next/server'

import {
  CROWD_TAGS,
  ENERGY_LEVELS,
  MANHATTAN_SUBREGIONS,
  MUSIC_TAGS,
  NOISE_LEVEL_TAGS,
  PRICE_TAGS,
  SCENE_TAGS,
  SETTING_TAGS,
  type ManhattanSubregion,
  normalizeCrowdList,
  normalizeCuisineList,
  normalizeIndoorOutdoorList,
  normalizeMenuExperienceList,
  normalizeMusicList,
  normalizeNoiseLevel,
  normalizeSceneList,
  normalizeSeatingTypeList,
  normalizeSettingList,
  normalizeVenueEnergy,
  normalizeVenueFormatList,
  normalizeVenuePrice,
  normalizeVibeList,
} from '@/lib/events'
import { queueNotifications } from '@/lib/notifications'
import { requireAdminOrCron } from '@/lib/request-auth'
import { createServerSupabaseAdminClient } from '@/lib/supabase/server'

type RestaurantAction = 'archive' | 'unarchive' | 'update'

type RestaurantPayload = {
  action?: RestaurantAction
  cuisines?: string[]
  formattedAddress?: string
  googleEditorialSummary?: string
  googleGoodForGroups?: boolean
  googleGoodForWatchingSports?: boolean
  googleLiveMusic?: boolean
  googleMapsUri?: string
  googleOpenNow?: boolean
  googleOpeningHours?: string[]
  googleOutdoorSeating?: boolean
  googlePhoneNumber?: string
  googlePlaceId?: string
  googlePriceLevel?: string
  googleRating?: number
  googleReservable?: boolean
  googleServesBeer?: boolean
  googleServesBrunch?: boolean
  googleServesCocktails?: boolean
  googleServesDessert?: boolean
  googleServesDinner?: boolean
  googleServesVegetarianFood?: boolean
  googleServesWine?: boolean
  googleUserRatingsTotal?: number
  googleWebsiteUri?: string
  menuExperienceTags?: string[]
  name?: string
  neighbourhood?: string
  restaurantId?: number
  subregion?: string
  venueCrowd?: string[]
  venueEnergy?: string
  venueFormats?: string[]
  venueGoodForCasualMeetups?: boolean
  venueGoodForCocktails?: boolean
  venueGoodForConversation?: boolean
  venueGoodForDinner?: boolean
  venueGroupFriendly?: boolean
  venueIndoorOutdoor?: string[]
  venueLatitude?: number
  venueLongitude?: number
  venueMusic?: string[]
  venueNoiseLevel?: string
  venuePrice?: string
  venueReservationFriendly?: boolean
  venueScene?: string[]
  venueSeatingTypes?: string[]
  venueSetting?: string[]
  venueVibes?: string[]
}

type RestaurantSummary = {
  archived_at: string | null
  created_at: string
  cuisines: string[]
  eventCount: number
  formatted_address: string | null
  google_editorial_summary: string | null
  google_good_for_groups: boolean | null
  google_good_for_watching_sports: boolean | null
  google_live_music: boolean | null
  google_maps_uri: string | null
  google_open_now: boolean | null
  google_opening_hours: string[]
  google_outdoor_seating: boolean | null
  google_phone_number: string | null
  google_place_id: string | null
  google_price_level: string | null
  google_rating: number | null
  google_reservable: boolean | null
  google_serves_beer: boolean | null
  google_serves_brunch: boolean | null
  google_serves_cocktails: boolean | null
  google_serves_dessert: boolean | null
  google_serves_dinner: boolean | null
  google_serves_vegetarian_food: boolean | null
  google_serves_wine: boolean | null
  google_user_ratings_total: number | null
  google_website_uri: string | null
  id: number
  menu_experience_tags: string[]
  name: string
  neighbourhood: string | null
  subregion: ManhattanSubregion
  upcomingEventCount: number
  venue_crowd: string[]
  venue_energy: string | null
  venue_formats: string[]
  venue_good_for_casual_meetups: boolean | null
  venue_good_for_cocktails: boolean | null
  venue_good_for_conversation: boolean | null
  venue_good_for_dinner: boolean | null
  venue_group_friendly: boolean | null
  venue_indoor_outdoor: string[]
  venue_latitude: number | null
  venue_longitude: number | null
  venue_music: string[]
  venue_noise_level: string | null
  venue_price: string | null
  venue_reservation_friendly: boolean | null
  venue_scene: string[]
  venue_seating_types: string[]
  venue_setting: string[]
  venue_vibes: string[]
}

type SavedRestaurantUserRow = {
  user_id: string
}

const RESTAURANT_SELECT =
  'archived_at, created_at, cuisines, formatted_address, google_editorial_summary, google_good_for_groups, google_good_for_watching_sports, google_live_music, google_maps_uri, google_open_now, google_opening_hours, google_outdoor_seating, google_phone_number, google_place_id, google_price_level, google_rating, google_reservable, google_serves_beer, google_serves_brunch, google_serves_cocktails, google_serves_dessert, google_serves_dinner, google_serves_vegetarian_food, google_serves_wine, google_user_ratings_total, google_website_uri, id, menu_experience_tags, name, neighbourhood, subregion, venue_crowd, venue_energy, venue_formats, venue_good_for_casual_meetups, venue_good_for_cocktails, venue_good_for_conversation, venue_good_for_dinner, venue_group_friendly, venue_indoor_outdoor, venue_latitude, venue_longitude, venue_music, venue_noise_level, venue_price, venue_reservation_friendly, venue_scene, venue_seating_types, venue_setting, venue_vibes'

function isValidSubregion(value: string) {
  return MANHATTAN_SUBREGIONS.includes(value as ManhattanSubregion)
}

function hasAnyValues(values: string[]) {
  return values.length > 0
}

async function fetchRestaurants() {
  const adminClient = createServerSupabaseAdminClient()
  const { data: restaurants, error } = await adminClient
    .from('restaurants')
    .select(RESTAURANT_SELECT)
    .order('name', { ascending: true })
    .returns<
      Omit<RestaurantSummary, 'eventCount' | 'upcomingEventCount'>[]
    >()

  if (error) {
    throw new Error(error.message)
  }

  const restaurantIds = (restaurants ?? []).map((restaurant) => restaurant.id)
  const { data: eventRows, error: eventError } = restaurantIds.length
    ? await adminClient
        .from('events')
        .select('restaurant_id, starts_at, status')
        .in('restaurant_id', restaurantIds)
        .returns<
          {
            restaurant_id: number | null
            starts_at: string
            status: 'open' | 'closed' | 'cancelled'
          }[]
        >()
    : { data: [], error: null }

  if (eventError) {
    throw new Error(eventError.message)
  }

  const eventCountByRestaurant = new Map<number, number>()
  const upcomingCountByRestaurant = new Map<number, number>()
  const nowIso = new Date().toISOString()

  for (const event of eventRows ?? []) {
    if (event.restaurant_id === null) {
      continue
    }

    eventCountByRestaurant.set(
      event.restaurant_id,
      (eventCountByRestaurant.get(event.restaurant_id) ?? 0) + 1
    )

    if (event.status !== 'cancelled' && event.starts_at >= nowIso) {
      upcomingCountByRestaurant.set(
        event.restaurant_id,
        (upcomingCountByRestaurant.get(event.restaurant_id) ?? 0) + 1
      )
    }
  }

  return (restaurants ?? []).map((restaurant) => ({
    ...restaurant,
    eventCount: eventCountByRestaurant.get(restaurant.id) ?? 0,
    upcomingEventCount: upcomingCountByRestaurant.get(restaurant.id) ?? 0,
  }))
}

export async function GET(request: Request) {
  const adminCheck = await requireAdminOrCron(request, {
    allowAdmin: true,
    allowCron: false,
  })

  if ('error' in adminCheck) {
    return adminCheck.error
  }

  try {
    const restaurants = await fetchRestaurants()

    return NextResponse.json({
      ok: true,
      restaurants,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to load restaurants.',
      },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  const adminCheck = await requireAdminOrCron(request, {
    allowAdmin: true,
    allowCron: false,
  })

  if ('error' in adminCheck) {
    return adminCheck.error
  }

  let body: RestaurantPayload = {}

  try {
    body = (await request.json()) as RestaurantPayload
  } catch {
    body = {}
  }

  const name = body.name?.trim()
  const neighbourhood = body.neighbourhood?.trim() ?? ''
  const subregion = body.subregion?.trim() ?? ''
  const cuisines = normalizeCuisineList(body.cuisines ?? [])
  const venueEnergy = normalizeVenueEnergy(body.venueEnergy)
  const venuePrice = normalizeVenuePrice(body.venuePrice)
  const venueScene = normalizeSceneList(body.venueScene ?? [])
  const venueCrowd = normalizeCrowdList(body.venueCrowd ?? [])
  const venueMusic = normalizeMusicList(body.venueMusic ?? [])
  const venueSetting = normalizeSettingList(body.venueSetting ?? [])
  const venueFormats = normalizeVenueFormatList(body.venueFormats ?? [])
  const venueIndoorOutdoor = normalizeIndoorOutdoorList(body.venueIndoorOutdoor ?? [])
  const venueSeatingTypes = normalizeSeatingTypeList(body.venueSeatingTypes ?? [])
  const venueVibes = normalizeVibeList(body.venueVibes ?? [])
  const menuExperienceTags = normalizeMenuExperienceList(body.menuExperienceTags ?? [])
  const venueNoiseLevel = normalizeNoiseLevel(body.venueNoiseLevel)
  const venueLatitude = Number(body.venueLatitude)
  const venueLongitude = Number(body.venueLongitude)
  const googleRating =
    typeof body.googleRating === 'number' && Number.isFinite(body.googleRating)
      ? body.googleRating
      : null
  const googleUserRatingsTotal =
    typeof body.googleUserRatingsTotal === 'number' &&
    Number.isInteger(body.googleUserRatingsTotal) &&
    body.googleUserRatingsTotal >= 0
      ? body.googleUserRatingsTotal
      : null

  if (!name || !isValidSubregion(subregion)) {
    return NextResponse.json(
      { error: 'name and a valid subregion are required.' },
      { status: 400 }
    )
  }

  if (!venueEnergy || !venuePrice) {
    return NextResponse.json(
      {
        error: `venueEnergy and venuePrice are required. Allowed values: energy ${ENERGY_LEVELS.join(', ')}, price ${PRICE_TAGS.join(', ')}.`,
      },
      { status: 400 }
    )
  }

  if (
    !hasAnyValues(venueScene) ||
    !hasAnyValues(venueCrowd) ||
    !hasAnyValues(venueMusic) ||
    !hasAnyValues(venueSetting)
  ) {
    return NextResponse.json(
      {
        error: `scene, crowd, music, and setting each need at least one tag. Allowed tags: scene ${SCENE_TAGS.join(', ')}, crowd ${CROWD_TAGS.join(', ')}, music ${MUSIC_TAGS.join(', ')}, setting ${SETTING_TAGS.join(', ')}.`,
      },
      { status: 400 }
    )
  }

  if (
    !Number.isFinite(venueLatitude) ||
    venueLatitude < -90 ||
    venueLatitude > 90 ||
    !Number.isFinite(venueLongitude) ||
    venueLongitude < -180 ||
    venueLongitude > 180
  ) {
    return NextResponse.json(
      { error: 'venueLatitude and venueLongitude must be valid coordinates.' },
      { status: 400 }
    )
  }

  try {
    const adminClient = createServerSupabaseAdminClient()
    const { data: restaurant, error } = await adminClient
      .from('restaurants')
      .insert({
        created_by: adminCheck.kind === 'admin' ? adminCheck.user.id : null,
        cuisines,
        formatted_address: body.formattedAddress?.trim() || null,
        google_editorial_summary: body.googleEditorialSummary?.trim() || null,
        google_good_for_groups: body.googleGoodForGroups ?? null,
        google_good_for_watching_sports: body.googleGoodForWatchingSports ?? null,
        google_live_music: body.googleLiveMusic ?? null,
        google_maps_uri: body.googleMapsUri?.trim() || null,
        google_open_now: body.googleOpenNow ?? null,
        google_opening_hours: body.googleOpeningHours ?? [],
        google_outdoor_seating: body.googleOutdoorSeating ?? null,
        google_phone_number: body.googlePhoneNumber?.trim() || null,
        google_place_id: body.googlePlaceId?.trim() || null,
        google_price_level: body.googlePriceLevel?.trim() || null,
        google_rating: googleRating,
        google_reservable: body.googleReservable ?? null,
        google_serves_beer: body.googleServesBeer ?? null,
        google_serves_brunch: body.googleServesBrunch ?? null,
        google_serves_cocktails: body.googleServesCocktails ?? null,
        google_serves_dessert: body.googleServesDessert ?? null,
        google_serves_dinner: body.googleServesDinner ?? null,
        google_serves_vegetarian_food: body.googleServesVegetarianFood ?? null,
        google_serves_wine: body.googleServesWine ?? null,
        google_user_ratings_total: googleUserRatingsTotal,
        google_website_uri: body.googleWebsiteUri?.trim() || null,
        menu_experience_tags: menuExperienceTags,
        name,
        neighbourhood: neighbourhood || null,
        subregion,
        venue_crowd: venueCrowd,
        venue_energy: venueEnergy,
        venue_formats: venueFormats,
        venue_good_for_casual_meetups: body.venueGoodForCasualMeetups ?? null,
        venue_good_for_cocktails:
          body.venueGoodForCocktails ?? body.googleServesCocktails ?? null,
        venue_good_for_conversation: body.venueGoodForConversation ?? null,
        venue_good_for_dinner:
          body.venueGoodForDinner ?? body.googleServesDinner ?? null,
        venue_group_friendly:
          body.venueGroupFriendly ?? body.googleGoodForGroups ?? null,
        venue_indoor_outdoor: venueIndoorOutdoor,
        venue_latitude: venueLatitude,
        venue_longitude: venueLongitude,
        venue_music: venueMusic,
        venue_noise_level: venueNoiseLevel,
        venue_price: venuePrice,
        venue_reservation_friendly:
          body.venueReservationFriendly ?? body.googleReservable ?? null,
        venue_scene: venueScene,
        venue_seating_types: venueSeatingTypes,
        venue_setting: venueSetting,
        venue_vibes: venueVibes,
      })
      .select(RESTAURANT_SELECT)
      .single<Omit<RestaurantSummary, 'eventCount' | 'upcomingEventCount'>>()

    if (error || !restaurant) {
      throw new Error(error?.message ?? 'Failed to create restaurant.')
    }

    return NextResponse.json({
      ok: true,
      restaurant: {
        ...restaurant,
        eventCount: 0,
        upcomingEventCount: 0,
      } satisfies RestaurantSummary,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to create restaurant.',
      },
      { status: 500 }
    )
  }
}

export async function PATCH(request: Request) {
  const adminCheck = await requireAdminOrCron(request, {
    allowAdmin: true,
    allowCron: false,
  })

  if ('error' in adminCheck) {
    return adminCheck.error
  }

  let body: RestaurantPayload = {}

  try {
    body = (await request.json()) as RestaurantPayload
  } catch {
    body = {}
  }

  const restaurantId = Number(body.restaurantId)

  if (!Number.isInteger(restaurantId) || restaurantId <= 0) {
    return NextResponse.json(
      { error: 'restaurantId must be a valid positive integer.' },
      { status: 400 }
    )
  }

  const action = body.action ?? 'update'
  const updates: Record<string, unknown> = {}

  if (action === 'archive') {
    updates.archived_at = new Date().toISOString()
  } else if (action === 'unarchive') {
    updates.archived_at = null
  }

  if (typeof body.name === 'string') {
    const nextName = body.name.trim()
    if (!nextName) {
      return NextResponse.json({ error: 'name cannot be empty.' }, { status: 400 })
    }
    updates.name = nextName
  }

  if (typeof body.neighbourhood === 'string') {
    const nextNeighbourhood = body.neighbourhood.trim()
    updates.neighbourhood = nextNeighbourhood || null
  }

  if (typeof body.subregion === 'string') {
    const nextSubregion = body.subregion.trim()
    if (!isValidSubregion(nextSubregion)) {
      return NextResponse.json(
        { error: 'subregion must be Uptown, Midtown, or Downtown.' },
        { status: 400 }
      )
    }
    updates.subregion = nextSubregion
  }

  if (Array.isArray(body.cuisines)) {
    updates.cuisines = normalizeCuisineList(body.cuisines)
  }

  if (typeof body.formattedAddress === 'string') {
    updates.formatted_address = body.formattedAddress.trim() || null
  }

  if (typeof body.googleEditorialSummary === 'string') {
    updates.google_editorial_summary = body.googleEditorialSummary.trim() || null
  }

  if (typeof body.googleGoodForGroups === 'boolean') {
    updates.google_good_for_groups = body.googleGoodForGroups
  }

  if (typeof body.googleGoodForWatchingSports === 'boolean') {
    updates.google_good_for_watching_sports = body.googleGoodForWatchingSports
  }

  if (typeof body.googleLiveMusic === 'boolean') {
    updates.google_live_music = body.googleLiveMusic
  }

  if (typeof body.googleMapsUri === 'string') {
    updates.google_maps_uri = body.googleMapsUri.trim() || null
  }

  if (typeof body.googleOpenNow === 'boolean') {
    updates.google_open_now = body.googleOpenNow
  }

  if (Array.isArray(body.googleOpeningHours)) {
    updates.google_opening_hours = body.googleOpeningHours.map((value) => value.trim()).filter(Boolean)
  }

  if (typeof body.googleOutdoorSeating === 'boolean') {
    updates.google_outdoor_seating = body.googleOutdoorSeating
  }

  if (typeof body.googlePhoneNumber === 'string') {
    updates.google_phone_number = body.googlePhoneNumber.trim() || null
  }

  if (typeof body.googlePlaceId === 'string') {
    updates.google_place_id = body.googlePlaceId.trim() || null
  }

  if (typeof body.googlePriceLevel === 'string') {
    updates.google_price_level = body.googlePriceLevel.trim() || null
  }

  if (typeof body.googleReservable === 'boolean') {
    updates.google_reservable = body.googleReservable
  }

  if (typeof body.googleServesBeer === 'boolean') {
    updates.google_serves_beer = body.googleServesBeer
  }

  if (typeof body.googleServesBrunch === 'boolean') {
    updates.google_serves_brunch = body.googleServesBrunch
  }

  if (typeof body.googleServesCocktails === 'boolean') {
    updates.google_serves_cocktails = body.googleServesCocktails
  }

  if (typeof body.googleServesDessert === 'boolean') {
    updates.google_serves_dessert = body.googleServesDessert
  }

  if (typeof body.googleServesDinner === 'boolean') {
    updates.google_serves_dinner = body.googleServesDinner
  }

  if (typeof body.googleServesVegetarianFood === 'boolean') {
    updates.google_serves_vegetarian_food = body.googleServesVegetarianFood
  }

  if (typeof body.googleServesWine === 'boolean') {
    updates.google_serves_wine = body.googleServesWine
  }

  if (typeof body.googleWebsiteUri === 'string') {
    updates.google_website_uri = body.googleWebsiteUri.trim() || null
  }

  if (typeof body.googleRating === 'number') {
    if (!Number.isFinite(body.googleRating) || body.googleRating < 0 || body.googleRating > 5) {
      return NextResponse.json(
        { error: 'googleRating must be between 0 and 5.' },
        { status: 400 }
      )
    }
    updates.google_rating = body.googleRating
  }

  if (typeof body.googleUserRatingsTotal === 'number') {
    if (!Number.isInteger(body.googleUserRatingsTotal) || body.googleUserRatingsTotal < 0) {
      return NextResponse.json(
        { error: 'googleUserRatingsTotal must be a non-negative integer.' },
        { status: 400 }
      )
    }
    updates.google_user_ratings_total = body.googleUserRatingsTotal
  }

  if (typeof body.venueEnergy === 'string') {
    const nextVenueEnergy = normalizeVenueEnergy(body.venueEnergy)
    if (!nextVenueEnergy) {
      return NextResponse.json(
        { error: `venueEnergy must be one of ${ENERGY_LEVELS.join(', ')}.` },
        { status: 400 }
      )
    }
    updates.venue_energy = nextVenueEnergy
  }

  if (typeof body.venuePrice === 'string') {
    const nextVenuePrice = normalizeVenuePrice(body.venuePrice)
    if (!nextVenuePrice) {
      return NextResponse.json(
        { error: `venuePrice must be one of ${PRICE_TAGS.join(', ')}.` },
        { status: 400 }
      )
    }
    updates.venue_price = nextVenuePrice
  }

  if (Array.isArray(body.venueScene)) {
    const nextScene = normalizeSceneList(body.venueScene)
    if (!hasAnyValues(nextScene)) {
      return NextResponse.json(
        { error: `venueScene needs at least one of ${SCENE_TAGS.join(', ')}.` },
        { status: 400 }
      )
    }
    updates.venue_scene = nextScene
  }

  if (Array.isArray(body.venueCrowd)) {
    const nextCrowd = normalizeCrowdList(body.venueCrowd)
    if (!hasAnyValues(nextCrowd)) {
      return NextResponse.json(
        { error: `venueCrowd needs at least one of ${CROWD_TAGS.join(', ')}.` },
        { status: 400 }
      )
    }
    updates.venue_crowd = nextCrowd
  }

  if (Array.isArray(body.venueMusic)) {
    const nextMusic = normalizeMusicList(body.venueMusic)
    if (!hasAnyValues(nextMusic)) {
      return NextResponse.json(
        { error: `venueMusic needs at least one of ${MUSIC_TAGS.join(', ')}.` },
        { status: 400 }
      )
    }
    updates.venue_music = nextMusic
  }

  if (Array.isArray(body.venueSetting)) {
    const nextSetting = normalizeSettingList(body.venueSetting)
    if (!hasAnyValues(nextSetting)) {
      return NextResponse.json(
        { error: `venueSetting needs at least one of ${SETTING_TAGS.join(', ')}.` },
        { status: 400 }
      )
    }
    updates.venue_setting = nextSetting
  }

  if (typeof body.venueNoiseLevel === 'string') {
    const nextNoiseLevel = normalizeNoiseLevel(body.venueNoiseLevel)
    if (!nextNoiseLevel) {
      return NextResponse.json(
        { error: `venueNoiseLevel must be one of ${NOISE_LEVEL_TAGS.join(', ')}.` },
        { status: 400 }
      )
    }
    updates.venue_noise_level = nextNoiseLevel
  }

  if (Array.isArray(body.venueSeatingTypes)) {
    updates.venue_seating_types = normalizeSeatingTypeList(body.venueSeatingTypes)
  }

  if (Array.isArray(body.venueFormats)) {
    updates.venue_formats = normalizeVenueFormatList(body.venueFormats)
  }

  if (Array.isArray(body.venueIndoorOutdoor)) {
    updates.venue_indoor_outdoor = normalizeIndoorOutdoorList(body.venueIndoorOutdoor)
  }

  if (Array.isArray(body.venueVibes)) {
    updates.venue_vibes = normalizeVibeList(body.venueVibes)
  }

  if (Array.isArray(body.menuExperienceTags)) {
    updates.menu_experience_tags = normalizeMenuExperienceList(body.menuExperienceTags)
  }

  if (typeof body.venueReservationFriendly === 'boolean') {
    updates.venue_reservation_friendly = body.venueReservationFriendly
  }

  if (typeof body.venueGroupFriendly === 'boolean') {
    updates.venue_group_friendly = body.venueGroupFriendly
  }

  if (typeof body.venueGoodForConversation === 'boolean') {
    updates.venue_good_for_conversation = body.venueGoodForConversation
  }

  if (typeof body.venueGoodForCocktails === 'boolean') {
    updates.venue_good_for_cocktails = body.venueGoodForCocktails
  }

  if (typeof body.venueGoodForDinner === 'boolean') {
    updates.venue_good_for_dinner = body.venueGoodForDinner
  }

  if (typeof body.venueGoodForCasualMeetups === 'boolean') {
    updates.venue_good_for_casual_meetups = body.venueGoodForCasualMeetups
  }

  if (typeof body.venueLatitude === 'number') {
    if (
      !Number.isFinite(body.venueLatitude) ||
      body.venueLatitude < -90 ||
      body.venueLatitude > 90
    ) {
      return NextResponse.json(
        { error: 'venueLatitude must be between -90 and 90.' },
        { status: 400 }
      )
    }
    updates.venue_latitude = body.venueLatitude
  }

  if (typeof body.venueLongitude === 'number') {
    if (
      !Number.isFinite(body.venueLongitude) ||
      body.venueLongitude < -180 ||
      body.venueLongitude > 180
    ) {
      return NextResponse.json(
        { error: 'venueLongitude must be between -180 and 180.' },
        { status: 400 }
      )
    }
    updates.venue_longitude = body.venueLongitude
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: 'No valid fields supplied for update.' },
      { status: 400 }
    )
  }

  try {
    const adminClient = createServerSupabaseAdminClient()
    const { data: restaurant, error } = await adminClient
      .from('restaurants')
      .update(updates)
      .eq('id', restaurantId)
      .select(RESTAURANT_SELECT)
      .maybeSingle<Omit<RestaurantSummary, 'eventCount' | 'upcomingEventCount'>>()

    if (error) {
      throw new Error(error.message)
    }

    if (!restaurant) {
      return NextResponse.json({ error: 'Restaurant not found.' }, { status: 404 })
    }

    const restaurants = await fetchRestaurants()
    const nextRestaurant = restaurants.find((entry) => entry.id === restaurantId)

    return NextResponse.json({
      ok: true,
      restaurant: nextRestaurant ?? {
        ...restaurant,
        eventCount: 0,
        upcomingEventCount: 0,
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to update restaurant.',
      },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  const adminCheck = await requireAdminOrCron(request, {
    allowAdmin: true,
    allowCron: false,
  })

  if ('error' in adminCheck) {
    return adminCheck.error
  }

  let body: { restaurantId?: number } = {}

  try {
    body = (await request.json()) as { restaurantId?: number }
  } catch {
    body = {}
  }

  const restaurantId = Number(body.restaurantId)

  if (!Number.isInteger(restaurantId) || restaurantId <= 0) {
    return NextResponse.json(
      { error: 'restaurantId must be a valid positive integer.' },
      { status: 400 }
    )
  }

  const adminClient = createServerSupabaseAdminClient()
  const [
    restaurantResponse,
    savedRestaurantUsersResponse,
    eventsCountResponse,
  ] = await Promise.all([
    adminClient
      .from('restaurants')
      .select('id, name')
      .eq('id', restaurantId)
      .maybeSingle<{ id: number; name: string }>(),
    adminClient
      .from('saved_restaurants')
      .select('user_id')
      .eq('restaurant_id', restaurantId)
      .returns<SavedRestaurantUserRow[]>(),
    adminClient
      .from('events')
      .select('id', { count: 'exact', head: true })
      .eq('restaurant_id', restaurantId),
  ])

  const restaurant = restaurantResponse.data

  if (restaurantResponse.error) {
    return NextResponse.json(
      { error: restaurantResponse.error.message },
      { status: 500 }
    )
  }

  if (!restaurant) {
    return NextResponse.json({ error: 'Restaurant not found.' }, { status: 404 })
  }

  if (savedRestaurantUsersResponse.error) {
    return NextResponse.json(
      { error: savedRestaurantUsersResponse.error.message },
      { status: 500 }
    )
  }

  if (eventsCountResponse.error) {
    return NextResponse.json(
      { error: eventsCountResponse.error.message },
      { status: 500 }
    )
  }

  const count = eventsCountResponse.count

  if ((count ?? 0) > 0) {
    const { error: deleteEventsError } = await adminClient
      .from('events')
      .delete()
      .eq('restaurant_id', restaurantId)

    if (deleteEventsError) {
      return NextResponse.json(
        { error: deleteEventsError.message },
        { status: 500 }
      )
    }
  }

  const { error } = await adminClient.from('restaurants').delete().eq('id', restaurantId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const savedUserIds = Array.from(
    new Set((savedRestaurantUsersResponse.data ?? []).map((row) => row.user_id))
  )

  if (savedUserIds.length > 0) {
    try {
      await queueNotifications(
        savedUserIds.map((userId) => ({
          body:
            `${restaurant.name} has been removed from Tastebuds, so we removed it from your saved restaurants. We will keep suggesting nearby tables that fit your taste profile.`,
          eventId: null,
          title: 'Saved restaurant removed',
          type: 'restaurant_removed',
          userId,
        }))
      )
    } catch (notificationError) {
      return NextResponse.json(
        {
          error:
            notificationError instanceof Error
              ? notificationError.message
              : 'Restaurant was deleted, but notifications could not be queued.',
        },
        { status: 500 }
      )
    }
  }

  return NextResponse.json({ ok: true })
}
