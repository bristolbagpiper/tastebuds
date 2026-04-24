import { NextResponse } from 'next/server'

import {
  refreshEventViability,
  syncEventSignupScores,
} from '@/lib/event-operations'
import {
  type EventIntent,
  type ManhattanSubregion,
  normalizeCrowdList,
  normalizeCuisineList,
  normalizeMusicList,
  normalizeSceneList,
  normalizeSettingList,
  normalizeVenueEnergy,
  normalizeVenuePrice,
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
  restaurantId?: number
  startsAt?: string
  title?: string
}

type UpdateEventAction =
  | 'archive'
  | 'cancel'
  | 'cancel-low-confirmation'
  | 'close'
  | 'force-proceed'
  | 'reopen'
  | 'unarchive'
  | 'update'

type UpdateEventRequest = {
  action?: UpdateEventAction
  capacity?: number
  description?: string
  durationMinutes?: number
  eventId?: number
  intent?: EventIntent
  minimumViableAttendees?: number
  restaurantId?: number
  startsAt?: string
  status?: 'cancelled' | 'closed' | 'open'
  title?: string
}

type EventSummary = {
  archived_at: string | null
  attendeeCount: number
  attendees: EventAttendee[]
  attendedCount: number
  average_group_rating: number | null
  average_venue_rating: number | null
  capacity: number
  confirmedTodayCount: number
  created_at: string
  description: string | null
  dropoffCount: number
  duration_minutes: number
  feedback_count: number
  id: number
  intent: EventIntent
  minimum_viable_attendees: number
  noShowCount: number
  restaurant_id: number | null
  restaurant_cuisines: string[]
  restaurant_name: string
  restaurant_neighbourhood: string | null
  restaurant_subregion: string
  starts_at: string
  status: 'open' | 'closed' | 'cancelled'
  title: string
  venue_crowd: string[]
  venue_energy: string | null
  venue_latitude: number | null
  venue_longitude: number | null
  venue_music: string[]
  venue_price: string | null
  venue_scene: string[]
  venue_setting: string[]
  viability_status: 'healthy' | 'at_risk' | 'forced_go' | 'cancelled_low_confirmations'
  waitlistCount: number
  would_join_again_count: number
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
  totalAtRisk: number
  totalDayConfirmed: number
  totalAttended: number
  totalConfirmed: number
  totalDropped: number
  totalEvents: number
  totalFeedback: number
  totalNoShows: number
  totalWaitlisted: number
}

type RestaurantSnapshot = {
  archived_at: string | null
  cuisines: string[] | null
  id: number
  name: string
  neighbourhood: string | null
  subregion: ManhattanSubregion
  venue_crowd: string[] | null
  venue_energy: string | null
  venue_latitude: number | null
  venue_longitude: number | null
  venue_music: string[] | null
  venue_price: string | null
  venue_scene: string[] | null
  venue_setting: string[] | null
}

const EVENT_SUMMARY_SELECT =
  'archived_at, capacity, created_at, description, duration_minutes, id, intent, minimum_viable_attendees, restaurant_id, restaurant_cuisines, restaurant_name, restaurant_neighbourhood, restaurant_subregion, starts_at, status, title, venue_crowd, venue_energy, venue_latitude, venue_longitude, venue_music, venue_price, venue_scene, venue_setting, viability_status'

function hasEventEnded(startsAt: string, durationMinutes: number) {
  return new Date(startsAt).getTime() + durationMinutes * 60 * 1000 <= Date.now()
}

async function getRestaurantSnapshot(
  restaurantId: number
): Promise<RestaurantSnapshot> {
  const adminClient = createServerSupabaseAdminClient()
  const { data: restaurant, error } = await adminClient
    .from('restaurants')
    .select(
      'archived_at, cuisines, id, name, neighbourhood, subregion, venue_crowd, venue_energy, venue_latitude, venue_longitude, venue_music, venue_price, venue_scene, venue_setting'
    )
    .eq('id', restaurantId)
    .maybeSingle<RestaurantSnapshot>()

  if (error || !restaurant) {
    throw new Error(error?.message ?? 'Restaurant not found.')
  }

  if (restaurant.archived_at) {
    throw new Error('Archived restaurants cannot be scheduled.')
  }

  return restaurant
}

