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
  capacity: number
  google_good_for_groups: boolean | null
  google_good_for_watching_sports: boolean | null
  google_live_music: boolean | null
  google_open_now: boolean | null
  google_opening_hours: string[] | null
  google_outdoor_seating: boolean | null
  google_reservable: boolean | null
  google_serves_beer: boolean | null
  google_serves_brunch: boolean | null
  google_serves_cocktails: boolean | null
  google_serves_dessert: boolean | null
  google_serves_dinner: boolean | null
  google_serves_vegetarian_food: boolean | null
  google_serves_wine: boolean | null
  id: number
  intent: EventIntent
  menu_experience_tags: string[] | null
  restaurant_cuisines: string[] | null
  restaurant_subregion: string | null
  venue_crowd: string[] | null
  venue_energy: string | null
  venue_formats: string[] | null
  venue_good_for_casual_meetups: boolean | null
  venue_good_for_cocktails: boolean | null
  venue_good_for_conversation: boolean | null
  venue_good_for_dinner: boolean | null
  venue_group_friendly: boolean | null
  venue_indoor_outdoor: string[] | null
  venue_latitude: number | null
  venue_longitude: number | null
  venue_music: string[] | null
  venue_noise_level: string | null
  venue_price: string | null
  venue_reservation_friendly: boolean | null
  venue_scene: string[] | null
  venue_seating_types: string[] | null
  venue_setting: string[] | null
  venue_vibes: string[] | null
}

type EventSignupRow = {
  event_id: number
  user_id: string
}

type ProfileRow = {
  age_range_comfort: string[] | null
  bio: string | null
  cuisine_preferences: string[] | null
  conversation_preference: string[] | null
  dietary_restrictions: string[] | null
  drinking_preferences: string[] | null
  group_size_comfort: string[] | null
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
  preferred_vibes: string[] | null
  subregion: string | null
}

export async function recomputeEventSignupScores(
  adminClient: AdminClient,
  eventId: number
) {
  const eventResponse = (await adminClient
    .from('events')
    .select(
      'capacity, google_good_for_groups, google_good_for_watching_sports, google_live_music, google_open_now, google_opening_hours, google_outdoor_seating, google_reservable, google_serves_beer, google_serves_brunch, google_serves_cocktails, google_serves_dessert, google_serves_dinner, google_serves_vegetarian_food, google_serves_wine, id, intent, menu_experience_tags, restaurant_cuisines, restaurant_subregion, venue_crowd, venue_energy, venue_formats, venue_good_for_casual_meetups, venue_good_for_cocktails, venue_good_for_conversation, venue_good_for_dinner, venue_group_friendly, venue_indoor_outdoor, venue_latitude, venue_longitude, venue_music, venue_noise_level, venue_price, venue_reservation_friendly, venue_scene, venue_seating_types, venue_setting, venue_vibes'
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
      'age_range_comfort, bio, conversation_preference, cuisine_preferences, dietary_restrictions, drinking_preferences, group_size_comfort, home_latitude, home_longitude, id, intent, max_travel_minutes, preferred_crowd, preferred_energy, preferred_music, preferred_price, preferred_scene, preferred_setting, preferred_vibes, subregion'
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
      age_range_comfort: profile?.age_range_comfort ?? [],
      bio: profile?.bio ?? null,
      cuisine_preferences: profile?.cuisine_preferences ?? [],
      conversation_preference: profile?.conversation_preference ?? [],
      dietary_restrictions: profile?.dietary_restrictions ?? [],
      drinking_preferences: profile?.drinking_preferences ?? [],
      group_size_comfort: profile?.group_size_comfort ?? [],
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
      preferred_vibes: profile?.preferred_vibes ?? [],
      subregion: profile?.subregion ?? null,
    }
  })

  const personalScores = buildPersonalScores(attendees, event.intent)
  const eventForScoring: EventForScoring = {
    capacity: event.capacity,
    google_good_for_groups: event.google_good_for_groups,
    google_good_for_watching_sports: event.google_good_for_watching_sports,
    google_live_music: event.google_live_music,
    google_open_now: event.google_open_now,
    google_opening_hours: event.google_opening_hours,
    google_outdoor_seating: event.google_outdoor_seating,
    google_reservable: event.google_reservable,
    google_serves_beer: event.google_serves_beer,
    google_serves_brunch: event.google_serves_brunch,
    google_serves_cocktails: event.google_serves_cocktails,
    google_serves_dessert: event.google_serves_dessert,
    google_serves_dinner: event.google_serves_dinner,
    google_serves_vegetarian_food: event.google_serves_vegetarian_food,
    google_serves_wine: event.google_serves_wine,
    intent: event.intent,
    menu_experience_tags: event.menu_experience_tags,
    restaurant_cuisines: event.restaurant_cuisines,
    restaurant_subregion: event.restaurant_subregion,
    venue_crowd: event.venue_crowd,
    venue_energy: event.venue_energy,
    venue_formats: event.venue_formats,
    venue_good_for_casual_meetups: event.venue_good_for_casual_meetups,
    venue_good_for_cocktails: event.venue_good_for_cocktails,
    venue_good_for_conversation: event.venue_good_for_conversation,
    venue_good_for_dinner: event.venue_good_for_dinner,
    venue_group_friendly: event.venue_group_friendly,
    venue_indoor_outdoor: event.venue_indoor_outdoor,
    venue_latitude: event.venue_latitude,
    venue_longitude: event.venue_longitude,
    venue_music: event.venue_music,
    venue_noise_level: event.venue_noise_level,
    venue_price: event.venue_price,
    venue_reservation_friendly: event.venue_reservation_friendly,
    venue_scene: event.venue_scene,
    venue_seating_types: event.venue_seating_types,
    venue_setting: event.venue_setting,
    venue_vibes: event.venue_vibes,
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
