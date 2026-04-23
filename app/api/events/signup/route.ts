import { NextResponse } from 'next/server'

import { recomputeEventSignupScores } from '@/lib/event-signups'
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
  id: number
  intent: 'dating' | 'friendship'
  restaurant_name: string
  starts_at: string
  status: 'open' | 'closed' | 'cancelled'
  title: string
}

type SignupRow = {
  personal_match_score: number
  personal_match_summary: string | null
  restaurant_match_score: number
  status: 'going' | 'cancelled'
}

type JoinEventResultRow = {
  error: string | null
  ok: boolean
  status: 'going' | 'full' | 'closed' | 'not_found'
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
      .select('capacity, id, intent, restaurant_name, starts_at, status, title')
      .eq('id', eventId)
      .maybeSingle<EventRow>()

    if (eventError || !event) {
      return NextResponse.json({ error: 'Event not found.' }, { status: 404 })
    }

    if (event.status !== 'open') {
      return NextResponse.json(
        { error: 'This event is not open for signups.' },
        { status: 400 }
      )
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

      await recomputeEventSignupScores(adminClient, eventId)

      return NextResponse.json({
        eventId,
        ok: true,
        status: 'cancelled',
      })
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

      if (joinResult?.status === 'full') {
        return NextResponse.json(
          { error: joinResult.error ?? 'This event is already full.' },
          { status: 409 }
        )
      }

      return NextResponse.json(
        { error: joinResult?.error ?? 'This event is not open for signups.' },
        { status: 400 }
      )
    }

    await recomputeEventSignupScores(adminClient, eventId)

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
        body: `You're in for ${event.title} at ${event.restaurant_name}. Restaurant and personal scores are now live on your dashboard.`,
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
      status: 'going',
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
