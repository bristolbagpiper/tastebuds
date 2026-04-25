import { NextResponse } from 'next/server'

import {
  refreshEventViability,
  syncEventSignupScores,
} from '@/lib/event-operations'
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
  venue_crowd: string[] | null
  venue_energy: string | null
  venue_latitude: number | null
  venue_longitude: number | null
  venue_music: string[] | null
  venue_price: string | null
  venue_scene: string[] | null
  venue_setting: string[] | null
}

type SignupRow = {
  personal_match_score: number
  personal_match_summary: string | null
  restaurant_match_score: number
  status: 'going' | 'cancelled' | 'removed' | 'no_show' | 'attended'
}

type JoinEventResultRow = {
  error: string | null
  ok: boolean
  status: 'going' | 'closed' | 'not_found' | string
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
        'capacity, duration_minutes, id, intent, restaurant_cuisines, restaurant_name, restaurant_subregion, starts_at, status, title, venue_crowd, venue_energy, venue_latitude, venue_longitude, venue_music, venue_price, venue_scene, venue_setting'
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

    const { error: existingSignupError } = await adminClient
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

    const { count: attendeeCount, error: attendeeCountError } = await adminClient
      .from('event_signups')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .eq('status', 'going')

    if (attendeeCountError) {
      throw new Error(attendeeCountError.message)
    }

    if ((attendeeCount ?? 0) >= event.capacity) {
      return NextResponse.json(
        { error: 'This table is full. Try a similar table instead.' },
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

    if (joinResult.status !== 'going') {
      const { error: cleanupError } = await adminClient
        .from('event_signups')
        .update({
          status: 'cancelled',
          updated_at: new Date().toISOString(),
        })
        .eq('event_id', eventId)
        .eq('user_id', user.id)

      if (cleanupError) {
        throw new Error(cleanupError.message)
      }

      await syncEventSignupScores(adminClient, eventId)
      await refreshEventViability(adminClient, eventId)

      return NextResponse.json(
        { error: 'This table is full. Try a similar table instead.' },
        { status: 400 }
      )
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
          `You're in for ${event.title} at ${event.restaurant_name}. Restaurant and personal scores are now live on your dashboard.`,
        duplicateBehavior: 'rearm',
        eventId: event.id,
        title: 'Event signup confirmed',
        type: 'event_signup',
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
