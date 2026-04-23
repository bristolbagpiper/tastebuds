import { NextResponse } from 'next/server'

import { queueNotifications } from '@/lib/notifications'
import {
  createServerSupabaseAdminClient,
  getUserFromAccessToken,
} from '@/lib/supabase/server'

type FeedbackRequest = {
  eventId?: number
  groupRating?: number
  notes?: string
  venueRating?: number
  wouldJoinAgain?: boolean
}

type EventRow = {
  duration_minutes: number
  id: number
  restaurant_name: string
  starts_at: string
  title: string
}

type SignupRow = {
  status: 'going' | 'waitlisted' | 'cancelled' | 'removed' | 'no_show' | 'attended'
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

  let body: FeedbackRequest = {}

  try {
    body = (await request.json()) as FeedbackRequest
  } catch {
    body = {}
  }

  const eventId = Number(body.eventId)
  const venueRating = Number(body.venueRating)
  const groupRating = Number(body.groupRating)
  const wouldJoinAgain = body.wouldJoinAgain
  const notes = body.notes?.trim() ?? ''

  if (!Number.isInteger(eventId) || eventId <= 0) {
    return NextResponse.json({ error: 'eventId must be a positive integer.' }, { status: 400 })
  }

  if (!Number.isInteger(venueRating) || venueRating < 1 || venueRating > 5) {
    return NextResponse.json({ error: 'venueRating must be between 1 and 5.' }, { status: 400 })
  }

  if (!Number.isInteger(groupRating) || groupRating < 1 || groupRating > 5) {
    return NextResponse.json({ error: 'groupRating must be between 1 and 5.' }, { status: 400 })
  }

  if (typeof wouldJoinAgain !== 'boolean') {
    return NextResponse.json({ error: 'wouldJoinAgain must be true or false.' }, { status: 400 })
  }

  try {
    const user = await getUserFromAccessToken(token)
    const adminClient = createServerSupabaseAdminClient()

    const { data: event, error: eventError } = await adminClient
      .from('events')
      .select('duration_minutes, id, restaurant_name, starts_at, title')
      .eq('id', eventId)
      .maybeSingle<EventRow>()

    if (eventError || !event) {
      return NextResponse.json({ error: 'Event not found.' }, { status: 404 })
    }

    const eventEnd = new Date(event.starts_at).getTime() + event.duration_minutes * 60 * 1000

    if (eventEnd > Date.now()) {
      return NextResponse.json(
        { error: 'Feedback opens after the event ends.' },
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

    if (!signup || !['going', 'attended'].includes(signup.status)) {
      return NextResponse.json(
        { error: 'Only attendees can leave feedback for this event.' },
        { status: 400 }
      )
    }

    const { error: feedbackError } = await adminClient
      .from('event_feedback')
      .upsert(
        {
          event_id: eventId,
          group_rating: groupRating,
          notes: notes || null,
          updated_at: new Date().toISOString(),
          user_id: user.id,
          venue_rating: venueRating,
          would_join_again: wouldJoinAgain,
        },
        { onConflict: 'event_id,user_id' }
      )

    if (feedbackError) {
      throw new Error(feedbackError.message)
    }

    await queueNotifications([
      {
        body: `Your feedback for ${event.title} at ${event.restaurant_name} has been recorded.`,
        duplicateBehavior: 'rearm',
        eventId: event.id,
        title: 'Feedback saved',
        type: 'event_update',
        userId: user.id,
      },
    ])

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to save feedback.',
      },
      { status: 500 }
    )
  }
}
