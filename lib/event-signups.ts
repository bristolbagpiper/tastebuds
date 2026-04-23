import 'server-only'

import {
  buildPersonalScores,
  calculateRestaurantMatchScore,
  type EventIntent,
  type EventForScoring,
  type ProfileForScoring,
} from '@/lib/events'
import type { createServerSupabaseAdminClient } from '@/lib/supabase/server'

type AdminClient = ReturnType<typeof createServerSupabaseAdminClient>

type EventRow = {
  id: number
  intent: EventIntent
  restaurant_cuisines: string[] | null
  restaurant_subregion: string | null
}

type EventSignupRow = {
  event_id: number
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

export async function recomputeEventSignupScores(
  adminClient: AdminClient,
  eventId: number
) {
  const eventResponse = (await adminClient
    .from('events')
    .select('id, intent, restaurant_cuisines, restaurant_subregion')
    .eq('id', eventId)
    .maybeSingle()) as {
    data: EventRow | null
    error: { message: string } | null
  }

  if (eventResponse.error || !eventResponse.data) {
    throw new Error(eventResponse.error?.message ?? 'Event not found.')
  }

  const event = eventResponse.data
  const signupsResponse = (await adminClient
    .from('event_signups')
    .select('event_id, user_id')
    .eq('event_id', eventId)
    .eq('status', 'going')) as {
    data: EventSignupRow[] | null
    error: { message: string } | null
  }

  if (signupsResponse.error) {
    throw new Error(signupsResponse.error.message)
  }

  const signups = signupsResponse.data ?? []

  if (signups.length === 0) {
    return
  }

  const userIds = signups.map((signup) => signup.user_id)
  const profilesResponse = (await adminClient
    .from('profiles')
    .select(
      'bio, cuisine_preferences, id, intent, max_travel_minutes, subregion'
    )
    .in('id', userIds)) as {
    data: ProfileRow[] | null
    error: { message: string } | null
  }

  if (profilesResponse.error) {
    throw new Error(profilesResponse.error.message)
  }

  const profileById = new Map(
    (profilesResponse.data ?? []).map((profile) => [profile.id, profile])
  )

  const attendees: ProfileForScoring[] = userIds.map((userId) => {
    const profile = profileById.get(userId)

    return {
      bio: profile?.bio ?? null,
      cuisine_preferences: profile?.cuisine_preferences ?? [],
      id: userId,
      intent: profile?.intent ?? null,
      max_travel_minutes: profile?.max_travel_minutes ?? null,
      subregion: profile?.subregion ?? null,
    }
  })

  const personalScores = buildPersonalScores(attendees, event.intent)
  const eventForScoring: EventForScoring = {
    intent: event.intent,
    restaurant_cuisines: event.restaurant_cuisines,
    restaurant_subregion: event.restaurant_subregion,
  }

  const nowIso = new Date().toISOString()
  const updates = attendees.map((attendee) => {
    const personal = personalScores.get(attendee.id)

    return {
      event_id: eventId,
      personal_match_score: personal?.score ?? 50,
      personal_match_summary:
        personal?.summary ?? 'Personal score will update as attendance changes.',
      restaurant_match_score: calculateRestaurantMatchScore(
        attendee,
        eventForScoring
      ),
      status: 'going',
      updated_at: nowIso,
      user_id: attendee.id,
    }
  })

  const updateResponse = (await adminClient.from('event_signups').upsert(updates, {
    onConflict: 'event_id,user_id',
  })) as {
    error: { message: string } | null
  }

  if (updateResponse.error) {
    throw new Error(updateResponse.error.message)
  }
}
