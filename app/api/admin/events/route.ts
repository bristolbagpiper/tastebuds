import { NextResponse } from 'next/server'

import { syncEventSignupScores } from '@/lib/event-operations'
import {
  MANHATTAN_SUBREGIONS,
  type EventIntent,
  type ManhattanSubregion,
  normalizeCuisineList,
} from '@/lib/events'
import { queueNotifications } from '@/lib/notifications'
import { requireAdminOrCron } from '@/lib/request-auth'
import { createServerSupabaseAdminClient } from '@/lib/supabase/server'

type CreateEventRequest = {
  capacity?: number
  description?: string
  durationMinutes?: number
  intent?: EventIntent
  minimumViableAttendees?: number
  restaurantCuisines?: string[]
  restaurantName?: string
  restaurantNeighbourhood?: string
  restaurantSubregion?: string
  startsAt?: string
  title?: string
}

type UpdateEventAction = 'cancel' | 'close' | 'reopen' | 'update'

type UpdateEventRequest = {
  action?: UpdateEventAction
  capacity?: number
  description?: string
  durationMinutes?: number
  eventId?: number
  intent?: EventIntent
  minimumViableAttendees?: number
  restaurantCuisines?: string[]
  restaurantName?: string
  restaurantNeighbourhood?: string
  restaurantSubregion?: string
  startsAt?: string
  status?: 'cancelled' | 'closed' | 'open'
  title?: string
}

type EventSummary = {
  attendeeCount: number
  attendees: EventAttendee[]
  capacity: number
  created_at: string
  description: string | null
  confirmedTodayCount: number
  dropoffCount: number
  duration_minutes: number
  id: number
  intent: EventIntent
  attendedCount: number
  minimum_viable_attendees: number
  noShowCount: number
  restaurant_cuisines: string[]
  restaurant_name: string
  restaurant_neighbourhood: string | null
  restaurant_subregion: string
  starts_at: string
  status: 'open' | 'closed' | 'cancelled'
  title: string
  waitlistCount: number
}

type EventAttendee = {
  cuisine_preferences: string[] | null
  day_of_confirmation_status: 'pending' | 'confirmed' | 'declined'
  display_name: string | null
  email: string | null
  neighbourhood: string | null
  personal_match_score: number
  personal_match_summary: string | null
  restaurant_match_score: number
  signup_status:
    | 'attended'
    | 'cancelled'
    | 'going'
    | 'no_show'
    | 'removed'
    | 'waitlisted'
  subregion: string | null
  user_id: string
}

type AdminAnalyticsSummary = {
  averageFillRate: number
  openEvents: number
  totalDayConfirmed: number
  totalAttended: number
  totalConfirmed: number
  totalDropped: number
  totalEvents: number
  totalNoShows: number
  totalWaitlisted: number
}

const EVENT_SUMMARY_SELECT =
  'capacity, created_at, description, duration_minutes, id, intent, minimum_viable_attendees, restaurant_cuisines, restaurant_name, restaurant_neighbourhood, restaurant_subregion, starts_at, status, title'

function isValidSubregion(value: string) {
  return MANHATTAN_SUBREGIONS.includes(value as ManhattanSubregion)
}

