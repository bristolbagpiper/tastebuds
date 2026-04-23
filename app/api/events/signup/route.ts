import { NextResponse } from 'next/server'

import { calculateRestaurantMatchScore, type EventForScoring, type ProfileForScoring } from '@/lib/events'
import {
  promoteWaitlistedAttendees,
  refreshEventViability,
  syncEventSignupScores,
} from '@/lib/event-operations'
import { isPastWaitlistPromotionCutoff } from '@/lib/event-time'
import { queueNotifications } from '@/lib/notifications'
import {
  createServerSupabaseAdminClient,
  getUserFromAccessToken,
} from '@/lib/supabase/server'

type SignupAction = 'join' | 'leave'

type SignupRequest = {
  action?: SignupAction
  eventId?: number
}

type EventRow = {
  capacity: number
  duration_minutes: number
  id: number
  intent: 'dating' | 'friendship'
  restaurant_cuisines: string[] | null
  restaurant_name: string
  restaurant_subregion: string | null
  starts_at: string
  status: 'open' | 'closed' | 'cancelled'
  title: string
}

type SignupRow = {
  personal_match_score: number
  personal_match_summary: string | null
  restaurant_match_score: number
  status: 'going' | 'waitlisted' | 'cancelled' | 'removed' | 'no_show' | 'attended'
}

