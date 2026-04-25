import { NextResponse } from 'next/server'

import {
  refreshEventViability,
  syncEventSignupScores,
} from '@/lib/event-operations'
import { hasEventStarted } from '@/lib/event-time'
import { queueNotifications } from '@/lib/notifications'
import { requireAdminOrCron } from '@/lib/request-auth'
import { createServerSupabaseAdminClient } from '@/lib/supabase/server'

type AttendeeAction = 'mark-attended' | 'mark-no-show' | 'remove' | 'restore'

type AttendeeActionRequest = {
  action?: AttendeeAction
  eventId?: number
  userId?: string
}

type EventRow = {
  capacity: number
  id: number
  restaurant_name: string
  starts_at: string
  status: 'open' | 'closed' | 'cancelled'
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

  if (action === 'mark-attended') {
    return {
      body: `You were marked as attended for ${event.title} at ${event.restaurant_name}.`,
      title: 'Attendance recorded',
    }
  }

  return {
    body: `Your signup for ${event.title} at ${event.restaurant_name} has been reinstated.`,
    title: 'Event signup reinstated',
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

  if (
    !action ||
    !['mark-attended', 'mark-no-show', 'remove', 'restore'].includes(action)
  ) {
    return NextResponse.json(
      { error: 'action must be remove, mark-no-show, mark-attended, or restore.' },
      { status: 400 }
    )
  }

  try {
    const adminClient = createServerSupabaseAdminClient()

    const { data: event, error: eventError } = await adminClient
      .from('events')
      .select('capacity, id, restaurant_name, starts_at, status, title')
      .eq('id', eventId)
      .maybeSingle<EventRow>()

    if (eventError || !event) {
      return NextResponse.json({ error: 'Event not found.' }, { status: 404 })
    }

    if (
      ['mark-no-show', 'mark-attended'].includes(action) &&
      !hasEventStarted(event.starts_at)
    ) {
      return NextResponse.json(
        { error: 'Attendance can only be updated after the event has started.' },
        { status: 400 }
      )
    }

    const nextStatus =
      action === 'remove'
        ? 'removed'
        : action === 'mark-no-show'
          ? 'no_show'
          : action === 'mark-attended'
            ? 'attended'
            : 'going'

    if (action === 'restore') {
      if (event.status === 'cancelled') {
        return NextResponse.json(
          { error: 'You cannot reinstate attendees on a cancelled event.' },
          { status: 400 }
        )
      }

      if (!hasEventStarted(event.starts_at)) {
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
            { error: 'This event is already full. Remove another attendee before restoring.' },
            { status: 400 }
          )
        }
      }
    }

    const nextDayOfConfirmationStatus =
      action === 'restore' && nextStatus === 'going'
        ? 'pending'
        : action === 'remove'
          ? 'declined'
          : undefined

    const { error: signupError } = await adminClient
      .from('event_signups')
      .upsert(
        {
          day_of_confirmation_at:
            nextDayOfConfirmationStatus === 'pending' ? null : undefined,
          day_of_confirmation_status: nextDayOfConfirmationStatus,
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

    await syncEventSignupScores(adminClient, eventId)
    await refreshEventViability(adminClient, eventId)

    const notification = buildAttendeeNotification(action, event)
    await queueNotifications([
      {
        body: notification.body,
        duplicateBehavior: 'rearm',
        eventId: event.id,
        title: notification.title,
        type: action === 'mark-attended' ? 'event_attendance' : 'event_update',
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
