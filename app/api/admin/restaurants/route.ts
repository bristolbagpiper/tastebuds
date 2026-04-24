import { NextResponse } from 'next/server'

import {
  CROWD_TAGS,
  ENERGY_LEVELS,
  MANHATTAN_SUBREGIONS,
  MUSIC_TAGS,
  PRICE_TAGS,
  SCENE_TAGS,
  SETTING_TAGS,
  type ManhattanSubregion,
  normalizeCrowdList,
  normalizeCuisineList,
  normalizeMusicList,
  normalizeSceneList,
  normalizeSettingList,
  normalizeVenueEnergy,
  normalizeVenuePrice,
} from '@/lib/events'
import { requireAdminOrCron } from '@/lib/request-auth'
import { createServerSupabaseAdminClient } from '@/lib/supabase/server'

type RestaurantAction = 'archive' | 'unarchive' | 'update'

type RestaurantPayload = {
  action?: RestaurantAction
  cuisines?: string[]
  formattedAddress?: string
  googleEditorialSummary?: string
  googleMapsUri?: string
  googlePhoneNumber?: string
  googlePlaceId?: string
  googlePriceLevel?: string
  googleRating?: number
  googleUserRatingsTotal?: number
  googleWebsiteUri?: string
  name?: string
  neighbourhood?: string
  restaurantId?: number
  subregion?: string
  venueCrowd?: string[]
  venueEnergy?: string
  venueLatitude?: number
  venueLongitude?: number
  venueMusic?: string[]
  venuePrice?: string
  venueScene?: string[]
  venueSetting?: string[]
}

type RestaurantSummary = {
  archived_at: string | null
  created_at: string
  cuisines: string[]
  eventCount: number
  formatted_address: string | null
  google_editorial_summary: string | null
  google_maps_uri: string | null
  google_phone_number: string | null
  google_place_id: string | null
  google_price_level: string | null
  google_rating: number | null
  google_user_ratings_total: number | null
  google_website_uri: string | null
  id: number
  name: string
  neighbourhood: string | null
  subregion: ManhattanSubregion
  upcomingEventCount: number
  venue_crowd: string[]
  venue_energy: string | null
  venue_latitude: number | null
  venue_longitude: number | null
  venue_music: string[]
  venue_price: string | null
  venue_scene: string[]
  venue_setting: string[]
}

const RESTAURANT_SELECT =
  'archived_at, created_at, cuisines, formatted_address, google_editorial_summary, google_maps_uri, google_phone_number, google_place_id, google_price_level, google_rating, google_user_ratings_total, google_website_uri, id, name, neighbourhood, subregion, venue_crowd, venue_energy, venue_latitude, venue_longitude, venue_music, venue_price, venue_scene, venue_setting'

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
        google_maps_uri: body.googleMapsUri?.trim() || null,
        google_phone_number: body.googlePhoneNumber?.trim() || null,
        google_place_id: body.googlePlaceId?.trim() || null,
        google_price_level: body.googlePriceLevel?.trim() || null,
        google_rating: googleRating,
        google_user_ratings_total: googleUserRatingsTotal,
        google_website_uri: body.googleWebsiteUri?.trim() || null,
        name,
        neighbourhood: neighbourhood || null,
        subregion,
        venue_crowd: venueCrowd,
        venue_energy: venueEnergy,
        venue_latitude: venueLatitude,
        venue_longitude: venueLongitude,
        venue_music: venueMusic,
        venue_price: venuePrice,
        venue_scene: venueScene,
        venue_setting: venueSetting,
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

  if (typeof body.googleMapsUri === 'string') {
    updates.google_maps_uri = body.googleMapsUri.trim() || null
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
  const { count, error: countError } = await adminClient
    .from('events')
    .select('id', { count: 'exact', head: true })
    .eq('restaurant_id', restaurantId)

  if (countError) {
    return NextResponse.json({ error: countError.message }, { status: 500 })
  }

  if ((count ?? 0) > 0) {
    return NextResponse.json(
      {
        error:
          'This restaurant is already referenced by events. Archive it instead of deleting it.',
      },
      { status: 400 }
    )
  }

  const { error } = await adminClient.from('restaurants').delete().eq('id', restaurantId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
