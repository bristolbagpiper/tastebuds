'use client'

import type { DashboardEvent, DashboardRestaurant, NotificationSummary, Profile } from '@/lib/app/types'
import { supabase } from '@/lib/supabase/client'

type EventsPayload = {
  error?: string
  events?: DashboardEvent[]
  onboardingRequired?: boolean
}

type RestaurantsPayload = {
  error?: string
  onboardingRequired?: boolean
  restaurants?: DashboardRestaurant[]
}

type AppBootstrap = {
  accessToken: string
  email: string | null
  profile: Profile | null
  userId: string
}

let appBootstrapCache: AppBootstrap | null = null
let appBootstrapPromise: Promise<AppBootstrap> | null = null

function parseJson<T>(value: unknown) {
  return value as T
}

export async function getCurrentUser() {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return user
}

export async function logout() {
  clearAppBootstrapCache()
  await supabase.auth.signOut()
}

export function clearAppBootstrapCache() {
  appBootstrapCache = null
  appBootstrapPromise = null
}

export async function getAccessToken() {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  return session?.access_token ?? null
}

export async function getAppBootstrap() {
  if (appBootstrapCache) {
    return appBootstrapCache
  }

  if (appBootstrapPromise) {
    return appBootstrapPromise
  }

  appBootstrapPromise = (async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    const user = session?.user
    const accessToken = session?.access_token

    if (!user || !accessToken) {
      clearAppBootstrapCache()
      throw new Error('Missing active session. Log in again.')
    }

    const profileResponse = await fetchProfile(user.id)

    if (profileResponse.error) {
      clearAppBootstrapCache()
      throw new Error(profileResponse.error.message)
    }

    const bootstrap = {
      accessToken,
      email: user.email ?? null,
      profile: profileResponse.data ?? null,
      userId: user.id,
    } satisfies AppBootstrap

    appBootstrapCache = bootstrap
    appBootstrapPromise = null

    return bootstrap
  })()

  try {
    return await appBootstrapPromise
  } catch (error) {
    clearAppBootstrapCache()
    throw error
  }
}

async function fetchWithAccessToken<T>(
  input: string,
  accessToken: string,
  init?: RequestInit
) {
  const response = await fetch(input, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.method || init?.body
        ? { 'Content-Type': 'application/json' }
        : {}),
      ...(init?.headers ?? {}),
    },
  })

  return {
    payload: parseJson<T>(await response.json()),
    response,
  }
}

export async function fetchProfile(userId: string) {
  return supabase
    .from('profiles')
    .select(
      'age_range_comfort, bio, conversation_preference, cuisine_preferences, dietary_restrictions, display_name, drinking_preferences, group_size_comfort, home_latitude, home_longitude, intent, max_travel_minutes, neighbourhood, preferred_crowd, preferred_energy, preferred_music, preferred_price, preferred_scene, preferred_setting, preferred_vibes, subregion'
    )
    .eq('id', userId)
    .maybeSingle<Profile>()
}

export async function fetchNotifications(userId: string) {
  return supabase
    .from('notifications')
    .select('body, created_at, id, read_at, title, type')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(40)
    .returns<NotificationSummary[]>()
}

export async function fetchEvents(accessToken?: string) {
  const token = accessToken ?? (await getAccessToken())

  if (!token) {
    throw new Error('Missing active session. Log in again.')
  }

  const { payload, response } = await fetchWithAccessToken<EventsPayload>('/api/events', token)

  if (!response.ok || payload.error) {
    throw new Error(payload.error ?? 'Could not load events.')
  }

  return payload
}

export async function fetchRestaurants(accessToken?: string) {
  const token = accessToken ?? (await getAccessToken())

  if (!token) {
    throw new Error('Missing active session. Log in again.')
  }

  const { payload, response } = await fetchWithAccessToken<RestaurantsPayload>(
    '/api/restaurants',
    token
  )

  if (!response.ok || payload.error) {
    throw new Error(payload.error ?? 'Could not load restaurants.')
  }

  return payload
}

export async function setEventSignup(eventId: number, action: 'join' | 'leave') {
  const accessToken = await getAccessToken()

  if (!accessToken) {
    throw new Error('Missing active session. Log in again.')
  }

  const { payload, response } = await fetchWithAccessToken<{ error?: string }>(
    '/api/events/signup',
    accessToken,
    {
      body: JSON.stringify({ action, eventId }),
      method: 'POST',
    }
  )

  if (!response.ok || payload.error) {
    throw new Error(payload.error ?? 'Could not update your event signup.')
  }
}

export async function setDayOfConfirmation(
  eventId: number,
  action: 'confirm' | 'decline'
) {
  const accessToken = await getAccessToken()

  if (!accessToken) {
    throw new Error('Missing active session. Log in again.')
  }

  const { payload, response } = await fetchWithAccessToken<{ error?: string }>(
    '/api/events/day-confirmation',
    accessToken,
    {
      body: JSON.stringify({ action, eventId }),
      method: 'POST',
    }
  )

  if (!response.ok || payload.error) {
    throw new Error(payload.error ?? 'Could not update your same-day confirmation.')
  }
}

export async function setSavedRestaurant(
  restaurantId: number,
  action: 'save' | 'unsave'
) {
  const accessToken = await getAccessToken()

  if (!accessToken) {
    throw new Error('Missing active session. Log in again.')
  }

  const { payload, response } = await fetchWithAccessToken<{ error?: string }>(
    '/api/restaurants',
    accessToken,
    {
      body: JSON.stringify({ action, restaurantId }),
      method: 'POST',
    }
  )

  if (!response.ok || payload.error) {
    throw new Error(payload.error ?? 'Could not update saved restaurants.')
  }
}

export async function submitFeedback(payload: {
  eventId: number
  groupRating: number
  notes: string
  venueRating: number
  wouldJoinAgain: boolean
}) {
  const accessToken = await getAccessToken()

  if (!accessToken) {
    throw new Error('Missing active session. Log in again.')
  }

  const { payload: result, response } = await fetchWithAccessToken<{ error?: string }>(
    '/api/events/feedback',
    accessToken,
    {
      body: JSON.stringify(payload),
      method: 'POST',
    }
  )

  if (!response.ok || result.error) {
    throw new Error(result.error ?? 'Could not save your feedback.')
  }
}

export async function markNotificationsRead(notificationIds: number[]) {
  if (notificationIds.length === 0) {
    return
  }

  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .in('id', notificationIds)

  if (error) {
    throw new Error(error.message)
  }
}

export async function dismissNotification(notificationId: number) {
  const { error } = await supabase.from('notifications').delete().eq('id', notificationId)

  if (error) {
    throw new Error(error.message)
  }
}

export async function clearReadNotifications(notificationIds: number[]) {
  if (notificationIds.length === 0) {
    return
  }

  const { error } = await supabase.from('notifications').delete().in('id', notificationIds)

  if (error) {
    throw new Error(error.message)
  }
}
