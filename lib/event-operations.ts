import 'server-only'

import {
  type EventIntent,
} from '@/lib/events'
import {
  getHoursUntilEvent,
  hasEventStarted,
  isSameEventDayInNewYork,
} from '@/lib/event-time'
import { recomputeEventSignupScores } from '@/lib/event-signups'
import { queueNotifications } from '@/lib/notifications'
import type { createServerSupabaseAdminClient } from '@/lib/supabase/server'

type AdminClient = ReturnType<typeof createServerSupabaseAdminClient>
type EventViabilityStatus =
  | 'healthy'
  | 'at_risk'
  | 'forced_go'
  | 'cancelled_low_confirmations'

type EventScoreRow = {
  capacity: number
  duration_minutes: number
  id: number
  intent: EventIntent
  minimum_viable_attendees: number
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
  viability_status: EventViabilityStatus
}

type SignupScoreRow = {
  created_at: string
  day_of_confirmation_status: 'pending' | 'confirmed' | 'declined'
  status: 'going' | 'cancelled' | 'removed' | 'no_show' | 'attended'
  user_id: string
}

async function getEventForScoring(adminClient: AdminClient, eventId: number) {
  const { data: event, error } = await adminClient
    .from('events')
    .select(
      'capacity, duration_minutes, id, intent, minimum_viable_attendees, restaurant_cuisines, restaurant_name, restaurant_subregion, starts_at, status, title, venue_crowd, venue_energy, venue_latitude, venue_longitude, venue_music, venue_price, venue_scene, venue_setting, viability_status'
    )
    .eq('id', eventId)
    .maybeSingle<EventScoreRow>()

  if (error || !event) {
    throw new Error(error?.message ?? 'Event not found.')
  }

  return event
}

async function getSignupRows(adminClient: AdminClient, eventId: number) {
  const { data, error } = await adminClient
    .from('event_signups')
    .select('created_at, day_of_confirmation_status, status, user_id')
    .eq('event_id', eventId)
    .returns<SignupScoreRow[]>()

  if (error) {
    throw new Error(error.message)
  }

  return data ?? []
}

export async function syncEventSignupScores(
  adminClient: AdminClient,
  eventId: number
) {
  await recomputeEventSignupScores(adminClient, eventId)
}

export async function refreshEventViability(
  adminClient: AdminClient,
  eventId: number
) {
  const event = await getEventForScoring(adminClient, eventId)
  const signupRows = await getSignupRows(adminClient, eventId)
  const activeAttendeeUserIds = signupRows
    .filter((signup) => signup.status === 'going')
    .map((signup) => signup.user_id)
  const confirmedTodayCount = signupRows.filter(
    (signup) =>
      signup.status === 'going' &&
      signup.day_of_confirmation_status === 'confirmed'
  ).length

  let nextViabilityStatus: EventViabilityStatus = event.viability_status

  if (event.status === 'cancelled') {
    nextViabilityStatus =
      event.viability_status === 'cancelled_low_confirmations'
        ? 'cancelled_low_confirmations'
        : 'healthy'
  } else if (event.viability_status === 'forced_go') {
    nextViabilityStatus = 'forced_go'
  } else if (
    isSameEventDayInNewYork(event.starts_at) &&
    !hasEventStarted(event.starts_at)
  ) {
    nextViabilityStatus =
      confirmedTodayCount < event.minimum_viable_attendees ? 'at_risk' : 'healthy'
  } else {
    nextViabilityStatus = 'healthy'
  }

  if (nextViabilityStatus !== event.viability_status) {
    const { error: viabilityError } = await adminClient
      .from('events')
      .update({ viability_status: nextViabilityStatus })
      .eq('id', eventId)

    if (viabilityError) {
      throw new Error(viabilityError.message)
    }

    if (nextViabilityStatus === 'at_risk' && activeAttendeeUserIds.length > 0) {
      await queueNotifications(
        activeAttendeeUserIds.map((userId) => ({
          body: `${event.title} at ${event.restaurant_name} is now at risk. Too few people have confirmed today, so check your dashboard and decide whether you still want to go.`,
          duplicateBehavior: 'skip',
          eventId: event.id,
          title: 'Event at risk',
          type: 'event_at_risk',
          userId,
        }))
      )
    }
  }

  return {
    confirmedTodayCount,
    status: nextViabilityStatus,
  }
}