type JoinEventResultRow = {
  error: string | null
  ok: boolean
  status: 'going' | 'waitlisted' | 'closed' | 'not_found'
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

export async function POST(request: Request) {
  const token = parseBearerToken(request)

  if (!token) {
    return NextResponse.json({ error: 'Missing bearer token.' }, { status: 401 })
  }

  let body: SignupRequest = {}

  try {
    body = (await request.json()) as SignupRequest
  } catch {
    body = {}
  }

  const eventId = Number(body.eventId)
  const action: SignupAction = body.action === 'leave' ? 'leave' : 'join'

  if (!Number.isInteger(eventId) || eventId <= 0) {
    return NextResponse.json(
      { error: 'eventId must be a valid positive integer.' },
      { status: 400 }
    )
  }

  try {
    const user = await getUserFromAccessToken(token)
    const adminClient = createServerSupabaseAdminClient()

    const { data: event, error: eventError } = await adminClient
      .from('events')
      .select(
        'capacity, duration_minutes, id, intent, restaurant_cuisines, restaurant_name, restaurant_subregion, starts_at, status, title'
      )
      .eq('id', eventId)
      .maybeSingle<EventRow>()

    if (eventError || !event) {
      return NextResponse.json({ error: 'Event not found.' }, { status: 404 })
    }

    if (new Date(event.starts_at).getTime() <= Date.now()) {
      return NextResponse.json(
        { error: 'This event has already started.' },
        { status: 400 }
      )
    }

    const { data: existingSignup, error: existingSignupError } = await adminClient
      .from('event_signups')
      .select(
        'personal_match_score, personal_match_summary, restaurant_match_score, status'
      )
      .eq('event_id', eventId)
      .eq('user_id', user.id)
      .maybeSingle<SignupRow>()

    if (existingSignupError) {
      throw new Error(existingSignupError.message)
    }

    if (action === 'leave') {
      const { error: leaveError } = await adminClient
        .from('event_signups')
        .upsert(
          {
            event_id: eventId,
            status: 'cancelled',
            updated_at: new Date().toISOString(),
            user_id: user.id,
          },
          {
            onConflict: 'event_id,user_id',
          }
        )

      if (leaveError) {
        throw new Error(leaveError.message)
      }

      if (existingSignup?.status === 'going') {
        await promoteWaitlistedAttendees(adminClient, eventId)
      }

      await syncEventSignupScores(adminClient, eventId)
      await refreshEventViability(adminClient, eventId)

      return NextResponse.json({
        eventId,
        ok: true,
        status: 'cancelled',
      })
    }

    if (event.status !== 'open') {
      return NextResponse.json(
        { error: 'This event is not open for signups.' },
        { status: 400 }
      )
    }

    const joinRpcResponse = await adminClient.rpc('join_event_signup_safe', {
      p_event_id: eventId,
      p_user_id: user.id,
    })

    const joinRpcError = joinRpcResponse.error

    if (joinRpcError) {
      throw new Error(joinRpcError.message)
    }

    const joinResultRows = Array.isArray(joinRpcResponse.data)
      ? (joinRpcResponse.data as JoinEventResultRow[])
      : []
    const joinResult = joinResultRows[0]

    if (!joinResult?.ok) {
      if (joinResult?.status === 'not_found') {
        return NextResponse.json(
          { error: joinResult.error ?? 'Event not found.' },
          { status: 404 }
        )
      }

      return NextResponse.json(
        { error: joinResult?.error ?? 'This event is not open for signups.' },
        { status: 400 }
      )
    }

    await syncEventSignupScores(adminClient, eventId)
    await refreshEventViability(adminClient, eventId)

    if (joinResult.status === 'waitlisted') {
      const { data: profile, error: profileError } = await adminClient
        .from('profiles')
        .select('bio, cuisine_preferences, id, intent, max_travel_minutes, subregion')
        .eq('id', user.id)
        .maybeSingle<ProfileRow>()

      if (profileError) {
        throw new Error(profileError.message)
      }

      const scoringProfile: ProfileForScoring = {
        bio: profile?.bio ?? null,
        cuisine_preferences: profile?.cuisine_preferences ?? [],
        id: user.id,
        intent: profile?.intent ?? null,
        max_travel_minutes: profile?.max_travel_minutes ?? null,
        subregion: profile?.subregion ?? null,
      }
      const scoringEvent: EventForScoring = {
        intent: event.intent,
        restaurant_cuisines: event.restaurant_cuisines,
        restaurant_subregion: event.restaurant_subregion,
      }

      const { error: waitlistScoreError } = await adminClient
        .from('event_signups')
        .update({
          personal_match_score: 50,
          personal_match_summary:
            'You are currently on the waitlist. Personal fit will lock in if a confirmed seat opens.',
          restaurant_match_score: calculateRestaurantMatchScore(
            scoringProfile,
            scoringEvent
          ),
          updated_at: new Date().toISOString(),
        })
        .eq('event_id', eventId)
        .eq('user_id', user.id)

      if (waitlistScoreError) {
        throw new Error(waitlistScoreError.message)
      }
    }

    const { data: refreshedSignup, error: refreshedSignupError } = await adminClient
      .from('event_signups')
      .select(
        'personal_match_score, personal_match_summary, restaurant_match_score, status'
      )
      .eq('event_id', eventId)
      .eq('user_id', user.id)
      .single<SignupRow>()

    if (refreshedSignupError || !refreshedSignup) {
      throw new Error(
        refreshedSignupError?.message ?? 'Could not read your event signup.'
      )
    }

    await queueNotifications([
      {
        body:
          joinResult.status === 'waitlisted'
            ? isPastWaitlistPromotionCutoff(event.starts_at)
              ? `You are on the waitlist for ${event.title} at ${event.restaurant_name}, but late-day promotion is now closed. A host would need to reopen the seat manually.`
              : `You are on the waitlist for ${event.title} at ${event.restaurant_name}. We will notify you if a confirmed seat opens.`
            : `You're in for ${event.title} at ${event.restaurant_name}. Restaurant and personal scores are now live on your dashboard.`,
        duplicateBehavior: 'rearm',
        eventId: event.id,
        title:
          joinResult.status === 'waitlisted'
            ? 'You joined the waitlist'
            : 'Event signup confirmed',
        type: joinResult.status === 'waitlisted' ? 'event_waitlist' : 'event_signup',
        userId: user.id,
      },
    ])

    return NextResponse.json({
      eventId,
      ok: true,
      signup: refreshedSignup,
      status: joinResult.status,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to update signup.',
      },
      { status: 500 }
    )
  }
}
