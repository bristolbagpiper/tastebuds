'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { supabase } from '@/lib/supabase/client'

type Profile = {
  bio: string | null
  cuisine_preferences: string[] | null
  display_name: string | null
  intent: 'dating' | 'friendship' | null
  max_travel_minutes: number | null
  neighbourhood: string | null
  subregion: string | null
}

type NotificationSummary = {
  body: string
  created_at: string
  id: number
  read_at: string | null
  title: string
  type: string
}

type DashboardEvent = {
  attendeeCount: number
  capacity: number
  description: string | null
  id: number
  intent: 'dating' | 'friendship'
  isJoined: boolean
  personalMatchScore: number | null
  personalMatchSummary: string | null
  projectedRestaurantScore: number
  restaurant_cuisines: string[] | null
  restaurant_name: string
  restaurant_neighbourhood: string | null
  restaurant_subregion: string
  spotsLeft: number
  starts_at: string
  title: string
}

function formatEventDate(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'America/New_York',
  }).format(new Date(value))
}

function formatIntent(intent: 'dating' | 'friendship') {
  return intent === 'dating' ? 'Dating' : 'Friendship'
}

function formatNotificationDate(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/New_York',
  }).format(new Date(value))
}

function formatNotificationType(type: string) {
  switch (type) {
    case 'event_signup':
      return 'Signup'
    case 'event_update':
      return 'Update'
    case 'event_reminder':
      return 'Reminder'
    default:
      return 'Notice'
  }
}