export async function refreshUpcomingEventViability(adminClient: AdminClient) {
  const now = new Date()
  const { data: events, error } = await adminClient
    .from('events')
    .select(
      'capacity, duration_minutes, id, intent, minimum_viable_attendees, restaurant_cuisines, restaurant_name, restaurant_subregion, starts_at, status, title, venue_crowd, venue_energy, venue_latitude, venue_longitude, venue_music, venue_price, venue_scene, venue_setting, viability_status'
    )
    .neq('status', 'cancelled')
    .is('archived_at', null)
    .gte('starts_at', new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString())
    .lte('starts_at', new Date(now.getTime() + 36 * 60 * 60 * 1000).toISOString())
    .returns<EventScoreRow[]>()

  if (error) {
    throw new Error(error.message)
  }

  let atRiskEvents = 0

  for (const event of events ?? []) {
    const summary = await refreshEventViability(adminClient, event.id)
    if (summary.status === 'at_risk') {
      atRiskEvents += 1
    }
  }

  return { atRiskEvents }
}

export async function queueDueEventNotifications(adminClient: AdminClient) {
  const now = new Date()
  const { atRiskEvents } = await refreshUpcomingEventViability(adminClient)
  const { data: events, error } = await adminClient
    .from('events')
    .select(
      'capacity, duration_minutes, id, intent, minimum_viable_attendees, restaurant_cuisines, restaurant_name, restaurant_subregion, starts_at, status, title, venue_crowd, venue_energy, venue_latitude, venue_longitude, venue_music, venue_price, venue_scene, venue_setting, viability_status'
    )
    .neq('status', 'cancelled')
    .is('archived_at', null)
    .gte('starts_at', new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString())
    .lte('starts_at', new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString())
    .returns<EventScoreRow[]>()

  if (error) {
    throw new Error(error.message)
  }

  let dayConfirmations = 0
  let followUps = 0
  let reminders2h = 0
  let reminders24h = 0

  for (const event of events ?? []) {
    const eventStart = new Date(event.starts_at)
    const hoursUntilStart = getHoursUntilEvent(event.starts_at, now)
    const eventEnd = new Date(
      eventStart.getTime() + event.duration_minutes * 60 * 1000
    )

    const activeRows = await getSignupRows(adminClient, event.id)

    const confirmedUserIds = activeRows
      .filter((signup) => signup.status === 'going')
      .map((signup) => signup.user_id)
    const followUpUserIds = activeRows
      .filter((signup) => ['going', 'attended', 'no_show'].includes(signup.status))
      .map((signup) => signup.user_id)
    const dayConfirmationPendingUserIds = activeRows
      .filter(
        (signup) =>
          signup.status === 'going' && signup.day_of_confirmation_status !== 'confirmed'
      )
      .map((signup) => signup.user_id)

    if (confirmedUserIds.length > 0 && hoursUntilStart <= 24 && hoursUntilStart > 2) {
      await queueNotifications(
        confirmedUserIds.map((userId) => ({
          body: `${event.title} at ${event.restaurant_name} is coming up in about 24 hours.`,
          duplicateBehavior: 'skip',
          eventId: event.id,
          title: 'Event reminder: 24 hours to go',
          type: 'event_reminder_24h',
          userId,
        }))
      )
      reminders24h += confirmedUserIds.length
    }

    if (confirmedUserIds.length > 0 && hoursUntilStart <= 2 && hoursUntilStart > 0) {
      await queueNotifications(
        confirmedUserIds.map((userId) => ({
          body: `${event.title} at ${event.restaurant_name} starts in about 2 hours. Time to head out soon.`,
          duplicateBehavior: 'skip',
          eventId: event.id,
          title: 'Event reminder: 2 hours to go',
          type: 'event_reminder_2h',
          userId,
        }))
      )
      reminders2h += confirmedUserIds.length
    }

    if (
      dayConfirmationPendingUserIds.length > 0 &&
      isSameEventDayInNewYork(event.starts_at, now) &&
      hoursUntilStart > 0
    ) {
      await queueNotifications(
        dayConfirmationPendingUserIds.map((userId) => ({
          body: `${event.title} at ${event.restaurant_name} is today. Confirm on your dashboard if you are still going.`,
          duplicateBehavior: 'skip',
          eventId: event.id,
          title: 'Confirm you are still going today',
          type: 'event_day_confirmation',
          userId,
        }))
      )
      dayConfirmations += dayConfirmationPendingUserIds.length
    }

    if (followUpUserIds.length > 0 && eventEnd.getTime() <= now.getTime()) {
      await queueNotifications(
        followUpUserIds.map((userId) => ({
          body: `How was ${event.title} at ${event.restaurant_name}? Leave feedback on your dashboard so the next events improve.`,
          duplicateBehavior: 'skip',
          eventId: event.id,
          title: 'How did the event go?',
          type: 'event_follow_up',
          userId,
        }))
      )
      followUps += followUpUserIds.length
    }
  }

  return {
    atRiskEvents,
    dayConfirmations,
    followUps,
    reminders24h,
    reminders2h,
  }
}
