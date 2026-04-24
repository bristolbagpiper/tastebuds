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
  venue_crowd: string[] | null
  venue_energy: string | null
  venue_latitude: number | null
  venue_longitude: number | null
  venue_music: string[] | null
  venue_price: string | null
  venue_scene: string[] | null
  venue_setting: string[] | null
}

type EventSignupRow = {
  event_id: number
  user_id: string
}

type ProfileRow = {
  bio: string | null
  cuisine_preferences: string[] | null
  home_latitude: number | null
  home_longitude: number | null
  id: string
  intent: EventIntent | null
  max_travel_minutes: number | null
  preferred_crowd: string[] | null
  preferred_energy: string[] | null
  preferred_music: string[] | null
  preferred_price: string[] | null
  preferred_scene: string[] | null
  preferred_setting: string[] | null
  subregion: string | null
}

export async function recomputeEventSignupScores(
  adminClient: AdminClient,
  eventId: number
) {
  const eventResponse = (await adminClient
    .from('events')
    .select(
      'id, intent, restaurant_cuisines, restaurant_subregion, venue_crowd, venue_energy, venue_latitude, venue_longitude, venue_music, venue_price, venue_scene, venue_setting'
    )
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
      'bio, cuisine_preferences, home_latitude, home_longitude, id, intent, max_travel_minutes, preferred_crowd, preferred_energy, preferred_music, preferred_price, preferred_scene, preferred_setting, subregion'
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
      home_latitude: profile?.home_latitude ?? null,
      home_longitude: profile?.home_longitude ?? null,
      id: userId,
      intent: profile?.intent ?? null,
      max_travel_minutes: profile?.max_travel_minutes ?? null,
      preferred_crowd: profile?.preferred_crowd ?? [],
      preferred_energy: profile?.preferred_energy ?? [],
      preferred_music: profile?.preferred_music ?? [],
      preferred_price: profile?.preferred_price ?? [],
      preferred_scene: profile?.preferred_scene ?? [],
      preferred_setting: profile?.preferred_setting ?? [],
      subregion: profile?.subregion ?? null,
    }
  })

  const personalScores = buildPersonalScores(attendees, event.intent)
  const eventForScoring: EventForScoring = {
    intent: event.intent,
    restaurant_cuisines: event.restaurant_cuisines,
    restaurant_subregion: event.restaurant_subregion,
    venue_crowd: event.venue_crowd,
    venue_energy: event.venue_energy,
    venue_latitude: event.venue_latitude,
    venue_longitude: event.venue_longitude,
    venue_music: event.venue_music,
    venue_price: event.venue_price,
    venue_scene: event.venue_scene,
    venue_setting: event.venue_setting,
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