export default function DashboardPage() {
  const router = useRouter()
  const [email, setEmail] = useState<string | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [events, setEvents] = useState<DashboardEvent[]>([])
  const [notifications, setNotifications] = useState<NotificationSummary[]>([])
  const [showUnreadOnly, setShowUnreadOnly] = useState(true)
  const [loading, setLoading] = useState(true)
  const [setupError, setSetupError] = useState('')
  const [eventActionError, setEventActionError] = useState('')
  const [eventActionLoadingId, setEventActionLoadingId] = useState<number | null>(
    null
  )
  const [notificationActionLoading, setNotificationActionLoading] =
    useState(false)
  const [clearReadLoading, setClearReadLoading] = useState(false)
  const [notificationDeletingId, setNotificationDeletingId] = useState<
    number | null
  >(null)
  const [notificationError, setNotificationError] = useState('')

  useEffect(() => {
    let active = true

    async function loadDashboard() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!active) {
        return
      }

      if (!user) {
        router.replace('/login')
        return
      }

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select(
          'bio, cuisine_preferences, display_name, intent, max_travel_minutes, neighbourhood, subregion'
        )
        .eq('id', user.id)
        .maybeSingle<Profile>()

      if (!active) {
        return
      }

      if (profileError) {
        setSetupError(
          'The profiles table is not ready yet. Run the latest SQL migration in Supabase before using the dashboard.'
        )
        setLoading(false)
        return
      }

      if (!profileData?.display_name || !profileData.subregion) {
        router.replace('/onboarding')
        return
      }

      const { data: notificationData, error: notificationError } = await supabase
        .from('notifications')
        .select('body, created_at, id, read_at, title, type')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(40)
        .returns<NotificationSummary[]>()

      if (!active) {
        return
      }

      if (notificationError) {
        setSetupError(notificationError.message)
        setLoading(false)
        return
      }

      const {
        data: { session },
      } = await supabase.auth.getSession()

      const accessToken = session?.access_token

      if (!accessToken) {
        setSetupError('Missing active session. Log in again.')
        setLoading(false)
        return
      }

      const eventsResponse = await fetch('/api/events', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      const eventsPayload = (await eventsResponse.json()) as {
        error?: string
        events?: DashboardEvent[]
        onboardingRequired?: boolean
      }

      if (!active) {
        return
      }

      if (!eventsResponse.ok || eventsPayload.error) {
        setSetupError(eventsPayload.error ?? 'Could not load events.')
        setLoading(false)
        return
      }

      if (eventsPayload.onboardingRequired) {
        router.replace('/onboarding')
        return
      }

      setEmail(user.email ?? null)
      setProfile(profileData)
      setNotifications(notificationData ?? [])
      setEvents(eventsPayload.events ?? [])
      setLoading(false)
    }

    void loadDashboard()

    return () => {
      active = false
    }
  }, [router])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  async function markNotificationsRead() {
    setNotificationError('')

    const unreadIds = notifications
      .filter((notification) => !notification.read_at)
      .map((notification) => notification.id)

    if (unreadIds.length === 0) {
      return
    }

    setNotificationActionLoading(true)

    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .in('id', unreadIds)

    if (error) {
      setNotificationError(error.message)
      setNotificationActionLoading(false)
      return
    }

    const readAt = new Date().toISOString()
    setNotifications((current) =>
      current.map((notification) =>
        unreadIds.includes(notification.id)
          ? { ...notification, read_at: readAt }
          : notification
      )
    )
    setNotificationActionLoading(false)
  }

  async function dismissNotification(notificationId: number) {
    setNotificationError('')
    setNotificationDeletingId(notificationId)

    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId)

    if (error) {
      setNotificationError(error.message)
      setNotificationDeletingId(null)
      return
    }

    setNotifications((current) =>
      current.filter((notification) => notification.id !== notificationId)
    )
    setNotificationDeletingId(null)
  }

  async function clearReadNotifications() {
    setNotificationError('')

    const readIds = notifications
      .filter((notification) => Boolean(notification.read_at))
      .map((notification) => notification.id)

    if (readIds.length === 0) {
      return
    }

    setClearReadLoading(true)

    const { error } = await supabase
      .from('notifications')
      .delete()
      .in('id', readIds)

    if (error) {
      setNotificationError(error.message)
      setClearReadLoading(false)
      return
    }

    setNotifications((current) =>
      current.filter((notification) => !readIds.includes(notification.id))
    )
    setClearReadLoading(false)
  }

  async function refreshEvents() {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    const accessToken = session?.access_token

    if (!accessToken) {
      setSetupError('Missing active session. Log in again.')
      return
    }

    const response = await fetch('/api/events', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    const payload = (await response.json()) as {
      error?: string
      events?: DashboardEvent[]
    }

    if (!response.ok || payload.error) {
      setEventActionError(payload.error ?? 'Could not refresh events.')
      return
    }

    setEvents(payload.events ?? [])
  }

  async function setEventSignup(eventId: number, action: 'join' | 'leave') {
    setEventActionLoadingId(eventId)
    setEventActionError('')

    const {
      data: { session },
    } = await supabase.auth.getSession()
    const accessToken = session?.access_token

    if (!accessToken) {
      setEventActionError('Missing active session. Log in again.')
      setEventActionLoadingId(null)
      return
    }

    const response = await fetch('/api/events/signup', {
      body: JSON.stringify({
        action,
        eventId,
      }),
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      method: 'POST',
    })

    const payload = (await response.json()) as { error?: string }

    if (!response.ok || payload.error) {
      setEventActionError(payload.error ?? 'Could not update your event signup.')
      setEventActionLoadingId(null)
      return
    }

    await refreshEvents()
    setEventActionLoadingId(null)
  }

  if (loading) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-6xl items-center px-8">
        <p className="text-sm text-zinc-600">Loading dashboard...</p>
      </main>
    )
  }

  if (setupError) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center px-8 py-16">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-zinc-500">
          Dashboard
        </p>
        <h1 className="mt-3 text-4xl font-semibold text-zinc-950">
          Data setup still has gaps
        </h1>
        <p className="mt-4 max-w-2xl text-base text-zinc-600">{setupError}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            className="rounded-xl border border-zinc-950 px-4 py-3 font-medium text-zinc-950 transition hover:bg-zinc-950 hover:text-white"
            href="/"
          >
            Back to home
          </Link>
          <button
            className="rounded-xl bg-zinc-950 px-4 py-3 font-medium text-white transition hover:bg-zinc-800"
            onClick={handleLogout}
            type="button"
          >
            Log out
          </button>
        </div>
      </main>
    )
  }

  const unreadNotificationCount = notifications.filter(
    (notification) => !notification.read_at
  ).length
  const readNotificationCount = notifications.length - unreadNotificationCount
  const visibleNotifications = showUnreadOnly
    ? notifications.filter((notification) => !notification.read_at)
    : notifications

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-8 py-14">
      <p className="text-sm font-medium uppercase tracking-[0.2em] text-zinc-500">
        Dashboard
      </p>
      <h1 className="mt-3 text-4xl font-semibold text-zinc-950">
        Restaurant events, not blind matching
      </h1>
      <p className="mt-4 max-w-3xl text-base text-zinc-600">
        Logged in as <span className="font-medium text-zinc-950">{email}</span>.
        You now join specific events directly. Scores are computed from your
        profile and who else is attending.
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
        <section className="rounded-[1.75rem] border border-zinc-200 bg-zinc-50 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-zinc-500">
                Profile
              </p>
              <p className="mt-3 text-2xl font-semibold text-zinc-950">
                {profile?.display_name}
              </p>
              <p className="mt-2 text-sm text-zinc-600">
                {profile?.subregion}
                {profile?.neighbourhood ? `, ${profile.neighbourhood}` : ''}
              </p>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700">
              <p>
                Preference:{' '}
                <span className="font-medium text-zinc-950">
                  {profile?.intent ? formatIntent(profile.intent) : 'Not set'}
                </span>
              </p>
              <p className="mt-1">
                Max travel:{' '}
                <span className="font-medium text-zinc-950">
                  {profile?.max_travel_minutes ?? 30} minutes
                </span>
              </p>
            </div>
          </div>
          <p className="mt-4 text-sm text-zinc-600">
            Cuisine preferences:{' '}
            <span className="font-medium text-zinc-950">
              {profile?.cuisine_preferences?.length
                ? profile.cuisine_preferences.join(', ')
                : 'Not set yet'}
            </span>
          </p>
          {profile?.bio ? (
            <p className="mt-4 text-sm leading-7 text-zinc-600">{profile.bio}</p>
          ) : null}
        </section>

        <section className="rounded-[1.75rem] border border-zinc-200 bg-zinc-50 p-6">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm uppercase tracking-[0.2em] text-zinc-500">
              Notifications
            </p>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              className={`rounded-xl px-3 py-2 text-xs font-medium transition ${
                showUnreadOnly
                  ? 'bg-zinc-950 text-white'
                  : 'border border-zinc-950 text-zinc-950 hover:bg-zinc-950 hover:text-white'
              }`}
              onClick={() => setShowUnreadOnly(true)}
              type="button"
            >
              Unread ({unreadNotificationCount})
            </button>
            <button
              className={`rounded-xl px-3 py-2 text-xs font-medium transition ${
                !showUnreadOnly
                  ? 'bg-zinc-950 text-white'
                  : 'border border-zinc-950 text-zinc-950 hover:bg-zinc-950 hover:text-white'
              }`}
              onClick={() => setShowUnreadOnly(false)}
              type="button"
            >
              All ({notifications.length})
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              className="rounded-xl border border-zinc-950 px-3 py-2 text-xs font-medium text-zinc-950 transition hover:bg-zinc-950 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-300 disabled:text-zinc-400"
              disabled={notificationActionLoading || unreadNotificationCount === 0}
              onClick={() => void markNotificationsRead()}
              type="button"
            >
              {notificationActionLoading ? 'Marking...' : 'Mark all read'}
            </button>
            <button
              className="rounded-xl border border-zinc-950 px-3 py-2 text-xs font-medium text-zinc-950 transition hover:bg-zinc-950 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-300 disabled:text-zinc-400"
              disabled={clearReadLoading || readNotificationCount === 0}
              onClick={() => void clearReadNotifications()}
              type="button"
            >
              {clearReadLoading ? 'Clearing...' : 'Clear read'}
            </button>
          </div>
          {notificationError ? (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              {notificationError}
            </div>
          ) : null}
          <div className="mt-4 max-h-72 space-y-3 overflow-y-auto pr-1">
            {visibleNotifications.length > 0 ? (
              visibleNotifications.map((notification) => (
                <article
                  className="rounded-2xl border border-zinc-200 bg-white p-4"
                  key={notification.id}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {!notification.read_at ? (
                        <span className="rounded-full bg-zinc-950 px-2 py-0.5 text-xs font-medium uppercase tracking-[0.12em] text-white">
                          New
                        </span>
                      ) : null}
                      <p className="text-sm font-semibold text-zinc-950">
                        {notification.title}
                      </p>
                    </div>
                    <button
                      className="text-xs font-medium text-zinc-500 transition hover:text-zinc-950 disabled:cursor-not-allowed disabled:text-zinc-300"
                      disabled={notificationDeletingId === notification.id}
                      onClick={() => void dismissNotification(notification.id)}
                      type="button"
                    >
                      {notificationDeletingId === notification.id
                        ? 'Deleting...'
                        : 'Dismiss'}
                    </button>
                  </div>
                  <p className="mt-1 text-xs uppercase tracking-[0.12em] text-zinc-500">
                    {formatNotificationType(notification.type)} -{' '}
                    {formatNotificationDate(notification.created_at)}
                  </p>
                  <p className="mt-2 text-sm text-zinc-600">{notification.body}</p>
                </article>
              ))
            ) : notifications.length > 0 && showUnreadOnly ? (
              <p className="text-sm text-zinc-600">
                No unread notifications. Switch to <span className="font-medium">All</span>{' '}
                to review history.
              </p>
            ) : (
              <p className="text-sm text-zinc-600">No notifications yet.</p>
            )}
          </div>
        </section>
      </div>

      {eventActionError ? (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {eventActionError}
        </div>
      ) : null}

      <section className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-zinc-500">
            Upcoming events
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              className="rounded-xl border border-zinc-950 px-4 py-2.5 text-sm font-medium text-zinc-950 transition hover:bg-zinc-950 hover:text-white"
              href="/onboarding"
            >
              Edit profile
            </Link>
            <Link
              className="rounded-xl border border-zinc-950 px-4 py-2.5 text-sm font-medium text-zinc-950 transition hover:bg-zinc-950 hover:text-white"
              href="/admin"
            >
              Open admin
            </Link>
            <button
              className="rounded-xl bg-zinc-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800"
              onClick={handleLogout}
              type="button"
            >
              Log out
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-4">
          {events.length > 0 ? (
            events.map((event) => (
              <article
                className="rounded-[1.5rem] border border-zinc-200 bg-zinc-50 p-6"
                key={event.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-sm uppercase tracking-[0.2em] text-zinc-500">
                      {formatIntent(event.intent)} event
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold text-zinc-950">
                      {event.title}
                    </h2>
                    <p className="mt-2 text-sm text-zinc-700">
                      {event.restaurant_name} - {event.restaurant_subregion}
                      {event.restaurant_neighbourhood
                        ? `, ${event.restaurant_neighbourhood}`
                        : ''}
                    </p>
                    <p className="mt-1 text-sm text-zinc-700">
                      {formatEventDate(event.starts_at)}
                    </p>
                    {event.restaurant_cuisines?.length ? (
                      <p className="mt-1 text-sm text-zinc-600">
                        Cuisine: {event.restaurant_cuisines.join(', ')}
                      </p>
                    ) : null}
                  </div>
                  <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700">
                    <p>
                      Attending:{' '}
                      <span className="font-medium text-zinc-950">
                        {event.attendeeCount}/{event.capacity}
                      </span>
                    </p>
                    <p className="mt-1">
                      Spots left:{' '}
                      <span className="font-medium text-zinc-950">
                        {event.spotsLeft}
                      </span>
                    </p>
                  </div>
                </div>

                {event.description ? (
                  <p className="mt-4 text-sm leading-7 text-zinc-600">
                    {event.description}
                  </p>
                ) : null}

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                      Restaurant fit
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-zinc-950">
                      {event.projectedRestaurantScore}
                    </p>
                    <p className="mt-1 text-sm text-zinc-600">
                      Based on cuisine preferences, travel tolerance, and event
                      location.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                      Personal fit
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-zinc-950">
                      {event.personalMatchScore ?? '--'}
                    </p>
                    <p className="mt-1 text-sm text-zinc-600">
                      {event.personalMatchSummary ??
                        'Join the event to compute your attendee fit score.'}
                    </p>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                  {event.isJoined ? (
                    <button
                      className="rounded-xl border border-zinc-950 px-4 py-2.5 text-sm font-medium text-zinc-950 transition hover:bg-zinc-950 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-300 disabled:text-zinc-400"
                      disabled={eventActionLoadingId === event.id}
                      onClick={() => void setEventSignup(event.id, 'leave')}
                      type="button"
                    >
                      {eventActionLoadingId === event.id
                        ? 'Updating...'
                        : 'Leave event'}
                    </button>
                  ) : (
                    <button
                      className="rounded-xl bg-zinc-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
                      disabled={eventActionLoadingId === event.id || event.spotsLeft === 0}
                      onClick={() => void setEventSignup(event.id, 'join')}
                      type="button"
                    >
                      {eventActionLoadingId === event.id
                        ? 'Joining...'
                        : event.spotsLeft === 0
                          ? 'Event full'
                          : 'Join event'}
                    </button>
                  )}
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-[1.5rem] border border-zinc-200 bg-zinc-50 p-6 text-sm text-zinc-600">
              No upcoming events yet. Admins need to create restaurant events
              before anyone can sign up.
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
