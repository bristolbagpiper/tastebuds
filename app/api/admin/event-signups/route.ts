import { NextResponse } from 'next/server'

import { recomputeEventSignupScores } from '@/lib/event-signups'
import { queueNotifications } from '@/lib/notifications'
import { requireAdminOrCron } from '@/lib/request-auth'
import { createServerSupabaseAdminClient } from '@/lib/supabase/server'

type AttendeeAction = 'mark-no-show' | 'remove' | 'restore'

type AttendeeActionRequest = {
  action?: AttendeeAction
  eventId?: number
  userId?: string
}

type EventRow = {
  id: number
  restaurant_name: string
  title: string
}

function buildAttendeeNotification(
  action: AttendeeAction,
  event: EventRow
) {
  if (action === 'remove') {
    return {
      body: `Your signup for ${event.title} at ${event.restaurant_name} has been removed by the host team.`,
      title: 'Event signup removed',
    }
  }

  if (action === 'mark-no-show') {
    return {
      body: `You were marked as a no-show for ${event.title} at ${event.restaurant_name}.`,
      title: 'Marked as no-show',
    }
  }

  return {
    body: `Your signup for ${event.title} at ${event.restaurant_name} has been restored.`,
    title: 'Event signup restored',
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

  let body: AttendeeActionRequest = {}

  try {
    body = (await request.json()) as AttendeeActionRequest
  } catch {
    body = {}
  }

  const eventId = Number(body.eventId)
  const userId = body.userId?.trim()
  const action = body.action

  if (!Number.isInteger(eventId) || eventId <= 0) {
    return NextResponse.json(
      { error: 'eventId must be a valid positive integer.' },
      { status: 400 }
    )
  }

  if (!userId) {
    return NextResponse.json(
      { error: 'userId is required.' },
      { status: 400 }
    )
  }

  if (!action || !['mark-no-show', 'remove', 'restore'].includes(action)) {
    return NextResponse.json(
      { error: 'action must be remove, mark-no-show, or restore.' },
      { status: 400 }
    )
  }

  try {
    const adminClient = createServerSupabaseAdminClient()

    const { data: event, error: eventError } = await adminClient
      .from('events')
      .select('id, restaurant_name, title')
      .eq('id', eventId)
      .maybeSingle<EventRow>()

    if (eventError || !event) {
      return NextResponse.json({ error: 'Event not found.' }, { status: 404 })
    }

    const nextStatus =
      action === 'remove'
        ? 'removed'
        : action === 'mark-no-show'
          ? 'no_show'
          : 'going'

    const { error: signupError } = await adminClient
      .from('event_signups')
      .upsert(
        {
          event_id: eventId,
          status: nextStatus,
          updated_at: new Date().toISOString(),
          user_id: userId,
        },
        {
          onConflict: 'event_id,user_id',
        }
      )

    if (signupError) {
      throw new Error(signupError.message)
    }

    await recomputeEventSignupScores(adminClient, eventId)

    const notification = buildAttendeeNotification(action, event)
    await queueNotifications([
      {
        body: notification.body,
        eventId: event.id,
        title: notification.title,
        type: 'event_update',
        userId,
      },
    ])

    return NextResponse.json({
      eventId,
      ok: true,
      status: nextStatus,
      userId,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to update attendee status.',
      },
      { status: 500 }
    )
  }
}
