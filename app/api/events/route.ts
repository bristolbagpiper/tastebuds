import { NextResponse } from 'next/server'

import { calculateRestaurantMatchScore, type EventForScoring, type ProfileForScoring } from '@/lib/events'
import {
  createServerSupabaseAdminClient,
  getUserFromAccessToken,
} from '@/lib/supabase/server'

type EventRow = {
  capacity: number
  description: string | null
  id: number
  intent: 'dating' | 'friendship'
  restaurant_cuisines: string[] | null
  restaurant_name: string
  restaurant_neighbourhood: string | null
  restaurant_subregion: string
  starts_at: string
  status: 'open' | 'closed' | 'cancelled'
  title: string
}

type SignupRow = {
  event_id: number
  personal_match_score: number
  personal_match_summary: string | null
  restaurant_match_score: number
  status: 'going' | 'cancelled' | 'no_show' | 'removed'
  user_id: string
}

type ProfileRow = {
  bio: string | null
  cuisine_preferences: string[] | null
  id: string
  intent: 'dating' | 'friendship' | null
  max_travel_minutes: number | null
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
      .select('bio, cuisine_preferences, id, intent, max_travel_minutes, subregion')
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
        'capacity, description, id, intent, restaurant_cuisines, restaurant_name, restaurant_neighbourhood, restaurant_subregion, starts_at, status, title'
      )
      .eq('status', 'open')
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
        'event_id, personal_match_score, personal_match_summary, restaurant_match_score, status, user_id'
      )
      .eq('status', 'going')
      .in('event_id', eventIds)
      .returns<SignupRow[]>()

    if (allSignupsError) {
      throw new Error(allSignupsError.message)
    }

    const attendeeCountByEvent = new Map<number, number>()
    const mySignupByEvent = new Map<number, SignupRow>()

    for (const signup of allSignups ?? []) {
      attendeeCountByEvent.set(
        signup.event_id,
        (attendeeCountByEvent.get(signup.event_id) ?? 0) + 1
      )

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
        const userSignup = mySignupByEvent.get(event.id)
        const scoringEvent: EventForScoring = {
          intent: event.intent,
          restaurant_cuisines: event.restaurant_cuisines,
          restaurant_subregion: event.restaurant_subregion,
        }

        return {
          ...event,
          attendeeCount,
          isJoined: Boolean(userSignup),
          personalMatchScore: userSignup?.personal_match_score ?? null,
          personalMatchSummary: userSignup?.personal_match_summary ?? null,
          projectedRestaurantScore:
            userSignup?.restaurant_match_score ??
            calculateRestaurantMatchScore(scoringProfile, scoringEvent),
          spotsLeft: Math.max(0, event.capacity - attendeeCount),
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