async function fetchEvents() {
  const adminClient = createServerSupabaseAdminClient()
  const { data: events, error } = await adminClient
    .from('events')
    .select(EVENT_SUMMARY_SELECT)
    .order('starts_at', { ascending: true })
    .limit(60)
    .returns<EventSummary[]>()

  if (error) {
    throw new Error(error.message)
  }

  const eventIds = (events ?? []).map((event) => event.id)

  if (eventIds.length === 0) {
    return {
      events: [] as EventSummary[],
      summary: {
        averageFillRate: 0,
        openEvents: 0,
        totalDayConfirmed: 0,
        totalAttended: 0,
        totalConfirmed: 0,
        totalDropped: 0,
        totalEvents: 0,
        totalNoShows: 0,
        totalWaitlisted: 0,
      } satisfies AdminAnalyticsSummary,
    }
  }

  const { data: signups, error: signupsError } = await adminClient
    .from('event_signups')
      .select(
      'day_of_confirmation_status, event_id, personal_match_score, personal_match_summary, restaurant_match_score, status, user_id'
    )
    .in('event_id', eventIds)
    .returns<
      {
        day_of_confirmation_status: 'pending' | 'confirmed' | 'declined'
        event_id: number
        personal_match_score: number
        personal_match_summary: string | null
        restaurant_match_score: number
        status: 'attended' | 'cancelled' | 'going' | 'no_show' | 'removed' | 'waitlisted'
        user_id: string
      }[]
    >()

  if (signupsError) {
    throw new Error(signupsError.message)
  }

  const attendeeCountByEvent = new Map<number, number>()
  const attendedCountByEvent = new Map<number, number>()
  const attendeesByEvent = new Map<number, EventAttendee[]>()
  const confirmedTodayCountByEvent = new Map<number, number>()
  const dropoffCountByEvent = new Map<number, number>()
  const noShowCountByEvent = new Map<number, number>()
  const waitlistCountByEvent = new Map<number, number>()
  const userIds = Array.from(
    new Set((signups ?? []).map((signup) => signup.user_id))
  )

  const { data: profiles, error: profilesError } = userIds.length
    ? await adminClient
        .from('profiles')
        .select(
          'cuisine_preferences, display_name, id, neighbourhood, subregion'
        )
        .in('id', userIds)
        .returns<
          {
            cuisine_preferences: string[] | null
            display_name: string | null
            id: string
            neighbourhood: string | null
            subregion: string | null
          }[]
        >()
    : { data: [], error: null }

  if (profilesError) {
    throw new Error(profilesError.message)
  }

  const profileById = new Map(
    (profiles ?? []).map((profile) => [profile.id, profile])
  )

  const emailByUserId = new Map<string, string | null>()

  for (const userId of userIds) {
    const { data: userData, error: userError } =
      await adminClient.auth.admin.getUserById(userId)

    if (userError) {
      throw new Error(userError.message)
    }

    emailByUserId.set(userId, userData.user?.email ?? null)
  }

  for (const signup of signups ?? []) {
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
    } else if (signup.status === 'waitlisted') {
      waitlistCountByEvent.set(
        signup.event_id,
        (waitlistCountByEvent.get(signup.event_id) ?? 0) + 1
      )
    } else if (signup.status === 'attended') {
      attendedCountByEvent.set(
        signup.event_id,
        (attendedCountByEvent.get(signup.event_id) ?? 0) + 1
      )
    } else if (signup.status === 'no_show') {
      noShowCountByEvent.set(
        signup.event_id,
        (noShowCountByEvent.get(signup.event_id) ?? 0) + 1
      )
    } else {
      dropoffCountByEvent.set(
        signup.event_id,
        (dropoffCountByEvent.get(signup.event_id) ?? 0) + 1
      )
    }

    const profile = profileById.get(signup.user_id)
    const nextAttendee: EventAttendee = {
      cuisine_preferences: profile?.cuisine_preferences ?? null,
      day_of_confirmation_status: signup.day_of_confirmation_status,
      display_name: profile?.display_name ?? null,
      email: emailByUserId.get(signup.user_id) ?? null,
      neighbourhood: profile?.neighbourhood ?? null,
      personal_match_score: signup.personal_match_score,
      personal_match_summary: signup.personal_match_summary,
      restaurant_match_score: signup.restaurant_match_score,
      signup_status: signup.status,
      subregion: profile?.subregion ?? null,
      user_id: signup.user_id,
    }

    attendeesByEvent.set(signup.event_id, [
      ...(attendeesByEvent.get(signup.event_id) ?? []),
      nextAttendee,
    ])
  }

  const mappedEvents = (events ?? []).map((event) => ({
    ...event,
    attendeeCount: attendeeCountByEvent.get(event.id) ?? 0,
    attendedCount: attendedCountByEvent.get(event.id) ?? 0,
    attendees: attendeesByEvent.get(event.id) ?? [],
    confirmedTodayCount: confirmedTodayCountByEvent.get(event.id) ?? 0,
    dropoffCount: dropoffCountByEvent.get(event.id) ?? 0,
    noShowCount: noShowCountByEvent.get(event.id) ?? 0,
    waitlistCount: waitlistCountByEvent.get(event.id) ?? 0,
  }))

  const totalEvents = mappedEvents.length
  const totalConfirmed = mappedEvents.reduce(
    (total, event) => total + event.attendeeCount,
    0
  )
  const totalWaitlisted = mappedEvents.reduce(
    (total, event) => total + event.waitlistCount,
    0
  )
  const totalAttended = mappedEvents.reduce(
    (total, event) => total + event.attendedCount,
    0
  )
  const totalDayConfirmed = mappedEvents.reduce(
    (total, event) => total + event.confirmedTodayCount,
    0
  )
  const totalNoShows = mappedEvents.reduce(
    (total, event) => total + event.noShowCount,
    0
  )
  const totalDropped = mappedEvents.reduce(
    (total, event) => total + event.dropoffCount,
    0
  )
  const averageFillRate =
    totalEvents === 0
      ? 0
      : Math.round(
          mappedEvents.reduce(
            (total, event) => total + event.attendeeCount / event.capacity,
            0
          ) *
            (100 / totalEvents)
        )

  return {
    events: mappedEvents,
    summary: {
      averageFillRate,
      openEvents: mappedEvents.filter((event) => event.status === 'open').length,
      totalDayConfirmed,
      totalAttended,
      totalConfirmed,
      totalDropped,
      totalEvents,
      totalNoShows,
      totalWaitlisted,
    } satisfies AdminAnalyticsSummary,
  }
}

