import { NextResponse } from 'next/server'

import {
  calculateDistanceKm,
  describeVenueMatch,
  calculateRestaurantMatchScore,
  type EventForScoring,
  type ProfileForScoring,
} from '@/lib/events'
import { getVisibleEventsForSavedRestaurants } from '@/lib/app/event-visibility'
import { hasEventStarted, isSameEventDayInNewYork } from '@/lib/event-time'
import {
  createServerSupabaseAdminClient,
  getUserFromAccessToken,
} from '@/lib/supabase/server'

type EventRow = {
  capacity: number
  description: string | null
  duration_minutes: number
  google_good_for_groups: boolean | null
  google_good_for_watching_sports: boolean | null
  google_live_music: boolean | null
  google_open_now: boolean | null
  google_opening_hours: string[] | null
  google_outdoor_seating: boolean | null
  google_reservable: boolean | null
  google_serves_beer: boolean | null
  google_serves_brunch: boolean | null
  google_serves_cocktails: boolean | null
  google_serves_dessert: boolean | null
  google_serves_dinner: boolean | null
  google_serves_vegetarian_food: boolean | null
  google_serves_wine: boolean | null
  id: number
  intent: 'dating' | 'friendship'
  menu_experience_tags: string[] | null
  minimum_viable_attendees: number
  restaurant_id: number | null
  restaurant_cuisines: string[] | null
  restaurant_name: string
  restaurant_neighbourhood: string | null
  restaurant_subregion: string
  starts_at: string
  status: 'open' | 'closed' | 'cancelled'
  title: string
  venue_crowd: string[] | null
  venue_energy: string | null
  venue_formats: string[] | null
  venue_good_for_casual_meetups: boolean | null
  venue_good_for_cocktails: boolean | null
  venue_good_for_conversation: boolean | null
  venue_good_for_dinner: boolean | null
  venue_group_friendly: boolean | null
  venue_indoor_outdoor: string[] | null
  venue_latitude: number | null
  venue_longitude: number | null
  venue_music: string[] | null
  venue_noise_level: string | null
  venue_price: string | null
  venue_reservation_friendly: boolean | null
  venue_scene: string[] | null
  venue_seating_types: string[] | null
  venue_setting: string[] | null
  venue_vibes: string[] | null
  viability_status: 'healthy' | 'at_risk' | 'forced_go' | 'cancelled_low_confirmations'
}

type SignupRow = {
  created_at: string
  day_of_confirmation_status: 'pending' | 'confirmed' | 'declined'
  event_id: number
  personal_match_score: number
  personal_match_summary: string | null
  restaurant_match_score: number
  status: 'going' | 'cancelled' | 'no_show' | 'removed' | 'attended'
  user_id: string
}

type SavedRestaurantRow = {
  restaurant_id: number
}

type ProfileRow = {
  age_range_comfort: string[] | null
  bio: string | null
  conversation_preference: string[] | null
  cuisine_preferences: string[] | null
  display_name: string | null
  dietary_restrictions: string[] | null
  drinking_preferences: string[] | null
  group_size_comfort: string[] | null
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
  preferred_vibes: string[] | null
  subregion: string | null
}

type FeedbackRow = {
  event_id: number
  group_rating: number
  notes: string | null
  user_id: string
  venue_rating: number
  would_join_again: boolean
}

type RestaurantPlaceRow = {
  google_place_id: string | null
  google_rating: number | null
  google_user_ratings_total: number | null
  id: number
}

