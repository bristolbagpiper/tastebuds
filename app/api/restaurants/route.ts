import { NextResponse } from 'next/server'

import {
  calculateDistanceKm,
  calculateRestaurantMatchScore,
  describeVenueMatch,
  type EventForScoring,
  type ProfileForScoring,
} from '@/lib/events'
import {
  createServerSupabaseAdminClient,
  getUserFromAccessToken,
} from '@/lib/supabase/server'

type ProfileRow = {
  bio: string | null
  cuisine_preferences: string[] | null
  display_name: string | null
  home_latitude: number | null
  home_longitude: number | null
  id: string
  intent: 'dating' | 'friendship' | null
  max_travel_minutes: number | null
  neighbourhood: string | null
  preferred_crowd: string[] | null
  preferred_energy: string[] | null
  preferred_music: string[] | null
  preferred_price: string[] | null
  preferred_scene: string[] | null
  preferred_setting: string[] | null
  subregion: string | null
}

type RestaurantRow = {
  cuisines: string[] | null
  formatted_address: string | null
  google_editorial_summary: string | null
  google_maps_uri: string | null
  google_price_level: string | null
  google_rating: number | null
  google_user_ratings_total: number | null
  google_website_uri: string | null
  id: number
  name: string
  neighbourhood: string | null
  subregion: string
  venue_crowd: string[] | null
  venue_energy: string | null
  venue_latitude: number | null
  venue_longitude: number | null
  venue_music: string[] | null
  venue_price: string | null
  venue_scene: string[] | null
  venue_setting: string[] | null
}

type EventRow = {
  id: number
  restaurant_id: number | null
  starts_at: string
  status: 'open' | 'closed' | 'cancelled'
  title: string
  viability_status: 'healthy' | 'at_risk' | 'forced_go' | 'cancelled_low_confirmations'
}

type SavedRestaurantRow = {
  restaurant_id: number
}

type MySignupRow = {
  event_id: number
  status: 'going' | 'waitlisted' | 'cancelled' | 'removed' | 'no_show' | 'attended'
}

function parseBearerToken(request: Request) {
  const authorization = request.headers.get('authorization')

  if (!authorization?.startsWith('Bearer ')) {
    return null
  }

  return authorization.slice('Bearer '.length)
}