async function fetchEvents(includeArchived: boolean) {
  const adminClient = createServerSupabaseAdminClient()

  let eventsQuery = adminClient
    .from('events')
    .select(EVENT_SUMMARY_SELECT)
    .order('starts_at', { ascending: true })
    .limit(60)

  if (!includeArchived) {
    eventsQuery = eventsQuery.is('archived_at', null)
  }

  const { data: events, error } = await eventsQuery
    .returns<
      Omit<
        EventSummary,
        | 'attendeeCount'
        | 'attendees'
        | 'attendedCount'
        | 'average_group_rating'
        | 'average_venue_rating'
        | 'confirmedTodayCount'
        | 'dropoffCount'
        | 'feedback_count'
        | 'noShowCount'
        | 'waitlistCount'
        | 'would_join_again_count'
      >[]
    >()

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
        totalAtRisk: 0,
        totalDayConfirmed: 0,
        totalAttended: 0,
        totalConfirmed: 0,
        totalDropped: 0,
        totalEvents: 0,
        totalFeedback: 0,
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

  const { data: feedbackRows, error: feedbackError } = await adminClient
    .from('event_feedback')
    .select('event_id, group_rating, venue_rating, would_join_again')
    .in('event_id', eventIds)
    .returns<
      {
        event_id: number
        group_rating: number
        venue_rating: number
        would_join_again: boolean
      }[]
    >()

  if (feedbackError) {
    throw new Error(feedbackError.message)
  }

  const attendeeCountByEvent = new Map<number, number>()
  const attendedCountByEvent = new Map<number, number>()
  const attendeesByEvent = new Map<number, EventAttendee[]>()
  const confirmedTodayCountByEvent = new Map<number, number>()
  const dropoffCountByEvent = new Map<number, number>()
  const noShowCountByEvent = new Map<number, number>()
  const waitlistCountByEvent = new Map<number, number>()
  const userIds = Array.from(new Set((signups ?? []).map((signup) => signup.user_id)))

  const { data: profiles, error: profilesError } = userIds.length
    ? await adminClient
        .from('profiles')
        .select('cuisine_preferences, display_name, id, neighbourhood, subregion')
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

  const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]))
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

  const feedbackByEvent = new Map<
    number,
    {
      average_group_rating: number | null
      average_venue_rating: number | null
      feedback_count: number
      would_join_again_count: number
    }
  >()

  for (const eventId of eventIds) {
    const eventFeedback = (feedbackRows ?? []).filter((row) => row.event_id === eventId)

    feedbackByEvent.set(eventId, {
      average_group_rating:
        eventFeedback.length > 0
          ? Number(
              (
                eventFeedback.reduce((sum, row) => sum + row.group_rating, 0) /
                eventFeedback.length
              ).toFixed(1)
            )
          : null,
      average_venue_rating:
        eventFeedback.length > 0
          ? Number(
              (
                eventFeedback.reduce((sum, row) => sum + row.venue_rating, 0) /
                eventFeedback.length
              ).toFixed(1)
            )
          : null,
      feedback_count: eventFeedback.length,
      would_join_again_count: eventFeedback.filter((row) => row.would_join_again).length,
    })
  }

  const mappedEvents: EventSummary[] = (events ?? []).map((event) => ({
    ...event,
    attendeeCount: attendeeCountByEvent.get(event.id) ?? 0,
    attendedCount: attendedCountByEvent.get(event.id) ?? 0,
    attendees: attendeesByEvent.get(event.id) ?? [],
    average_group_rating: feedbackByEvent.get(event.id)?.average_group_rating ?? null,
    average_venue_rating: feedbackByEvent.get(event.id)?.average_venue_rating ?? null,
    confirmedTodayCount: confirmedTodayCountByEvent.get(event.id) ?? 0,
    dropoffCount: dropoffCountByEvent.get(event.id) ?? 0,
    feedback_count: feedbackByEvent.get(event.id)?.feedback_count ?? 0,
    noShowCount: noShowCountByEvent.get(event.id) ?? 0,
    waitlistCount: waitlistCountByEvent.get(event.id) ?? 0,
    would_join_again_count: feedbackByEvent.get(event.id)?.would_join_again_count ?? 0,
  }))

  const totalEvents = mappedEvents.length
  const totalConfirmed = mappedEvents.reduce((total, event) => total + event.attendeeCount, 0)
  const totalWaitlisted = mappedEvents.reduce((total, event) => total + event.waitlistCount, 0)
  const totalAttended = mappedEvents.reduce((total, event) => total + event.attendedCount, 0)
  const totalDayConfirmed = mappedEvents.reduce(
    (total, event) => total + event.confirmedTodayCount,
    0
  )
  const totalNoShows = mappedEvents.reduce((total, event) => total + event.noShowCount, 0)
  const totalDropped = mappedEvents.reduce((total, event) => total + event.dropoffCount, 0)
  const totalFeedback = mappedEvents.reduce((total, event) => total + event.feedback_count, 0)
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
      totalAtRisk: mappedEvents.filter((event) => event.viability_status === 'at_risk')
        .length,
      totalDayConfirmed,
      totalAttended,
      totalConfirmed,
      totalDropped,
      totalEvents,
      totalFeedback,
      totalNoShows,
      totalWaitlisted,
    } satisfies AdminAnalyticsSummary,
  }
}