const PAST_EVENT_LOOKBACK_DAYS = 30

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
        'age_range_comfort, bio, conversation_preference, cuisine_preferences, dietary_restrictions, display_name, drinking_preferences, group_size_comfort, home_latitude, home_longitude, id, intent, max_travel_minutes, neighbourhood, preferred_crowd, preferred_energy, preferred_music, preferred_price, preferred_scene, preferred_setting, preferred_vibes, subregion'
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
      !profile.preferred_price?.length ||
      !profile.preferred_vibes?.length ||
      !profile.drinking_preferences?.length ||
      !profile.dietary_restrictions?.length ||
      !profile.conversation_preference?.length ||
      !profile.age_range_comfort?.length ||
      !profile.group_size_comfort?.length
    ) {
      return NextResponse.json({
        events: [],
        ok: true,
        onboardingRequired: true,
      })
    }

    const [eventsResponse, savedRestaurantsResponse] = await Promise.all([
      adminClient
        .from('events')
        .select(
          'capacity, description, duration_minutes, google_good_for_groups, google_good_for_watching_sports, google_live_music, google_open_now, google_opening_hours, google_outdoor_seating, google_reservable, google_serves_beer, google_serves_brunch, google_serves_cocktails, google_serves_dessert, google_serves_dinner, google_serves_vegetarian_food, google_serves_wine, id, intent, menu_experience_tags, minimum_viable_attendees, restaurant_id, restaurant_cuisines, restaurant_name, restaurant_neighbourhood, restaurant_subregion, starts_at, status, title, venue_crowd, venue_energy, venue_formats, venue_good_for_casual_meetups, venue_good_for_cocktails, venue_good_for_conversation, venue_good_for_dinner, venue_group_friendly, venue_indoor_outdoor, venue_latitude, venue_longitude, venue_music, venue_noise_level, venue_price, venue_reservation_friendly, venue_scene, venue_seating_types, venue_setting, venue_vibes, viability_status'
        )
        .neq('status', 'cancelled')
        .is('archived_at', null)
        .gte(
          'starts_at',
          new Date(Date.now() - PAST_EVENT_LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString()
        )
        .order('starts_at', { ascending: true })
        .limit(80)
        .returns<EventRow[]>(),
      adminClient
        .from('saved_restaurants')
        .select('restaurant_id')
        .eq('user_id', user.id)
        .returns<SavedRestaurantRow[]>(),
    ])

    const { data: events, error: eventsError } = eventsResponse
    const { data: savedRestaurants, error: savedRestaurantsError } =
      savedRestaurantsResponse

    if (eventsError) {
      throw new Error(eventsError.message)
    }

    if (savedRestaurantsError) {
      throw new Error(savedRestaurantsError.message)
    }

    const allEventIds = (events ?? []).map((event) => event.id)
    const savedRestaurantIds = new Set(
      (savedRestaurants ?? []).map((restaurant) => restaurant.restaurant_id)
    )

    if (allEventIds.length === 0) {
      return NextResponse.json({
        events: [],
        ok: true,
        onboardingRequired: false,
      })
    }

    const { data: allSignups, error: allSignupsError } = await adminClient
      .from('event_signups')
      .select(
        'created_at, day_of_confirmation_status, event_id, personal_match_score, personal_match_summary, restaurant_match_score, status, user_id'
      )
      .in('event_id', allEventIds)
      .returns<SignupRow[]>()

    if (allSignupsError) {
      throw new Error(allSignupsError.message)
    }

    const visibleEvents = getVisibleEventsForSavedRestaurants({
      events: events ?? [],
      savedRestaurantIds,
      signups: allSignups ?? [],
      userId: user.id,
    })
    const eventIds = visibleEvents.map((event) => event.id)
    const visibleEventIdSet = new Set(eventIds)
    const visibleSignups = (allSignups ?? []).filter((signup) =>
      visibleEventIdSet.has(signup.event_id)
    )
    const restaurantIds = Array.from(
      new Set(
        visibleEvents
          .map((event) => event.restaurant_id)
          .filter((restaurantId): restaurantId is number => restaurantId !== null)
      )
    )

    if (eventIds.length === 0) {
      return NextResponse.json({
        events: [],
        ok: true,
        onboardingRequired: false,
      })
    }

    const { data: restaurantPlaces, error: restaurantPlacesError } = restaurantIds.length
      ? await adminClient
          .from('restaurants')
          .select('google_place_id, google_rating, google_user_ratings_total, id')
          .in('id', restaurantIds)
          .returns<RestaurantPlaceRow[]>()
      : { data: [], error: null }

    if (restaurantPlacesError) {
      throw new Error(restaurantPlacesError.message)
    }

    const { data: feedbackRows, error: feedbackError } = await adminClient
      .from('event_feedback')
      .select('event_id, group_rating, notes, user_id, venue_rating, would_join_again')
      .in('event_id', eventIds)
      .eq('user_id', user.id)
      .returns<FeedbackRow[]>()

    if (feedbackError) {
      throw new Error(feedbackError.message)
    }

    const attendeeUserIds = Array.from(
      new Set(
        visibleSignups
          .filter((signup) => signup.status === 'going')
          .map((signup) => signup.user_id)
      )
    )

    const { data: attendeeProfiles, error: attendeeProfilesError } = attendeeUserIds.length
      ? await adminClient
          .from('profiles')
          .select('display_name, id')
          .in('id', attendeeUserIds)
          .returns<{ display_name: string | null; id: string }[]>()
      : { data: [], error: null }

    if (attendeeProfilesError) {
      throw new Error(attendeeProfilesError.message)
    }

    const attendeeProfileById = new Map(
      (attendeeProfiles ?? []).map((attendeeProfile) => [
        attendeeProfile.id,
        attendeeProfile,
      ])
    )
    const googlePlaceIdByRestaurantId = new Map(
      (restaurantPlaces ?? []).map((restaurant) => [restaurant.id, restaurant.google_place_id])
    )

    const attendeeCountByEvent = new Map<number, number>()
    const attendeePreviewByEvent = new Map<
      number,
      {
        dayOfConfirmationStatus: SignupRow['day_of_confirmation_status']
        displayName: string
      }[]
    >()
    const confirmedTodayCountByEvent = new Map<number, number>()
    const mySignupByEvent = new Map<number, SignupRow>()
    const myFeedbackByEvent = new Map(
      (feedbackRows ?? []).map((feedback) => [feedback.event_id, feedback])
    )
    for (const signup of visibleSignups) {
      if (signup.status === 'going') {
        attendeeCountByEvent.set(
          signup.event_id,
          (attendeeCountByEvent.get(signup.event_id) ?? 0) + 1
        )

        if (signup.day_of_confirmation_status === 'confirmed') {
          confirmedTodayCountByEvent.set(
            signup.event_id,
            (confirmedTodayCountByEvent.get(signup.event_id) ?? 0) + 1
          )
        }

        attendeePreviewByEvent.set(signup.event_id, [
          ...(attendeePreviewByEvent.get(signup.event_id) ?? []),
          {
            dayOfConfirmationStatus: signup.day_of_confirmation_status,
            displayName:
              attendeeProfileById.get(signup.user_id)?.display_name ?? 'Someone',
          },
        ])
      }

      if (signup.user_id === user.id) {
        mySignupByEvent.set(signup.event_id, signup)
      }
    }

    const scoringProfile: ProfileForScoring = {
      age_range_comfort: profile.age_range_comfort,
      bio: profile.bio,
      conversation_preference: profile.conversation_preference,
      cuisine_preferences: profile.cuisine_preferences,
      dietary_restrictions: profile.dietary_restrictions,
      drinking_preferences: profile.drinking_preferences,
      group_size_comfort: profile.group_size_comfort,
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
      preferred_vibes: profile.preferred_vibes,
      subregion: profile.subregion,
    }

    const mappedEvents = visibleEvents.map((event) => {
        const attendeeCount = attendeeCountByEvent.get(event.id) ?? 0
        const confirmedTodayCount = confirmedTodayCountByEvent.get(event.id) ?? 0
        const userSignup = mySignupByEvent.get(event.id)
        const userFeedback = myFeedbackByEvent.get(event.id) ?? null
        const scoringEvent: EventForScoring = {
          capacity: event.capacity,
          google_good_for_groups: event.google_good_for_groups,
          google_good_for_watching_sports: event.google_good_for_watching_sports,
          google_live_music: event.google_live_music,
          google_open_now: event.google_open_now,
          google_opening_hours: event.google_opening_hours,
          google_outdoor_seating: event.google_outdoor_seating,
          google_reservable: event.google_reservable,
          google_review_count:
            event.restaurant_id !== null
              ? (restaurantPlaces?.find((item) => item.id === event.restaurant_id)?.google_user_ratings_total ?? null)
              : null,
          google_rating:
            event.restaurant_id !== null
              ? (restaurantPlaces?.find((item) => item.id === event.restaurant_id)?.google_rating ?? null)
              : null,
          google_serves_beer: event.google_serves_beer,
          google_serves_brunch: event.google_serves_brunch,
          google_serves_cocktails: event.google_serves_cocktails,
          google_serves_dessert: event.google_serves_dessert,
          google_serves_dinner: event.google_serves_dinner,
          google_serves_vegetarian_food: event.google_serves_vegetarian_food,
          google_serves_wine: event.google_serves_wine,
          intent: event.intent,
          menu_experience_tags: event.menu_experience_tags,
          restaurant_cuisines: event.restaurant_cuisines,
          restaurant_subregion: event.restaurant_subregion,
          venue_crowd: event.venue_crowd,
          venue_energy: event.venue_energy,
          venue_formats: event.venue_formats,
          venue_good_for_casual_meetups: event.venue_good_for_casual_meetups,
          venue_good_for_cocktails: event.venue_good_for_cocktails,
          venue_good_for_conversation: event.venue_good_for_conversation,
          venue_good_for_dinner: event.venue_good_for_dinner,
          venue_group_friendly: event.venue_group_friendly,
          venue_indoor_outdoor: event.venue_indoor_outdoor,
          venue_latitude: event.venue_latitude,
          venue_longitude: event.venue_longitude,
          venue_music: event.venue_music,
          venue_noise_level: event.venue_noise_level,
          venue_price: event.venue_price,
          venue_reservation_friendly: event.venue_reservation_friendly,
          venue_scene: event.venue_scene,
          venue_seating_types: event.venue_seating_types,
          venue_setting: event.venue_setting,
          venue_vibes: event.venue_vibes,
        }
        const projectedRestaurantScore =
          userSignup?.restaurant_match_score ??
          calculateRestaurantMatchScore(scoringProfile, scoringEvent)
        const venueDistanceKm =
          profile.home_latitude !== null &&
          profile.home_longitude !== null &&
          event.venue_latitude !== null &&
          event.venue_longitude !== null
            ? Number(
                calculateDistanceKm(
                  profile.home_latitude,
                  profile.home_longitude,
                  event.venue_latitude,
                  event.venue_longitude
                ).toFixed(1)
              )
            : null
        const needsDayOfConfirmation =
          userSignup?.status === 'going' &&
          userSignup.day_of_confirmation_status !== 'confirmed' &&
          isSameEventDayInNewYork(event.starts_at) &&
          !hasEventStarted(event.starts_at)
        const shouldReconsiderGoing =
          userSignup?.status === 'going' &&
          isSameEventDayInNewYork(event.starts_at) &&
          !hasEventStarted(event.starts_at) &&
          event.viability_status !== 'forced_go' &&
          confirmedTodayCount < event.minimum_viable_attendees
        const hasEnded = new Date(event.starts_at).getTime() + event.duration_minutes * 60 * 1000 <=
          Date.now()
        const canSubmitFeedback =
          hasEnded &&
          ['going', 'attended'].includes(userSignup?.status ?? '')

        return {
          ...event,
          attendeeCount,
          attendeePreview: (attendeePreviewByEvent.get(event.id) ?? []).slice(0, 8),
          canSubmitFeedback,
          canViewAttendees: ['going', 'attended', 'no_show'].includes(
            userSignup?.status ?? ''
          ),
          confirmedTodayCount,
          dayOfConfirmationStatus: userSignup?.day_of_confirmation_status ?? null,
          feedback: userFeedback
            ? {
                groupRating: userFeedback.group_rating,
                notes: userFeedback.notes,
                submitted: true,
                venueRating: userFeedback.venue_rating,
                wouldJoinAgain: userFeedback.would_join_again,
              }
            : {
                groupRating: null,
                notes: '',
                submitted: false,
                venueRating: null,
                wouldJoinAgain: null,
              },
          hasEnded,
          google_good_for_groups: event.google_good_for_groups,
          google_good_for_watching_sports: event.google_good_for_watching_sports,
          google_live_music: event.google_live_music,
          google_open_now: event.google_open_now,
          google_opening_hours: event.google_opening_hours,
          google_outdoor_seating: event.google_outdoor_seating,
          google_reservable: event.google_reservable,
          google_serves_beer: event.google_serves_beer,
          google_serves_brunch: event.google_serves_brunch,
          google_serves_cocktails: event.google_serves_cocktails,
          google_serves_dessert: event.google_serves_dessert,
          google_serves_dinner: event.google_serves_dinner,
          google_serves_vegetarian_food: event.google_serves_vegetarian_food,
          google_serves_wine: event.google_serves_wine,
          isJoined: userSignup?.status === 'going',
          menu_experience_tags: event.menu_experience_tags,
          minimumViableAttendees: event.minimum_viable_attendees,
          needsDayOfConfirmation,
          personalMatchScore: userSignup?.personal_match_score ?? null,
          personalMatchSummary: userSignup?.personal_match_summary ?? null,
          projectedRestaurantScore,
          restaurantGooglePlaceId:
            event.restaurant_id !== null
              ? (googlePlaceIdByRestaurantId.get(event.restaurant_id) ?? null)
              : null,
          venueDistanceKm,
          venue_formats: event.venue_formats,
          venue_good_for_casual_meetups: event.venue_good_for_casual_meetups,
          venue_good_for_cocktails: event.venue_good_for_cocktails,
          venue_good_for_conversation: event.venue_good_for_conversation,
          venue_good_for_dinner: event.venue_good_for_dinner,
          venue_group_friendly: event.venue_group_friendly,
          venue_indoor_outdoor: event.venue_indoor_outdoor,
          venueMatchSummary: describeVenueMatch(scoringProfile, scoringEvent),
          shouldReconsiderGoing,
          signupStatus: userSignup?.status ?? null,
          spotsLeft: Math.max(0, event.capacity - attendeeCount),
          venue_noise_level: event.venue_noise_level,
          viabilityStatus: event.viability_status,
          venue_reservation_friendly: event.venue_reservation_friendly,
          venue_seating_types: event.venue_seating_types,
          venue_vibes: event.venue_vibes,
        }
      })

    mappedEvents.sort((left, right) => {
      if (right.projectedRestaurantScore !== left.projectedRestaurantScore) {
        return right.projectedRestaurantScore - left.projectedRestaurantScore
      }

      return left.starts_at.localeCompare(right.starts_at)
    })

    return NextResponse.json({
      events: mappedEvents,
      ok: true,
      onboardingRequired: false,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to load events.',
      },
      { status: 401 }
    )
  }
}
