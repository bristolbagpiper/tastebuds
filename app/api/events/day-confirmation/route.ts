import { NextResponse } from 'next/server'

import {
  refreshEventViability,
  syncEventSignupScores,
} from '@/lib/event-operations'
import { hasEventStarted, isSameEventDayInNewYork } from '@/lib/event-time'
import { queueNotifications } from '@/lib/notifications'
import {
  createServerSupabaseAdminClient,
  getUserFromAccessToken,
} from '@/lib/supabase/server'

type DayConfirmationAction = 'confirm' | 'decline'

type DayConfirmationRequest = {
  action?: DayConfirmationAction
  eventId?: number
}

type EventRow = {
  id: number
  restaurant_name: string
  starts_at: string
  title: string
}

type SignupRow = {
  status: 'going' | 'cancelled' | 'removed' | 'no_show' | 'attended'
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

  let body: DayConfirmationRequest = {}

  try {
    body = (await request.json()) as DayConfirmationRequest
  } catch {
    body = {}
  }

  const eventId = Number(body.eventId)
  const action = body.action

  if (!Number.isInteger(eventId) || eventId <= 0) {
    return NextResponse.json(
      { error: 'eventId must be a valid positive integer.' },
      { status: 400 }
    )
  }

  if (action !== 'confirm' && action !== 'decline') {
    return NextResponse.json(
      { error: 'action must be confirm or decline.' },
      { status: 400 }
    )
  }

  try {
    const user = await getUserFromAccessToken(token)
    const adminClient = createServerSupabaseAdminClient()

    const { data: event, error: eventError } = await adminClient
      .from('events')
      .select('id, restaurant_name, starts_at, title')
      .eq('id', eventId)
      .maybeSingle<EventRow>()

    if (eventError || !event) {
      return NextResponse.json({ error: 'Event not found.' }, { status: 404 })
    }

    if (!isSameEventDayInNewYork(event.starts_at)) {
      return NextResponse.json(
        { error: 'Day-of confirmation is only available on the event day.' },
        { status: 400 }
      )
    }

    if (hasEventStarted(event.starts_at)) {
      return NextResponse.json(
        { error: 'Day-of confirmation closes once the event has started.' },
        { status: 400 }
      )
    }

    const { data: signup, error: signupError } = await adminClient
      .from('event_signups')
      .select('status')
      .eq('event_id', eventId)
      .eq('user_id', user.id)
      .maybeSingle<SignupRow>()

    if (signupError) {
      throw new Error(signupError.message)
    }

    if (!signup || signup.status !== 'going') {
      return NextResponse.json(
        { error: 'Only confirmed attendees can use day-of confirmation.' },
        { status: 400 }
      )
    }

    const nowIso = new Date().toISOString()

    if (action === 'confirm') {
      const { error: confirmError } = await adminClient
        .from('event_signups')
        .update({
          day_of_confirmation_at: nowIso,
          day_of_confirmation_status: 'confirmed',
          updated_at: nowIso,
        })
        .eq('event_id', eventId)
        .eq('user_id', user.id)

      if (confirmError) {
        throw new Error(confirmError.message)
      }

      await refreshEventViability(adminClient, eventId)

      return NextResponse.json({
        eventId,
        ok: true,
        status: 'confirmed',
      })
    }

    const { error: declineError } = await adminClient
      .from('event_signups')
      .update({
        day_of_confirmation_at: nowIso,
        day_of_confirmation_status: 'declined',
        status: 'cancelled',
        updated_at: nowIso,
      })
      .eq('event_id', eventId)
      .eq('user_id', user.id)

    if (declineError) {
      throw new Error(declineError.message)
    }

    await syncEventSignupScores(adminClient, eventId)
    await refreshEventViability(adminClient, eventId)

    await queueNotifications([
      {
        body: `You declined your day-of seat for ${event.title} at ${event.restaurant_name}.`,
        duplicateBehavior: 'rearm',
        eventId: event.id,
        title: 'You gave up your seat',
        type: 'event_update',
        userId: user.id,
      },
    ])

    return NextResponse.json({
      eventId,
      ok: true,
      status: 'declined',
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to update day-of confirmation.',
      },
      { status: 500 }
    )
  }
}