function buildEventUpdateNotification(action: UpdateEventAction, event: EventSummary) {
  if (action === 'cancel-low-confirmation') {
    return {
      body: `${event.title} at ${event.restaurant_name} has been cancelled because same-day confirmations did not hold up.`,
      title: 'Event cancelled for low confirmations',
    }
  }

  if (action === 'force-proceed') {
    return {
      body: `${event.title} at ${event.restaurant_name} is still going ahead. The host team has forced it to proceed despite the low same-day count.`,
      title: 'Event will still proceed',
    }
  }

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
    const includeArchived = new URL(request.url).searchParams.get('includeArchived') === 'true'
    const { events, summary } = await fetchEvents(includeArchived)

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
  const restaurantId = Number(body.restaurantId)
  const intent = body.intent
  const startsAt = body.startsAt
  const description = body.description?.trim() ?? ''
  const capacity = Number(body.capacity ?? 0)
  const durationMinutes = Number(body.durationMinutes ?? 120)
  const minimumViableAttendees = Number(body.minimumViableAttendees ?? 2)

  if (!title || !intent || !startsAt || !Number.isInteger(restaurantId) || restaurantId <= 0) {
    return NextResponse.json(
      {
        error: 'title, intent, startsAt, and restaurantId are required.',
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

  if (!Number.isFinite(durationMinutes) || durationMinutes < 30 || durationMinutes > 360) {
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
    const restaurant = await getRestaurantSnapshot(restaurantId)
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
        restaurant_cuisines: normalizeCuisineList(restaurant.cuisines),
        restaurant_id: restaurant.id,
        restaurant_name: restaurant.name,
        restaurant_neighbourhood: restaurant.neighbourhood,
        restaurant_subregion: restaurant.subregion,
        starts_at: startsAtDate.toISOString(),
        title,
        venue_crowd: normalizeCrowdList(restaurant.venue_crowd),
        venue_energy: normalizeVenueEnergy(restaurant.venue_energy),
        venue_latitude: restaurant.venue_latitude,
        venue_longitude: restaurant.venue_longitude,
        venue_music: normalizeMusicList(restaurant.venue_music),
        venue_price: normalizeVenuePrice(restaurant.venue_price),
        venue_scene: normalizeSceneList(restaurant.venue_scene),
        venue_setting: normalizeSettingList(restaurant.venue_setting),
        viability_status: 'healthy',
      })
      .select(EVENT_SUMMARY_SELECT)
      .single<
        Omit<
          EventSummary,
          | 'attendeeCount'
          | 'attendees'
          | 'attendedCount'
          | 'average_group_rating'
          | 'average_venue_rating'
          | 'confirmedTodayCount'
          | 'dropoffCount'
          | 'feedback_count'
          | 'noShowCount'
          | 'waitlistCount'
          | 'would_join_again_count'
        >
      >()

    if (error || !insertedEvent) {
      throw new Error(error?.message ?? 'Failed to create event.')
    }

    return NextResponse.json({
      event: {
        ...insertedEvent,
        attendeeCount: 0,
        attendees: [],
        attendedCount: 0,
        average_group_rating: null,
        average_venue_rating: null,
        archived_at: null,
        confirmedTodayCount: 0,
        dropoffCount: 0,
        feedback_count: 0,
        noShowCount: 0,
        waitlistCount: 0,
        would_join_again_count: 0,
      } satisfies EventSummary,
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
    .select(
      'archived_at, capacity, duration_minutes, minimum_viable_attendees, restaurant_name, starts_at, status, title, venue_latitude, venue_longitude, viability_status'
      
    )
    .eq('id', eventId)
    .maybeSingle<{
      archived_at: string | null
      capacity: number
      duration_minutes: number
      minimum_viable_attendees: number
      restaurant_name: string
      starts_at: string
      status: 'open' | 'closed' | 'cancelled'
      title: string
      venue_latitude: number | null
      venue_longitude: number | null
      viability_status: EventSummary['viability_status']
    }>()

  if (currentEventError) {
    return NextResponse.json({ error: currentEventError.message }, { status: 500 })
  }

  if (!currentEvent) {
    return NextResponse.json({ error: 'Event not found.' }, { status: 404 })
  }

  if (action === 'close') {
    updates.status = 'closed'
  } else if (action === 'archive') {
    if (!hasEventEnded(currentEvent.starts_at, currentEvent.duration_minutes)) {
      return NextResponse.json(
        { error: 'Only past events can be archived.' },
        { status: 400 }
      )
    }
    updates.archived_at = currentEvent.archived_at ?? new Date().toISOString()
  } else if (action === 'unarchive') {
    updates.archived_at = null
  } else if (action === 'cancel') {
    updates.status = 'cancelled'
    updates.viability_status = 'healthy'
  } else if (action === 'reopen') {
    updates.status = 'open'
    updates.viability_status = 'healthy'
  } else if (action === 'force-proceed') {
    updates.status = 'open'
    updates.viability_status = 'forced_go'
  } else if (action === 'cancel-low-confirmation') {
    updates.status = 'cancelled'
    updates.viability_status = 'cancelled_low_confirmations'
  }

  if (typeof body.title === 'string') {
    const nextTitle = body.title.trim()
    if (!nextTitle) {
      return NextResponse.json({ error: 'title cannot be empty.' }, { status: 400 })
    }
    updates.title = nextTitle
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

  if (typeof body.restaurantId === 'number') {
    if (!Number.isInteger(body.restaurantId) || body.restaurantId <= 0) {
      return NextResponse.json(
        { error: 'restaurantId must be a valid positive integer.' },
        { status: 400 }
      )
    }

    const restaurant = await getRestaurantSnapshot(body.restaurantId)
    updates.restaurant_id = restaurant.id
    updates.restaurant_cuisines = normalizeCuisineList(restaurant.cuisines)
    updates.restaurant_name = restaurant.name
    updates.restaurant_neighbourhood = restaurant.neighbourhood
    updates.restaurant_subregion = restaurant.subregion
    updates.venue_crowd = normalizeCrowdList(restaurant.venue_crowd)
    updates.venue_energy = normalizeVenueEnergy(restaurant.venue_energy)
    updates.venue_latitude = restaurant.venue_latitude
    updates.venue_longitude = restaurant.venue_longitude
    updates.venue_music = normalizeMusicList(restaurant.venue_music)
    updates.venue_price = normalizeVenuePrice(restaurant.venue_price)
    updates.venue_scene = normalizeSceneList(restaurant.venue_scene)
    updates.venue_setting = normalizeSettingList(restaurant.venue_setting)
  }

  if (body.startsAt) {
    const startsAtDate = new Date(body.startsAt)

    if (Number.isNaN(startsAtDate.getTime())) {
      return NextResponse.json({ error: 'startsAt must be a valid datetime.' }, { status: 400 })
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
        { error: 'capacity cannot be lower than minimumViableAttendees.' },
        { status: 400 }
      )
    }

    updates.capacity = body.capacity
  }

  if (typeof body.durationMinutes === 'number') {
    if (!Number.isFinite(body.durationMinutes) || body.durationMinutes < 30 || body.durationMinutes > 360) {
      return NextResponse.json(
        { error: 'durationMinutes must be a number between 30 and 360.' },
        { status: 400 }
      )
    }

    updates.duration_minutes = body.durationMinutes
  }

  if (typeof body.minimumViableAttendees === 'number') {
    if (!Number.isFinite(body.minimumViableAttendees) || body.minimumViableAttendees < 2) {
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
      .maybeSingle<
        Omit<
          EventSummary,
          | 'attendeeCount'
          | 'attendees'
          | 'attendedCount'
          | 'average_group_rating'
          | 'average_venue_rating'
          | 'confirmedTodayCount'
          | 'dropoffCount'
          | 'feedback_count'
          | 'noShowCount'
          | 'waitlistCount'
          | 'would_join_again_count'
        >
      >()

    if (error) {
      throw new Error(error.message)
    }

    if (!updatedEvent) {
      return NextResponse.json({ error: 'Event not found.' }, { status: 404 })
    }

    if (['cancel', 'cancel-low-confirmation'].includes(action)) {
      const { error: cancelSignupsError } = await adminClient
        .from('event_signups')
        .update({
          status: 'cancelled',
          updated_at: new Date().toISOString(),
        })
        .eq('event_id', updatedEvent.id)
        .in('status', ['going', 'waitlisted'])

      if (cancelSignupsError) {
        throw new Error(cancelSignupsError.message)
      }
    }

    const shouldRecomputeScores =
      'intent' in updates ||
      'restaurant_id' in updates ||
      'restaurant_subregion' in updates ||
      'duration_minutes' in updates ||
      'restaurant_cuisines' in updates ||
      'venue_crowd' in updates ||
      'venue_energy' in updates ||
      'venue_latitude' in updates ||
      'venue_longitude' in updates ||
      'venue_music' in updates ||
      'venue_price' in updates ||
      'venue_scene' in updates ||
      'venue_setting' in updates

    if (shouldRecomputeScores && updatedEvent.status !== 'cancelled') {
      await syncEventSignupScores(adminClient, updatedEvent.id)
    }

    if (updatedEvent.status !== 'cancelled') {
      await refreshEventViability(adminClient, updatedEvent.id)
    }

    if (action !== 'archive' && action !== 'unarchive') {
      await notifyAttendeesForUpdate(action, {
        ...updatedEvent,
        attendeeCount: 0,
        attendees: [],
        attendedCount: 0,
        average_group_rating: null,
        average_venue_rating: null,
        confirmedTodayCount: 0,
        dropoffCount: 0,
        feedback_count: 0,
        noShowCount: 0,
        waitlistCount: 0,
        would_join_again_count: 0,
      })
    }

    return NextResponse.json({
      event: {
        ...updatedEvent,
        attendeeCount: 0,
        attendees: [],
        attendedCount: 0,
        average_group_rating: null,
        average_venue_rating: null,
        confirmedTodayCount: 0,
        dropoffCount: 0,
        feedback_count: 0,
        noShowCount: 0,
        waitlistCount: 0,
        would_join_again_count: 0,
      } satisfies EventSummary,
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

export async function DELETE(request: Request) {
  const adminCheck = await requireAdminOrCron(request, {
    allowAdmin: true,
    allowCron: false,
  })

  if ('error' in adminCheck) {
    return adminCheck.error
  }

  let body: { eventId?: number } = {}

  try {
    body = (await request.json()) as { eventId?: number }
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

  const adminClient = createServerSupabaseAdminClient()

  const { data: currentEvent, error: currentEventError } = await adminClient
    .from('events')
    .select('duration_minutes, starts_at')
    .eq('id', eventId)
    .maybeSingle<{
      duration_minutes: number
      starts_at: string
    }>()

  if (currentEventError) {
    return NextResponse.json({ error: currentEventError.message }, { status: 500 })
  }

  if (!currentEvent) {
    return NextResponse.json({ error: 'Event not found.' }, { status: 404 })
  }

  if (!hasEventEnded(currentEvent.starts_at, currentEvent.duration_minutes)) {
    return NextResponse.json(
      { error: 'Only past events can be deleted.' },
      { status: 400 }
    )
  }

  const { error } = await adminClient.from('events').delete().eq('id', eventId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
