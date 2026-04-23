import { NextResponse } from 'next/server'

import {
  calculateRestaurantMatchScore,
  type EventForScoring,
  type ProfileForScoring,
} from '@/lib/events'
import { hasEventStarted, isSameEventDayInNewYork } from '@/lib/event-time'
import {
  createServerSupabaseAdminClient,
  getUserFromAccessToken,
} from '@/lib/supabase/server'

type EventRow = {
  capacity: number
  description: string | null
  duration_minutes: number
  id: number
  intent: 'dating' | 'friendship'
  minimum_viable_attendees: number
  restaurant_cuisines: string[] | null
  restaurant_name: string
  restaurant_neighbourhood: string | null
  restaurant_subregion: string
  starts_at: string
  status: 'open' | 'closed' | 'cancelled'
  title: string
}

type SignupRow = {
  created_at: string
  day_of_confirmation_status: 'pending' | 'confirmed' | 'declined'
  event_id: number
  personal_match_score: number
  personal_match_summary: string | null
  restaurant_match_score: number
  status: 'going' | 'waitlisted' | 'cancelled' | 'no_show' | 'removed' | 'attended'
  user_id: string
}

type ProfileRow = {
  bio: string | null
  cuisine_preferences: string[] | null
  display_name: string | null
  id: string
  intent: 'dating' | 'friendship' | null
  max_travel_minutes: number | null
  neighbourhood: string | null
  subregion: string | null
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
    const nowIso = new Date().toISOString()

    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select(
        'bio, cuisine_preferences, display_name, id, intent, max_travel_minutes, neighbourhood, subregion'
      )
      .eq('id', user.id)
      .maybeSingle<ProfileRow>()

    if (profileError) {
      throw new Error(profileError.message)
    }

    if (!profile) {
      return NextResponse.json({
        events: [],
        ok: true,
        onboardingRequired: true,
      })
    }

    const { data: events, error: eventsError } = await adminClient
      .from('events')
      .select(
        'capacity, description, duration_minutes, id, intent, minimum_viable_attendees, restaurant_cuisines, restaurant_name, restaurant_neighbourhood, restaurant_subregion, starts_at, status, title'
      )
      .neq('status', 'cancelled')
      .gte('starts_at', nowIso)
      .order('starts_at', { ascending: true })
      .limit(40)
      .returns<EventRow[]>()

    if (eventsError) {
      throw new Error(eventsError.message)
    }

    const eventIds = (events ?? []).map((event) => event.id)

    if (eventIds.length === 0) {
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
      .in('event_id', eventIds)
      .returns<SignupRow[]>()

    if (allSignupsError) {
      throw new Error(allSignupsError.message)
    }

    const attendeeUserIds = Array.from(
      new Set(
        (allSignups ?? [])
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
    const waitlistByEvent = new Map<number, SignupRow[]>()

    for (const signup of allSignups ?? []) {
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

      if (signup.status === 'waitlisted') {
        waitlistByEvent.set(signup.event_id, [
          ...(waitlistByEvent.get(signup.event_id) ?? []),
          signup,
        ])
      }

      if (signup.user_id === user.id) {
        mySignupByEvent.set(signup.event_id, signup)
      }
    }

    const scoringProfile: ProfileForScoring = {
      bio: profile.bio,
      cuisine_preferences: profile.cuisine_preferences,
      id: profile.id,
      intent: profile.intent,
      max_travel_minutes: profile.max_travel_minutes,
      subregion: profile.subregion,
    }

    return NextResponse.json({
      events: (events ?? []).map((event) => {
        const attendeeCount = attendeeCountByEvent.get(event.id) ?? 0
        const confirmedTodayCount = confirmedTodayCountByEvent.get(event.id) ?? 0
        const userSignup = mySignupByEvent.get(event.id)
        const waitlist = (waitlistByEvent.get(event.id) ?? []).sort((left, right) =>
          left.created_at.localeCompare(right.created_at)
        )
        const waitlistPosition =
          userSignup?.status === 'waitlisted'
            ? waitlist.findIndex((signup) => signup.user_id === user.id) + 1
            : null
        const scoringEvent: EventForScoring = {
          intent: event.intent,
          restaurant_cuisines: event.restaurant_cuisines,
          restaurant_subregion: event.restaurant_subregion,
        }
        const needsDayOfConfirmation =
          userSignup?.status === 'going' &&
          userSignup.day_of_confirmation_status !== 'confirmed' &&
          isSameEventDayInNewYork(event.starts_at) &&
          !hasEventStarted(event.starts_at)
        const shouldReconsiderGoing =
          userSignup?.status === 'going' &&
          isSameEventDayInNewYork(event.starts_at) &&
          !hasEventStarted(event.starts_at) &&
          confirmedTodayCount < event.minimum_viable_attendees

        return {
          ...event,
          attendeeCount,
          attendeePreview: (attendeePreviewByEvent.get(event.id) ?? []).slice(0, 8),
          canViewAttendees: ['going', 'waitlisted', 'attended', 'no_show'].includes(
            userSignup?.status ?? ''
          ),
          confirmedTodayCount,
          dayOfConfirmationStatus: userSignup?.day_of_confirmation_status ?? null,
          isJoined: ['going', 'waitlisted'].includes(userSignup?.status ?? ''),
          minimumViableAttendees: event.minimum_viable_attendees,
          needsDayOfConfirmation,
          personalMatchScore: userSignup?.personal_match_score ?? null,
          personalMatchSummary: userSignup?.personal_match_summary ?? null,
          projectedRestaurantScore:
            userSignup?.restaurant_match_score ??
            calculateRestaurantMatchScore(scoringProfile, scoringEvent),
          shouldReconsiderGoing,
          signupStatus: userSignup?.status ?? null,
          spotsLeft: Math.max(0, event.capacity - attendeeCount),
          waitlistCount: waitlist.length,
          waitlistPosition,
        }
      }),
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