function buildEventUpdateNotification(
  action: UpdateEventAction,
  event: EventSummary
) {
  if (action === 'cancel') {
    return {
      body: `${event.title} at ${event.restaurant_name} has been cancelled.`,
      title: 'Event cancelled',
    }
  }

  if (action === 'close') {
    return {
      body: `Signups are now closed for ${event.title} at ${event.restaurant_name}.`,
      title: 'Event signup closed',
    }
  }

  if (action === 'reopen') {
    return {
      body: `${event.title} at ${event.restaurant_name} has reopened for signups.`,
      title: 'Event reopened',
    }
  }

  return {
    body: `${event.title} at ${event.restaurant_name} has been updated. Check latest details on your dashboard.`,
    title: 'Event updated',
  }
}

async function notifyAttendeesForUpdate(action: UpdateEventAction, event: EventSummary) {
  const adminClient = createServerSupabaseAdminClient()
  const { data: attendeeRows, error } = await adminClient
    .from('event_signups')
    .select('user_id')
    .eq('event_id', event.id)
    .in('status', ['going', 'waitlisted'])
    .returns<{ user_id: string }[]>()

  if (error) {
    throw new Error(error.message)
  }

  if (!attendeeRows || attendeeRows.length === 0) {
    return
  }

  const notification = buildEventUpdateNotification(action, event)

  await queueNotifications(
    attendeeRows.map((attendee) => ({
      body: notification.body,
      eventId: event.id,
      title: notification.title,
      type: 'event_update',
      userId: attendee.user_id,
    }))
  )
}