export async function GET(request: Request) {
  const token = parseBearerToken(request)

  if (!token) {
    return NextResponse.json({ error: 'Missing bearer token.' }, { status: 401 })
  }

  try {
    const user = await getUserFromAccessToken(token)
    const adminClient = createServerSupabaseAdminClient()

    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select(
        'bio, cuisine_preferences, display_name, home_latitude, home_longitude, id, intent, max_travel_minutes, neighbourhood, preferred_crowd, preferred_energy, preferred_music, preferred_price, preferred_scene, preferred_setting, subregion'
      )
      .eq('id', user.id)
      .maybeSingle<ProfileRow>()

    if (profileError) {
      throw new Error(profileError.message)
    }

    if (
      !profile ||
      !profile.display_name ||
      profile.home_latitude === null ||
      profile.home_longitude === null ||
      !profile.subregion ||
      !profile.preferred_energy?.length ||
      !profile.preferred_scene?.length ||
      !profile.preferred_crowd?.length ||
      !profile.preferred_music?.length ||
      !profile.preferred_setting?.length ||
      !profile.preferred_price?.length
    ) {
      return NextResponse.json({
        ok: true,
        onboardingRequired: true,
        restaurants: [],
      })
    }

    const [restaurantsResponse, eventsResponse, savedResponse, mySignupsResponse] = await Promise.all([
      adminClient
        .from('restaurants')
        .select(
          'cuisines, formatted_address, google_editorial_summary, google_maps_uri, google_price_level, google_rating, google_user_ratings_total, google_website_uri, id, name, neighbourhood, subregion, venue_crowd, venue_energy, venue_latitude, venue_longitude, venue_music, venue_price, venue_scene, venue_setting'
        )
        .is('archived_at', null)
        .order('name', { ascending: true })
        .limit(80)
        .returns<RestaurantRow[]>(),
      adminClient
        .from('events')
        .select('id, restaurant_id, starts_at, status, title, viability_status')
        .neq('status', 'cancelled')
        .is('archived_at', null)
        .gte('starts_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('starts_at', { ascending: true })
        .returns<EventRow[]>(),
      adminClient
        .from('saved_restaurants')
        .select('restaurant_id')
        .eq('user_id', user.id)
        .returns<SavedRestaurantRow[]>(),
      adminClient
        .from('event_signups')
        .select('event_id, status')
        .eq('user_id', user.id)
        .in('status', ['going', 'waitlisted'])
        .returns<MySignupRow[]>(),
    ])

    if (restaurantsResponse.error) {
      throw new Error(restaurantsResponse.error.message)
    }

    if (eventsResponse.error) {
      throw new Error(eventsResponse.error.message)
    }

    if (savedResponse.error) {
      throw new Error(savedResponse.error.message)
    }

    if (mySignupsResponse.error) {
      throw new Error(mySignupsResponse.error.message)
    }

    const scoringProfile: ProfileForScoring = {
      bio: profile.bio,
      cuisine_preferences: profile.cuisine_preferences,
      home_latitude: profile.home_latitude,
      home_longitude: profile.home_longitude,
      id: profile.id,
      intent: profile.intent,
      max_travel_minutes: profile.max_travel_minutes,
      preferred_crowd: profile.preferred_crowd,
      preferred_energy: profile.preferred_energy,
      preferred_music: profile.preferred_music,
      preferred_price: profile.preferred_price,
      preferred_scene: profile.preferred_scene,
      preferred_setting: profile.preferred_setting,
      subregion: profile.subregion,
    }

    const savedRestaurantIds = new Set(
      (savedResponse.data ?? []).map((row) => row.restaurant_id)
    )
    const mySignupStatusByEventId = new Map(
      (mySignupsResponse.data ?? []).map((signup) => [signup.event_id, signup.status])
    )
    const eventsByRestaurantId = new Map<number, EventRow[]>()

    for (const event of eventsResponse.data ?? []) {
      if (event.restaurant_id === null) {
        continue
      }

      eventsByRestaurantId.set(event.restaurant_id, [
        ...(eventsByRestaurantId.get(event.restaurant_id) ?? []),
        event,
      ])
    }

    const restaurants = (restaurantsResponse.data ?? [])
      .map((restaurant) => {
        const scoringRestaurant: EventForScoring = {
          intent: profile.intent ?? 'friendship',
          restaurant_cuisines: restaurant.cuisines,
          restaurant_subregion: restaurant.subregion,
          venue_crowd: restaurant.venue_crowd,
          venue_energy: restaurant.venue_energy,
          venue_latitude: restaurant.venue_latitude,
          venue_longitude: restaurant.venue_longitude,
          venue_music: restaurant.venue_music,
          venue_price: restaurant.venue_price,
          venue_scene: restaurant.venue_scene,
          venue_setting: restaurant.venue_setting,
        }

        const availableEvents = (eventsByRestaurantId.get(restaurant.id) ?? [])
          .filter((event) => event.status === 'open')
          .slice(0, 3)
          .map((event) => ({
            id: event.id,
            signupStatus: mySignupStatusByEventId.get(event.id) ?? null,
            startsAt: event.starts_at,
            title: event.title,
            viabilityStatus: event.viability_status,
          }))

        const venueDistanceKm =
          profile.home_latitude !== null &&
          profile.home_longitude !== null &&
          restaurant.venue_latitude !== null &&
          restaurant.venue_longitude !== null
            ? Number(
                calculateDistanceKm(
                  profile.home_latitude,
                  profile.home_longitude,
                  restaurant.venue_latitude,
                  restaurant.venue_longitude
                ).toFixed(1)
              )
            : null

        return {
          availableEvents,
          availableEventCount: availableEvents.length,
          formattedAddress: restaurant.formatted_address,
          googleEditorialSummary: restaurant.google_editorial_summary,
          googleMapsUri: restaurant.google_maps_uri,
          googlePriceLevel: restaurant.google_price_level,
          googleRating: restaurant.google_rating,
          googleUserRatingsTotal: restaurant.google_user_ratings_total,
          googleWebsiteUri: restaurant.google_website_uri,
          id: restaurant.id,
          isSaved: savedRestaurantIds.has(restaurant.id),
          matchScore: calculateRestaurantMatchScore(scoringProfile, scoringRestaurant),
          name: restaurant.name,
          neighbourhood: restaurant.neighbourhood,
          restaurant_cuisines: restaurant.cuisines,
          subregion: restaurant.subregion,
          venueDistanceKm,
          venueMatchSummary: describeVenueMatch(scoringProfile, scoringRestaurant),
          venue_crowd: restaurant.venue_crowd,
          venue_energy: restaurant.venue_energy,
          venue_music: restaurant.venue_music,
          venue_price: restaurant.venue_price,
          venue_scene: restaurant.venue_scene,
          venue_setting: restaurant.venue_setting,
        }
      })
      .sort((left, right) => {
        if (Number(right.isSaved) !== Number(left.isSaved)) {
          return Number(right.isSaved) - Number(left.isSaved)
        }

        if (right.matchScore !== left.matchScore) {
          return right.matchScore - left.matchScore
        }

        return left.name.localeCompare(right.name)
      })

    return NextResponse.json({
      ok: true,
      onboardingRequired: false,
      restaurants,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to load restaurants.',
      },
      { status: 401 }
    )
  }
}

export async function POST(request: Request) {
  const token = parseBearerToken(request)

  if (!token) {
    return NextResponse.json({ error: 'Missing bearer token.' }, { status: 401 })
  }

  try {
    const user = await getUserFromAccessToken(token)
    const adminClient = createServerSupabaseAdminClient()
    const body = (await request.json()) as {
      action?: 'save' | 'unsave'
      restaurantId?: number
    }
    const restaurantId = Number(body.restaurantId)

    if (!Number.isInteger(restaurantId) || restaurantId <= 0) {
      return NextResponse.json(
        { error: 'restaurantId must be a valid positive integer.' },
        { status: 400 }
      )
    }

    if (body.action === 'unsave') {
      const { error } = await adminClient
        .from('saved_restaurants')
        .delete()
        .eq('restaurant_id', restaurantId)
        .eq('user_id', user.id)

      if (error) {
        throw new Error(error.message)
      }

      return NextResponse.json({ ok: true })
    }

    const { error } = await adminClient.from('saved_restaurants').insert({
      restaurant_id: restaurantId,
      user_id: user.id,
    })

    if (error && error.code !== '23505') {
      throw new Error(error.message)
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to update saved restaurants.',
      },
      { status: 401 }
    )
  }
}
