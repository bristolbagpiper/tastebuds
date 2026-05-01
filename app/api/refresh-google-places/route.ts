import { NextResponse } from 'next/server'

import { getRestaurantPoiDetails } from '@/lib/google-places'
import { requireAdminOrCron } from '@/lib/request-auth'
import { createServerSupabaseAdminClient } from '@/lib/supabase/server'

type RestaurantPlaceRow = {
  google_place_id: string | null
  id: number
}

type GoogleRefreshUpdate = {
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
  google_place_id: string
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
  venue_latitude?: number
  venue_longitude?: number
}

type EventGoogleRefreshUpdate = Pick<
  GoogleRefreshUpdate,
  | 'google_good_for_groups'
  | 'google_good_for_watching_sports'
  | 'google_live_music'
  | 'google_open_now'
  | 'google_opening_hours'
  | 'google_outdoor_seating'
  | 'google_reservable'
  | 'google_serves_beer'
  | 'google_serves_brunch'
  | 'google_serves_cocktails'
  | 'google_serves_dessert'
  | 'google_serves_dinner'
  | 'google_serves_vegetarian_food'
  | 'google_serves_wine'
> & {
  venue_latitude?: number
  venue_longitude?: number
}

const REFRESH_LIMIT = 100

function buildGoogleUpdate(
  placeId: string,
  details: Awaited<ReturnType<typeof getRestaurantPoiDetails>>
): GoogleRefreshUpdate {
  return {
    formatted_address: details.formattedAddress,
    google_editorial_summary: details.editorialSummary,
    google_good_for_groups: details.goodForGroups,
    google_good_for_watching_sports: details.goodForWatchingSports,
    google_live_music: details.liveMusic,
    google_maps_uri: details.googleMapsUri,
    google_open_now: details.openNow,
    google_opening_hours: details.openingHours,
    google_outdoor_seating: details.outdoorSeating,
    google_phone_number: details.phoneNumber,
    google_place_id: details.id ?? placeId,
    google_price_level: details.priceLevel,
    google_rating: details.rating,
    google_reservable: details.reservable,
    google_serves_beer: details.servesBeer,
    google_serves_brunch: details.servesBrunch,
    google_serves_cocktails: details.servesCocktails,
    google_serves_dessert: details.servesDessert,
    google_serves_dinner: details.servesDinner,
    google_serves_vegetarian_food: details.servesVegetarianFood,
    google_serves_wine: details.servesWine,
    google_user_ratings_total: details.userRatingCount,
    google_website_uri: details.websiteUri,
    ...(typeof details.latitude === 'number' ? { venue_latitude: details.latitude } : {}),
    ...(typeof details.longitude === 'number' ? { venue_longitude: details.longitude } : {}),
  }
}

function buildEventGoogleUpdate(update: GoogleRefreshUpdate): EventGoogleRefreshUpdate {
  return {
    google_good_for_groups: update.google_good_for_groups,
    google_good_for_watching_sports: update.google_good_for_watching_sports,
    google_live_music: update.google_live_music,
    google_open_now: update.google_open_now,
    google_opening_hours: update.google_opening_hours,
    google_outdoor_seating: update.google_outdoor_seating,
    google_reservable: update.google_reservable,
    google_serves_beer: update.google_serves_beer,
    google_serves_brunch: update.google_serves_brunch,
    google_serves_cocktails: update.google_serves_cocktails,
    google_serves_dessert: update.google_serves_dessert,
    google_serves_dinner: update.google_serves_dinner,
    google_serves_vegetarian_food: update.google_serves_vegetarian_food,
    google_serves_wine: update.google_serves_wine,
    ...(typeof update.venue_latitude === 'number'
      ? { venue_latitude: update.venue_latitude }
      : {}),
    ...(typeof update.venue_longitude === 'number'
      ? { venue_longitude: update.venue_longitude }
      : {}),
  }
}

async function refreshGooglePlaces(request: Request) {
  const auth = await requireAdminOrCron(request, {
    allowAdmin: true,
    allowCron: true,
  })

  if ('error' in auth) {
    return auth.error
  }

  try {
    const adminClient = createServerSupabaseAdminClient()
    const { data: restaurants, error } = await adminClient
      .from('restaurants')
      .select('google_place_id, id')
      .is('archived_at', null)
      .not('google_place_id', 'is', null)
      .order('created_at', { ascending: true })
      .limit(REFRESH_LIMIT)
      .returns<RestaurantPlaceRow[]>()

    if (error) {
      throw new Error(error.message)
    }

    const failures: { error: string; restaurantId: number }[] = []
    let updated = 0

    for (const restaurant of restaurants ?? []) {
      const placeId = restaurant.google_place_id

      if (!placeId) {
        continue
      }

      try {
        const details = await getRestaurantPoiDetails(placeId)
        const update = buildGoogleUpdate(placeId, details)

        const { error: restaurantUpdateError } = await adminClient
          .from('restaurants')
          .update(update)
          .eq('id', restaurant.id)

        if (restaurantUpdateError) {
          throw new Error(restaurantUpdateError.message)
        }

        const { error: eventUpdateError } = await adminClient
          .from('events')
          .update(buildEventGoogleUpdate(update))
          .eq('restaurant_id', restaurant.id)
          .gte('starts_at', new Date().toISOString())
          .neq('status', 'cancelled')

        if (eventUpdateError) {
          throw new Error(eventUpdateError.message)
        }

        updated += 1
      } catch (refreshError) {
        failures.push({
          error:
            refreshError instanceof Error
              ? refreshError.message
              : 'Google refresh failed.',
          restaurantId: restaurant.id,
        })
      }
    }

    return NextResponse.json({
      failed: failures.length,
      failures,
      ok: true,
      updated,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to refresh Google place data.',
      },
      { status: 500 }
    )
  }
}

export async function GET(request: Request) {
  return refreshGooglePlaces(request)
}

export async function POST(request: Request) {
  return refreshGooglePlaces(request)
}