export async function GET(request: Request) {
  const adminCheck = await requireAdminOrCron(request, {
    allowAdmin: true,
    allowCron: false,
  })

  if ('error' in adminCheck) {
    return adminCheck.error
  }

  try {
    const { events, summary } = await fetchEvents()

    return NextResponse.json({
      events,
      ok: true,
      summary,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to load admin events.',
      },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  const adminCheck = await requireAdminOrCron(request, {
    allowAdmin: true,
    allowCron: false,
  })

  if ('error' in adminCheck) {
    return adminCheck.error
  }

  let body: CreateEventRequest = {}

  try {
    body = (await request.json()) as CreateEventRequest
  } catch {
    body = {}
  }

  const title = body.title?.trim()
  const restaurantName = body.restaurantName?.trim()
  const restaurantSubregion = body.restaurantSubregion?.trim() ?? ''
  const restaurantNeighbourhood = body.restaurantNeighbourhood?.trim() ?? ''
  const intent = body.intent
  const startsAt = body.startsAt
  const description = body.description?.trim() ?? ''
  const capacity = Number(body.capacity ?? 0)
  const durationMinutes = Number(body.durationMinutes ?? 120)
  const minimumViableAttendees = Number(body.minimumViableAttendees ?? 2)
  const cuisines = normalizeCuisineList(body.restaurantCuisines ?? [])

  if (!title || !restaurantName || !intent || !startsAt) {
    return NextResponse.json(
      {
        error: 'title, intent, startsAt, and restaurantName are required.',
      },
      { status: 400 }
    )
  }

  if (!isValidSubregion(restaurantSubregion)) {
    return NextResponse.json(
      {
        error: 'restaurantSubregion must be Uptown, Midtown, or Downtown.',
      },
      { status: 400 }
    )
  }

  if (!Number.isFinite(capacity) || capacity < 2 || capacity > 200) {
    return NextResponse.json(
      {
        error: 'capacity must be a number between 2 and 200.',
      },
      { status: 400 }
    )
  }

  if (
    !Number.isFinite(durationMinutes) ||
    durationMinutes < 30 ||
    durationMinutes > 360
  ) {
    return NextResponse.json(
      {
        error: 'durationMinutes must be a number between 30 and 360.',
      },
      { status: 400 }
    )
  }

  if (
    !Number.isFinite(minimumViableAttendees) ||
    minimumViableAttendees < 2 ||
    minimumViableAttendees > capacity
  ) {
    return NextResponse.json(
      {
        error: 'minimumViableAttendees must be between 2 and capacity.',
      },
      { status: 400 }
    )
  }

  const startsAtDate = new Date(startsAt)

  if (Number.isNaN(startsAtDate.getTime())) {
    return NextResponse.json(
      {
        error: 'startsAt must be a valid datetime.',
      },
      { status: 400 }
    )
  }

  try {
    const adminClient = createServerSupabaseAdminClient()
    const { data: insertedEvent, error } = await adminClient
      .from('events')
      .insert({
        capacity,
        created_by: adminCheck.kind === 'admin' ? adminCheck.user.id : null,
        description: description || null,
        duration_minutes: durationMinutes,
        intent,
        minimum_viable_attendees: minimumViableAttendees,
        restaurant_cuisines: cuisines,
        restaurant_name: restaurantName,
        restaurant_neighbourhood: restaurantNeighbourhood || null,
        restaurant_subregion: restaurantSubregion,
        starts_at: startsAtDate.toISOString(),
        title,
      })
      .select(EVENT_SUMMARY_SELECT)
      .single<EventSummary>()

    if (error || !insertedEvent) {
      throw new Error(error?.message ?? 'Failed to create event.')
    }

    return NextResponse.json({
      event: {
        ...insertedEvent,
        attendeeCount: 0,
        attendedCount: 0,
        attendees: [],
        confirmedTodayCount: 0,
        dropoffCount: 0,
        noShowCount: 0,
        waitlistCount: 0,
      },
      ok: true,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to create event.',
      },
      { status: 500 }
    )
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

  let body: UpdateEventRequest = {}

  try {
    body = (await request.json()) as UpdateEventRequest
  } catch {
    body = {}
  }

  const eventId = Number(body.eventId)

  if (!Number.isInteger(eventId) || eventId <= 0) {
    return NextResponse.json(
      {
        error: 'eventId must be a valid positive integer.',
      },
      { status: 400 }
    )
  }

  const action: UpdateEventAction = body.action ?? 'update'
  const updates: Record<string, unknown> = {}

  const adminClient = createServerSupabaseAdminClient()
  const { data: currentEvent, error: currentEventError } = await adminClient
    .from('events')
    .select('capacity, minimum_viable_attendees')
    .eq('id', eventId)
    .maybeSingle<{ capacity: number; minimum_viable_attendees: number }>()

  if (currentEventError) {
    return NextResponse.json(
      { error: currentEventError.message },
      { status: 500 }
    )
  }

  if (!currentEvent) {
    return NextResponse.json({ error: 'Event not found.' }, { status: 404 })
  }

  if (action === 'close') {
    updates.status = 'closed'
  } else if (action === 'cancel') {
    updates.status = 'cancelled'
  } else if (action === 'reopen') {
    updates.status = 'open'
  }

  if (typeof body.title === 'string') {
    const nextTitle = body.title.trim()
    if (!nextTitle) {
      return NextResponse.json(
        { error: 'title cannot be empty.' },
        { status: 400 }
      )
    }
    updates.title = nextTitle
  }

  if (typeof body.restaurantName === 'string') {
    const nextRestaurantName = body.restaurantName.trim()
    if (!nextRestaurantName) {
      return NextResponse.json(
        { error: 'restaurantName cannot be empty.' },
        { status: 400 }
      )
    }
    updates.restaurant_name = nextRestaurantName
  }

  if (typeof body.restaurantNeighbourhood === 'string') {
    const nextNeighbourhood = body.restaurantNeighbourhood.trim()
    updates.restaurant_neighbourhood = nextNeighbourhood || null
  }

  if (typeof body.restaurantSubregion === 'string') {
    const nextSubregion = body.restaurantSubregion.trim()
    if (!isValidSubregion(nextSubregion)) {
      return NextResponse.json(
        {
          error: 'restaurantSubregion must be Uptown, Midtown, or Downtown.',
        },
        { status: 400 }
      )
    }
    updates.restaurant_subregion = nextSubregion
  }

  if (body.intent) {
    if (body.intent !== 'dating' && body.intent !== 'friendship') {
      return NextResponse.json(
        { error: 'intent must be dating or friendship.' },
        { status: 400 }
      )
    }
    updates.intent = body.intent
  }

  if (typeof body.description === 'string') {
    const nextDescription = body.description.trim()
    updates.description = nextDescription || null
  }

  if (Array.isArray(body.restaurantCuisines)) {
    updates.restaurant_cuisines = normalizeCuisineList(body.restaurantCuisines)
  }

  if (body.startsAt) {
    const startsAtDate = new Date(body.startsAt)

    if (Number.isNaN(startsAtDate.getTime())) {
      return NextResponse.json(
        {
          error: 'startsAt must be a valid datetime.',
        },
        { status: 400 }
      )
    }

    updates.starts_at = startsAtDate.toISOString()
  }

  if (typeof body.capacity === 'number') {
    if (!Number.isFinite(body.capacity) || body.capacity < 2 || body.capacity > 200) {
      return NextResponse.json(
        { error: 'capacity must be a number between 2 and 200.' },
        { status: 400 }
      )
    }

    const nextMinimumViable =
      typeof body.minimumViableAttendees === 'number'
        ? body.minimumViableAttendees
        : currentEvent.minimum_viable_attendees

    if (body.capacity < nextMinimumViable) {
      return NextResponse.json(
        {
          error: 'capacity cannot be lower than minimumViableAttendees.',
        },
        { status: 400 }
      )
    }

    updates.capacity = body.capacity
  }

  if (typeof body.durationMinutes === 'number') {
    if (
      !Number.isFinite(body.durationMinutes) ||
      body.durationMinutes < 30 ||
      body.durationMinutes > 360
    ) {
      return NextResponse.json(
        { error: 'durationMinutes must be a number between 30 and 360.' },
        { status: 400 }
      )
    }

    updates.duration_minutes = body.durationMinutes
  }

  if (typeof body.minimumViableAttendees === 'number') {
    if (
      !Number.isFinite(body.minimumViableAttendees) ||
      body.minimumViableAttendees < 2
    ) {
      return NextResponse.json(
        { error: 'minimumViableAttendees must be at least 2.' },
        { status: 400 }
      )
    }

    const nextCapacity =
      typeof body.capacity === 'number' ? body.capacity : currentEvent.capacity

    if (body.minimumViableAttendees > nextCapacity) {
      return NextResponse.json(
        { error: 'minimumViableAttendees cannot exceed capacity.' },
        { status: 400 }
      )
    }

    updates.minimum_viable_attendees = body.minimumViableAttendees
  }

  if (body.status) {
    updates.status = body.status
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: 'No valid fields supplied for update.' },
      { status: 400 }
    )
  }

  try {
    const { data: updatedEvent, error } = await adminClient
      .from('events')
      .update(updates)
      .eq('id', eventId)
      .select(EVENT_SUMMARY_SELECT)
      .maybeSingle<EventSummary>()

    if (error) {
      throw new Error(error.message)
    }

    if (!updatedEvent) {
      return NextResponse.json({ error: 'Event not found.' }, { status: 404 })
    }

    const shouldRecomputeScores =
      'intent' in updates ||
      'restaurant_subregion' in updates ||
      'duration_minutes' in updates ||
      'restaurant_cuisines' in updates

    if (shouldRecomputeScores && updatedEvent.status !== 'cancelled') {
      await syncEventSignupScores(adminClient, updatedEvent.id)
    }

    await notifyAttendeesForUpdate(action, updatedEvent)

    const { count: attendeeCount, error: countError } = await adminClient
      .from('event_signups')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', updatedEvent.id)
      .eq('status', 'going')

    if (countError) {
      throw new Error(countError.message)
    }

    return NextResponse.json({
      event: {
        ...updatedEvent,
        attendeeCount: attendeeCount ?? 0,
        attendedCount: 0,
        attendees: [],
        confirmedTodayCount: 0,
        dropoffCount: 0,
        noShowCount: 0,
        waitlistCount: 0,
      },
      ok: true,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to update event.',
      },
      { status: 500 }
    )
  }
}
