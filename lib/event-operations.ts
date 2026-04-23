import 'server-only'

import {
  calculateRestaurantMatchScore,
  type EventForScoring,
  type EventIntent,
  type ProfileForScoring,
} from '@/lib/events'
import {
  getHoursUntilEvent,
  hasEventStarted,
  isPastWaitlistPromotionCutoff,
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
  viability_status: EventViabilityStatus
}

type SignupScoreRow = {
  created_at: string
  day_of_confirmation_status: 'pending' | 'confirmed' | 'declined'
  status: 'going' | 'waitlisted' | 'cancelled' | 'removed' | 'no_show' | 'attended'
  user_id: string
}

type ProfileRow = {
  bio: string | null
  cuisine_preferences: string[] | null
  id: string
  intent: EventIntent | null
  max_travel_minutes: number | null
  subregion: string | null
}

function toScoringProfile(profile: ProfileRow | undefined, userId: string): ProfileForScoring {
  return {
    bio: profile?.bio ?? null,
    cuisine_preferences: profile?.cuisine_preferences ?? [],
    id: userId,
    intent: profile?.intent ?? null,
    max_travel_minutes: profile?.max_travel_minutes ?? null,
    subregion: profile?.subregion ?? null,
  }
}

async function getEventForScoring(adminClient: AdminClient, eventId: number) {
  const { data: event, error } = await adminClient
    .from('events')
    .select(
      'capacity, duration_minutes, id, intent, minimum_viable_attendees, restaurant_cuisines, restaurant_name, restaurant_subregion, starts_at, status, title, viability_status'
    )
    .eq('id', eventId)
    .maybeSingle<EventScoreRow>()

  if (error || !event) {
    throw new Error(error?.message ?? 'Event not found.')
  }

  return event
}

async function getProfiles(adminClient: AdminClient, userIds: string[]) {
  if (userIds.length === 0) {
    return new Map<string, ProfileRow>()
  }

  const { data, error } = await adminClient
    .from('profiles')
    .select('bio, cuisine_preferences, id, intent, max_travel_minutes, subregion')
    .in('id', userIds)
    .returns<ProfileRow[]>()

  if (error) {
    throw new Error(error.message)
  }

  return new Map((data ?? []).map((profile) => [profile.id, profile]))
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
  const event = await getEventForScoring(adminClient, eventId)

  await recomputeEventSignupScores(adminClient, eventId)

  const waitlisted = (await getSignupRows(adminClient, eventId)).filter(
    (signup) => signup.status === 'waitlisted'
  )

  if (waitlisted.length === 0) {
    return
  }

  const profileById = await getProfiles(
    adminClient,
    waitlisted.map((signup) => signup.user_id)
  )
  const scoringEvent: EventForScoring = {
    intent: event.intent,
    restaurant_cuisines: event.restaurant_cuisines,
    restaurant_subregion: event.restaurant_subregion,
  }
  const nowIso = new Date().toISOString()

  const updates = waitlisted.map((signup, index) => ({
    day_of_confirmation_at: null,
    day_of_confirmation_status: 'pending',
    event_id: eventId,
    personal_match_score: 50,
    personal_match_summary: `You are currently waitlisted at position ${index + 1}. Personal fit will lock in if a seat opens.`,
    restaurant_match_score: calculateRestaurantMatchScore(
      toScoringProfile(profileById.get(signup.user_id), signup.user_id),
      scoringEvent
    ),
    status: 'waitlisted',
    updated_at: nowIso,
    user_id: signup.user_id,
  }))

  const { error: updateError } = await adminClient.from('event_signups').upsert(updates, {
    onConflict: 'event_id,user_id',
  })

  if (updateError) {
    throw new Error(updateError.message)
  }
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
      'capacity, duration_minutes, id, intent, minimum_viable_attendees, restaurant_cuisines, restaurant_name, restaurant_subregion, starts_at, status, title, viability_status'
    )
    .neq('status', 'cancelled')
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

export async function promoteWaitlistedAttendees(
  adminClient: AdminClient,
  eventId: number
) {
  const event = await getEventForScoring(adminClient, eventId)

  if (
    event.status !== 'open' ||
    hasEventStarted(event.starts_at) ||
    isPastWaitlistPromotionCutoff(event.starts_at)
  ) {
    return { promotedUserIds: [] as string[] }
  }

  const attendeeCount = (await getSignupRows(adminClient, eventId)).filter(
    (signup) => signup.status === 'going'
  ).length

  const openSpots = Math.max(0, event.capacity - attendeeCount)

  if (openSpots === 0) {
    return { promotedUserIds: [] as string[] }
  }

  const waitlisted = (await getSignupRows(adminClient, eventId))
    .filter((signup) => signup.status === 'waitlisted')
    .sort((left, right) => left.created_at.localeCompare(right.created_at))
    .slice(0, openSpots)

  const promotedUserIds = waitlisted.map((signup) => signup.user_id)

  if (promotedUserIds.length === 0) {
    return { promotedUserIds: [] as string[] }
  }

  const { error: promoteError } = await adminClient
    .from('event_signups')
    .update({
      day_of_confirmation_at: null,
      day_of_confirmation_status: 'pending',
      status: 'going',
      updated_at: new Date().toISOString(),
    })
    .eq('event_id', eventId)
    .eq('status', 'waitlisted')
    .in('user_id', promotedUserIds)

  if (promoteError) {
    throw new Error(promoteError.message)
  }

  await syncEventSignupScores(adminClient, eventId)
  await refreshEventViability(adminClient, eventId)

  await queueNotifications(
    promotedUserIds.map((userId) => ({
      body: `A spot just opened up for ${event.title} at ${event.restaurant_name}. You have been moved off the waitlist and are now confirmed.`,
      duplicateBehavior: 'skip',
      eventId: event.id,
      title: 'You are off the waitlist',
      type: 'event_promoted',
      userId,
    }))
  )

  return { promotedUserIds }
}

export async function determineActiveSignupStatus(
  adminClient: AdminClient,
  eventId: number
) {
  const event = await getEventForScoring(adminClient, eventId)

  if (event.status === 'cancelled') {
    throw new Error('You cannot reinstate attendees on a cancelled event.')
  }

  if (hasEventStarted(event.starts_at)) {
    return 'going' as const
  }

  const attendeeCount = (await getSignupRows(adminClient, eventId)).filter(
    (signup) => signup.status === 'going'
  ).length

  return attendeeCount >= event.capacity ? ('waitlisted' as const) : ('going' as const)
}

export async function queueDueEventNotifications(adminClient: AdminClient) {
  const now = new Date()
  const { atRiskEvents } = await refreshUpcomingEventViability(adminClient)
  const { data: events, error } = await adminClient
    .from('events')
    .select(
      'capacity, duration_minutes, id, intent, minimum_viable_attendees, restaurant_cuisines, restaurant_name, restaurant_subregion, starts_at, status, title, viability_status'
    )
    .neq('status', 'cancelled')
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
