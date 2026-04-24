'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { supabase } from '@/lib/supabase/client'

type Profile = {
  bio: string | null
  cuisine_preferences: string[] | null
  display_name: string | null
  home_latitude: number | null
  home_longitude: number | null
  intent: 'dating' | 'friendship' | null
  max_travel_minutes: number | null
  neighbourhood: string | null
  preferred_crowd: string[] | null
  preferred_energy: string[] | null
  preferred_music: string[] | null
  preferred_price: string[] | null
  preferred_scene: string[] | null
  preferred_setting: string[] | null
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
  attendeePreview: {
    dayOfConfirmationStatus: 'pending' | 'confirmed' | 'declined'
    displayName: string
  }[]
  canSubmitFeedback: boolean
  canViewAttendees: boolean
  capacity: number
  confirmedTodayCount: number
  dayOfConfirmationStatus: 'pending' | 'confirmed' | 'declined' | null
  description: string | null
  duration_minutes: number
  feedback: {
    groupRating: number | null
    notes: string
    submitted: boolean
    venueRating: number | null
    wouldJoinAgain: boolean | null
  }
  hasEnded: boolean
  id: number
  intent: 'dating' | 'friendship'
  isJoined: boolean
  minimumViableAttendees: number
  needsDayOfConfirmation: boolean
  personalMatchScore: number | null
  personalMatchSummary: string | null
  projectedRestaurantScore: number
  restaurant_cuisines: string[] | null
  restaurant_name: string
  restaurant_neighbourhood: string | null
  restaurant_subregion: string
  venue_crowd: string[] | null
  venueDistanceKm: number | null
  venue_energy: string | null
  venueMatchSummary: string
  venue_music: string[] | null
  venue_price: string | null
  venue_scene: string[] | null
  venue_setting: string[] | null
  shouldReconsiderGoing: boolean
  signupStatus: 'going' | 'waitlisted' | 'cancelled' | 'removed' | 'no_show' | 'attended' | null
  spotsLeft: number
  starts_at: string
  status: 'open' | 'closed' | 'cancelled'
  title: string
  viabilityStatus: 'healthy' | 'at_risk' | 'forced_go' | 'cancelled_low_confirmations'
  waitlistCount: number
  waitlistPosition: number | null
}

type FeedbackDraft = {
  groupRating: string
  notes: string
  venueRating: string
  wouldJoinAgain: '' | 'no' | 'yes'
}

type DashboardRestaurant = {
  availableEventCount: number
  availableEvents: {
    id: number
    signupStatus: 'going' | 'waitlisted' | null
    startsAt: string
    title: string
    viabilityStatus: 'healthy' | 'at_risk' | 'forced_go' | 'cancelled_low_confirmations'
  }[]
  formattedAddress: string | null
  googleEditorialSummary: string | null
  googleMapsUri: string | null
  googlePriceLevel: string | null
  googleRating: number | null
  googleUserRatingsTotal: number | null
  googleWebsiteUri: string | null
  id: number
  isSaved: boolean
  matchScore: number
  name: string
  neighbourhood: string | null
  restaurant_cuisines: string[] | null
  subregion: string
  venueDistanceKm: number | null
  venueMatchSummary: string
  venue_crowd: string[] | null
  venue_energy: string | null
  venue_music: string[] | null
  venue_price: string | null
  venue_scene: string[] | null
  venue_setting: string[] | null
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
    case 'event_at_risk':
      return 'At risk'
    case 'event_reminder_24h':
    case 'event_reminder_2h':
      return 'Reminder'
    case 'event_waitlist':
      return 'Waitlist'
    case 'event_promoted':
      return 'Promotion'
    case 'event_day_confirmation':
      return 'Confirm today'
    case 'event_follow_up':
      return 'Follow-up'
    case 'event_attendance':
      return 'Attendance'
    default:
      return 'Notice'
  }
}

function formatDayConfirmationStatus(
  status: DashboardEvent['dayOfConfirmationStatus']
) {
  switch (status) {
    case 'confirmed':
      return 'Confirmed today'
    case 'declined':
      return 'Declined today'
    case 'pending':
      return 'Awaiting your answer'
    default:
      return 'Not required yet'
  }
}

function formatViabilityStatus(status: DashboardEvent['viabilityStatus']) {
  switch (status) {
    case 'at_risk':
      return 'At risk'
    case 'forced_go':
      return 'Forced to proceed'
    case 'cancelled_low_confirmations':
      return 'Cancelled for low confirmations'
    default:
      return 'Healthy'
  }
}

function toFeedbackDraft(event: DashboardEvent): FeedbackDraft {
  return {
    groupRating: event.feedback.groupRating ? String(event.feedback.groupRating) : '',
    notes: event.feedback.notes ?? '',
    venueRating: event.feedback.venueRating ? String(event.feedback.venueRating) : '',
    wouldJoinAgain:
      event.feedback.wouldJoinAgain === null
        ? ''
        : event.feedback.wouldJoinAgain
          ? 'yes'
          : 'no',
  }
}

function renderTagList(values: string[] | null | undefined) {
  if (!values?.length) {
    return 'Not set'
  }

  return values.join(', ')
}

function isSameCalendarDay(value: string) {
  const targetDate = new Date(value)
  const now = new Date()

  return (
    targetDate.getFullYear() === now.getFullYear() &&
    targetDate.getMonth() === now.getMonth() &&
    targetDate.getDate() === now.getDate()
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const [email, setEmail] = useState<string | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [events, setEvents] = useState<DashboardEvent[]>([])
  const [restaurants, setRestaurants] = useState<DashboardRestaurant[]>([])
  const [notifications, setNotifications] = useState<NotificationSummary[]>([])
  const [feedbackDrafts, setFeedbackDrafts] = useState<Record<number, FeedbackDraft>>({})
  const [showUnreadOnly, setShowUnreadOnly] = useState(true)
  const [loading, setLoading] = useState(true)
  const [setupError, setSetupError] = useState('')
  const [eventActionError, setEventActionError] = useState('')
  const [eventActionLoadingId, setEventActionLoadingId] = useState<number | null>(null)
  const [restaurantActionLoadingId, setRestaurantActionLoadingId] = useState<number | null>(null)
  const [feedbackSavingId, setFeedbackSavingId] = useState<number | null>(null)
  const [notificationActionLoading, setNotificationActionLoading] = useState(false)
  const [clearReadLoading, setClearReadLoading] = useState(false)
  const [notificationDeletingId, setNotificationDeletingId] = useState<number | null>(null)
  const [notificationError, setNotificationError] = useState('')

  function seedFeedbackDrafts(nextEvents: DashboardEvent[]) {
    setFeedbackDrafts((current) => {
      const nextDrafts = { ...current }

      for (const event of nextEvents) {
        if (!nextDrafts[event.id]) {
          nextDrafts[event.id] = toFeedbackDraft(event)
        }
      }

      return nextDrafts
    })
  }

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
          'bio, cuisine_preferences, display_name, home_latitude, home_longitude, intent, max_travel_minutes, neighbourhood, preferred_crowd, preferred_energy, preferred_music, preferred_price, preferred_scene, preferred_setting, subregion'
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

      if (
        !profileData?.display_name ||
        profileData.home_latitude === null ||
        profileData.home_longitude === null ||
        !profileData.subregion ||
        !profileData.preferred_energy?.length ||
        !profileData.preferred_scene?.length ||
        !profileData.preferred_crowd?.length ||
        !profileData.preferred_music?.length ||
        !profileData.preferred_setting?.length ||
        !profileData.preferred_price?.length
      ) {
        router.replace('/onboarding')
        return
      }

      const { data: notificationData, error: notificationLoadError } = await supabase
        .from('notifications')
        .select('body, created_at, id, read_at, title, type')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(40)
        .returns<NotificationSummary[]>()

      if (!active) {
        return
      }

      if (notificationLoadError) {
        setSetupError(notificationLoadError.message)
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

      const [eventsResponse, restaurantsResponse] = await Promise.all([
        fetch('/api/events', {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }),
        fetch('/api/restaurants', {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }),
      ])

      const eventsPayload = (await eventsResponse.json()) as {
        error?: string
        events?: DashboardEvent[]
        onboardingRequired?: boolean
      }
      const restaurantsPayload = (await restaurantsResponse.json()) as {
        error?: string
        onboardingRequired?: boolean
        restaurants?: DashboardRestaurant[]
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

      if (!restaurantsResponse.ok || restaurantsPayload.error) {
        setSetupError(restaurantsPayload.error ?? 'Could not load restaurants.')
        setLoading(false)
        return
      }

      if (restaurantsPayload.onboardingRequired) {
        router.replace('/onboarding')
        return
      }

      const nextEvents = eventsPayload.events ?? []
      setEmail(user.email ?? null)
      setProfile(profileData)
      setNotifications(notificationData ?? [])
      setEvents(nextEvents)
      setRestaurants(restaurantsPayload.restaurants ?? [])
      seedFeedbackDrafts(nextEvents)
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

    const nextEvents = payload.events ?? []
    setEvents(nextEvents)
    seedFeedbackDrafts(nextEvents)
  }

  async function refreshRestaurants() {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    const accessToken = session?.access_token

    if (!accessToken) {
      setSetupError('Missing active session. Log in again.')
      return
    }

    const response = await fetch('/api/restaurants', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    const payload = (await response.json()) as {
      error?: string
      restaurants?: DashboardRestaurant[]
    }

    if (!response.ok || payload.error) {
      setEventActionError(payload.error ?? 'Could not refresh restaurants.')
      return
    }

    setRestaurants(payload.restaurants ?? [])
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

  async function setDayOfConfirmation(eventId: number, action: 'confirm' | 'decline') {
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

    const response = await fetch('/api/events/day-confirmation', {
      body: JSON.stringify({ action, eventId }),
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      method: 'POST',
    })

    const payload = (await response.json()) as { error?: string }

    if (!response.ok || payload.error) {
      setEventActionError(payload.error ?? 'Could not update your same-day confirmation.')
      setEventActionLoadingId(null)
      return
    }

    await refreshEvents()
    setEventActionLoadingId(null)
  }

  async function setSavedRestaurant(
    restaurantId: number,
    action: 'save' | 'unsave'
  ) {
    setRestaurantActionLoadingId(restaurantId)
    setEventActionError('')

    const {
      data: { session },
    } = await supabase.auth.getSession()
    const accessToken = session?.access_token

    if (!accessToken) {
      setEventActionError('Missing active session. Log in again.')
      setRestaurantActionLoadingId(null)
      return
    }

    const response = await fetch('/api/restaurants', {
      body: JSON.stringify({
        action,
        restaurantId,
      }),
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      method: 'POST',
    })

    const payload = (await response.json()) as { error?: string }

    if (!response.ok || payload.error) {
      setEventActionError(payload.error ?? 'Could not update saved restaurants.')
      setRestaurantActionLoadingId(null)
      return
    }

    await refreshRestaurants()
    setRestaurantActionLoadingId(null)
  }

  async function submitFeedback(eventId: number) {
    const draft = feedbackDrafts[eventId]

    if (!draft) {
      setEventActionError('Feedback form is not ready yet.')
      return
    }

    setFeedbackSavingId(eventId)
    setEventActionError('')

    const {
      data: { session },
    } = await supabase.auth.getSession()
    const accessToken = session?.access_token

    if (!accessToken) {
      setEventActionError('Missing active session. Log in again.')
      setFeedbackSavingId(null)
      return
    }

    const response = await fetch('/api/events/feedback', {
      body: JSON.stringify({
        eventId,
        groupRating: Number(draft.groupRating),
        notes: draft.notes,
        venueRating: Number(draft.venueRating),
        wouldJoinAgain: draft.wouldJoinAgain === 'yes',
      }),
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      method: 'POST',
    })

    const payload = (await response.json()) as { error?: string }

    if (!response.ok || payload.error) {
      setEventActionError(payload.error ?? 'Could not save your feedback.')
      setFeedbackSavingId(null)
      return
    }

    await refreshEvents()
    setFeedbackSavingId(null)
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
  const savedRestaurants = restaurants.filter((restaurant) => restaurant.isSaved)
  const unsavedRestaurants = restaurants.filter((restaurant) => !restaurant.isSaved)
  const leadRestaurant = unsavedRestaurants[0] ?? restaurants[0] ?? null
  const joinedEvents = events.filter(
    (event) => event.signupStatus === 'going' || event.signupStatus === 'waitlisted'
  )
  const unjoinedEvents = events.filter(
    (event) => event.signupStatus !== 'going' && event.signupStatus !== 'waitlisted'
  )
  const tonightEvents = events.filter((event) => isSameCalendarDay(event.starts_at))
  const orderedEvents = [...joinedEvents, ...unjoinedEvents]

  function getJoinButtonLabel(event: DashboardEvent) {
    if (eventActionLoadingId === event.id) {
      return event.signupStatus === 'waitlisted' ? 'Updating...' : 'Joining...'
    }

    if (event.status === 'closed' && !event.isJoined && event.signupStatus !== 'waitlisted') {
      return 'Signup closed'
    }

    if (event.signupStatus === 'waitlisted') {
      return 'Leave waitlist'
    }

    if (event.isJoined) {
      return 'Leave event'
    }

    return event.spotsLeft === 0 ? 'Join waitlist' : 'Join event'
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-8 py-14">
      <p className="text-sm font-medium uppercase tracking-[0.2em] text-zinc-500">
        Dashboard
      </p>
      <h1 className="mt-3 text-4xl font-semibold text-zinc-950">
        Find my night
      </h1>
      <p className="mt-4 max-w-3xl text-base text-zinc-600">
        Logged in as <span className="font-medium text-zinc-950">{email}</span>.
        Your profile now drives restaurant matching first. Events are one way to
        act on that taste signal, not the thing we force every user to start from.
      </p>

      <section className="mt-8 grid gap-4 md:grid-cols-4">
        <div className="rounded-[1.5rem] border border-zinc-200 bg-zinc-50 p-5">
          <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Best open match</p>
          <p className="mt-2 text-3xl font-semibold text-zinc-950">
            {leadRestaurant?.matchScore ?? '--'}
          </p>
          <p className="mt-1 text-sm text-zinc-600">
            {leadRestaurant ? leadRestaurant.name : 'No restaurant match yet'}
          </p>
        </div>
        <div className="rounded-[1.5rem] border border-zinc-200 bg-zinc-50 p-5">
          <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Saved restaurants</p>
          <p className="mt-2 text-3xl font-semibold text-zinc-950">{savedRestaurants.length}</p>
          <p className="mt-1 text-sm text-zinc-600">Your curated venue list</p>
        </div>
        <div className="rounded-[1.5rem] border border-zinc-200 bg-zinc-50 p-5">
          <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Tonight</p>
          <p className="mt-2 text-3xl font-semibold text-zinc-950">{tonightEvents.length}</p>
          <p className="mt-1 text-sm text-zinc-600">Options happening today</p>
        </div>
        <div className="rounded-[1.5rem] border border-zinc-200 bg-zinc-50 p-5">
          <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Unread notices</p>
          <p className="mt-2 text-3xl font-semibold text-zinc-950">{unreadNotificationCount}</p>
          <p className="mt-1 text-sm text-zinc-600">Things needing attention</p>
        </div>
      </section>

      {leadRestaurant ? (
        <section className="mt-8 rounded-[1.75rem] border border-zinc-200 bg-zinc-950 p-6 text-white">
          <p className="text-sm uppercase tracking-[0.2em] text-zinc-400">Top restaurant recommendation</p>
          <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <h2 className="text-3xl font-semibold">{leadRestaurant.name}</h2>
              <p className="mt-3 text-base text-zinc-300">
                {leadRestaurant.subregion}
                {leadRestaurant.neighbourhood
                  ? `, ${leadRestaurant.neighbourhood}`
                  : ''}
              </p>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-300">
                {leadRestaurant.venueMatchSummary} Save it now, and use available events at
                that venue when timing works instead of waiting for the perfect
                event card to appear first.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-200">
              <p>
                Match score:{' '}
                <span className="font-medium text-white">{leadRestaurant.matchScore}</span>
              </p>
              <p className="mt-1">
                Available events:{' '}
                <span className="font-medium text-white">{leadRestaurant.availableEventCount}</span>
              </p>
              {leadRestaurant.venueDistanceKm !== null ? (
                <p className="mt-1">
                  Distance:{' '}
                  <span className="font-medium text-white">
                    {leadRestaurant.venueDistanceKm} km
                  </span>
                </p>
              ) : null}
            </div>
          </div>
          {leadRestaurant.availableEvents.length > 0 ? (
            <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-zinc-400">
                Available events at this venue
              </p>
              <div className="mt-3 space-y-2">
                {leadRestaurant.availableEvents.map((event) => (
                  <div
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 px-3 py-3"
                    key={event.id}
                  >
                    <div>
                      <p className="text-sm font-medium text-white">{event.title}</p>
                      <p className="mt-1 text-xs text-zinc-300">
                        {formatEventDate(event.startsAt)}
                      </p>
                    </div>
                    <span className="text-xs text-zinc-300">
                      {formatViabilityStatus(event.viabilityStatus)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              className="rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-zinc-950 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:bg-zinc-500"
              disabled={restaurantActionLoadingId === leadRestaurant.id}
              onClick={() =>
                void setSavedRestaurant(
                  leadRestaurant.id,
                  leadRestaurant.isSaved ? 'unsave' : 'save'
                )
              }
              type="button"
            >
              {restaurantActionLoadingId === leadRestaurant.id
                ? 'Updating...'
                : leadRestaurant.isSaved
                  ? 'Remove from saved'
                  : 'Save restaurant'}
            </button>
            <Link
              className="rounded-xl border border-white/20 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/10"
              href="/onboarding"
            >
              Refine profile
            </Link>
          </div>
        </section>
      ) : null}

      {savedRestaurants.length > 0 ? (
        <section className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-[1.5rem] border border-zinc-200 bg-zinc-50 p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Saved and ready</p>
            {savedRestaurants[0] ? (
              <>
                <p className="mt-2 text-xl font-semibold text-zinc-950">{savedRestaurants[0].name}</p>
                <p className="mt-1 text-sm text-zinc-600">
                  {savedRestaurants[0].subregion}
                  {savedRestaurants[0].neighbourhood ? `, ${savedRestaurants[0].neighbourhood}` : ''}
                </p>
                <p className="mt-2 text-sm text-zinc-600">
                  Match {savedRestaurants[0].matchScore}. You already marked this venue as interesting, so future event suggestions here should be treated as higher intent.
                </p>
              </>
            ) : (
              <p className="mt-2 text-sm text-zinc-600">
                You have not saved any restaurants yet.
              </p>
            )}
          </div>
          <div className="rounded-[1.5rem] border border-zinc-200 bg-zinc-50 p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Event-ready saved venues</p>
            {savedRestaurants.find((restaurant) => restaurant.availableEventCount > 0) ? (
              <>
                <p className="mt-2 text-xl font-semibold text-zinc-950">
                  {savedRestaurants.find((restaurant) => restaurant.availableEventCount > 0)?.name}
                </p>
                <p className="mt-1 text-sm text-zinc-600">
                  {
                    savedRestaurants.find((restaurant) => restaurant.availableEventCount > 0)
                      ?.availableEventCount
                  }{' '}
                  available event(s)
                </p>
                <p className="mt-2 text-sm text-zinc-600">
                  This is where the product should start nudging action first, because there is already supply attached to saved taste.
                </p>
              </>
            ) : (
              <p className="mt-2 text-sm text-zinc-600">
                None of your saved restaurants have active events yet.
              </p>
            )}
          </div>
        </section>
      ) : null}

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
        <section className="rounded-[1.75rem] border border-zinc-200 bg-zinc-50 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-zinc-500">Profile</p>
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
                Connection mode:{' '}
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
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <p className="text-sm text-zinc-600">
              Energy:
              <span className="ml-1 font-medium text-zinc-950">
                {renderTagList(profile?.preferred_energy)}
              </span>
            </p>
            <p className="text-sm text-zinc-600">
              Scene:
              <span className="ml-1 font-medium text-zinc-950">
                {renderTagList(profile?.preferred_scene)}
              </span>
            </p>
            <p className="text-sm text-zinc-600">
              Crowd:
              <span className="ml-1 font-medium text-zinc-950">
                {renderTagList(profile?.preferred_crowd)}
              </span>
            </p>
            <p className="text-sm text-zinc-600">
              Music:
              <span className="ml-1 font-medium text-zinc-950">
                {renderTagList(profile?.preferred_music)}
              </span>
            </p>
            <p className="text-sm text-zinc-600">
              Setting:
              <span className="ml-1 font-medium text-zinc-950">
                {renderTagList(profile?.preferred_setting)}
              </span>
            </p>
            <p className="text-sm text-zinc-600">
              Price:
              <span className="ml-1 font-medium text-zinc-950">
                {renderTagList(profile?.preferred_price)}
              </span>
            </p>
          </div>
          <p className="mt-4 text-sm text-zinc-600">
            Cuisine preferences:
            <span className="ml-1 font-medium text-zinc-950">
              {renderTagList(profile?.cuisine_preferences)}
            </span>
          </p>
          {profile?.bio ? (
            <p className="mt-4 text-sm leading-7 text-zinc-600">{profile.bio}</p>
          ) : null}
        </section>

        <section className="rounded-[1.75rem] border border-zinc-200 bg-zinc-50 p-6">
          <p className="text-sm uppercase tracking-[0.2em] text-zinc-500">
            Notifications
          </p>
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
                      {notificationDeletingId === notification.id ? 'Deleting...' : 'Dismiss'}
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
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-zinc-500">
              Restaurant matches
            </p>
            <p className="mt-1 text-sm text-zinc-600">
              Save venues you would actually go to. Events become suggestions layered on top of this list.
            </p>
          </div>
          <p className="text-sm text-zinc-600">
            {savedRestaurants.length} saved / {restaurants.length} matched
          </p>
        </div>

        <div className="mt-4 grid gap-4">
          {restaurants.length > 0 ? (
            restaurants.slice(0, 8).map((restaurant) => (
              <article
                className="rounded-[1.5rem] border border-zinc-200 bg-zinc-50 p-6"
                key={restaurant.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-sm uppercase tracking-[0.2em] text-zinc-500">
                      Restaurant match {restaurant.matchScore}
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold text-zinc-950">
                      {restaurant.name}
                    </h2>
                    <p className="mt-2 text-sm text-zinc-700">
                      {restaurant.subregion}
                      {restaurant.neighbourhood ? `, ${restaurant.neighbourhood}` : ''}
                    </p>
                    <p className="mt-1 text-sm text-zinc-600">
                      Energy {restaurant.venue_energy ?? '--'} | Price {restaurant.venue_price ?? '--'}
                    </p>
                    {restaurant.venueDistanceKm !== null ? (
                      <p className="mt-1 text-sm text-zinc-600">
                        Approx {restaurant.venueDistanceKm} km from your anchor
                      </p>
                    ) : null}
                    <p className="mt-1 text-sm text-zinc-600">
                      Scene {renderTagList(restaurant.venue_scene)} | Crowd {renderTagList(restaurant.venue_crowd)}
                    </p>
                    <p className="mt-1 text-sm text-zinc-600">
                      Music {renderTagList(restaurant.venue_music)} | Setting {renderTagList(restaurant.venue_setting)}
                    </p>
                    {restaurant.restaurant_cuisines?.length ? (
                      <p className="mt-1 text-sm text-zinc-600">
                        Cuisine: {restaurant.restaurant_cuisines.join(', ')}
                      </p>
                    ) : null}
                    {restaurant.googleRating !== null ? (
                      <p className="mt-1 text-sm text-zinc-600">
                        Google rating {restaurant.googleRating} ({restaurant.googleUserRatingsTotal ?? 0} reviews)
                      </p>
                    ) : null}
                    {restaurant.formattedAddress ? (
                      <p className="mt-1 text-sm text-zinc-600">
                        {restaurant.formattedAddress}
                      </p>
                    ) : null}
                  </div>
                  <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700">
                    <p>
                      Saved:{' '}
                      <span className="font-medium text-zinc-950">
                        {restaurant.isSaved ? 'Yes' : 'No'}
                      </span>
                    </p>
                    <p className="mt-1">
                      Available events:{' '}
                      <span className="font-medium text-zinc-950">
                        {restaurant.availableEventCount}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-zinc-200 bg-white p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                    Why it matches
                  </p>
                  <p className="mt-2 text-sm text-zinc-600">{restaurant.venueMatchSummary}</p>
                </div>

                <div className="mt-5 rounded-2xl border border-zinc-200 bg-white p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                    Available events here
                  </p>
                  {restaurant.availableEvents.length > 0 ? (
                    <div className="mt-3 space-y-3">
                      {restaurant.availableEvents.map((event) => (
                        <div
                          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-3"
                          key={event.id}
                        >
                          <div>
                            <p className="text-sm font-medium text-zinc-950">{event.title}</p>
                            <p className="mt-1 text-xs text-zinc-600">
                              {formatEventDate(event.startsAt)}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-zinc-600">
                              {formatViabilityStatus(event.viabilityStatus)}
                            </span>
                            <button
                              className="rounded-xl bg-zinc-950 px-3 py-2 text-xs font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
                              disabled={eventActionLoadingId === event.id}
                              onClick={() => void setEventSignup(event.id, 'join')}
                              type="button"
                            >
                              {eventActionLoadingId === event.id
                                ? 'Updating...'
                                : event.signupStatus === 'going'
                                  ? 'Joined'
                                  : event.signupStatus === 'waitlisted'
                                    ? 'Waitlisted'
                                    : 'Join event'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-zinc-600">
                      No active events here yet. Saving the venue is still useful because it tells the product what supply to prioritize for you.
                    </p>
                  )}
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    className={`rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                      restaurant.isSaved
                        ? 'border border-zinc-950 text-zinc-950 hover:bg-zinc-950 hover:text-white'
                        : 'bg-zinc-950 text-white hover:bg-zinc-800'
                    } disabled:cursor-not-allowed disabled:border-zinc-300 disabled:bg-zinc-400 disabled:text-zinc-200`}
                    disabled={restaurantActionLoadingId === restaurant.id}
                    onClick={() =>
                      void setSavedRestaurant(
                        restaurant.id,
                        restaurant.isSaved ? 'unsave' : 'save'
                      )
                    }
                    type="button"
                  >
                    {restaurantActionLoadingId === restaurant.id
                      ? 'Updating...'
                      : restaurant.isSaved
                        ? 'Remove from saved'
                        : 'Save restaurant'}
                  </button>
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-[1.5rem] border border-zinc-200 bg-zinc-50 p-6 text-sm text-zinc-600">
              No restaurants are available to match right now.
            </div>
          )}
        </div>
      </section>

      <section className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-zinc-500">
              Match board
            </p>
            <p className="mt-1 text-sm text-zinc-600">
              Current commitments are shown first, then the rest of the matches by fit.
            </p>
          </div>
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
          {orderedEvents.length > 0 ? (
            orderedEvents.map((event) => {
              const feedbackDraft = feedbackDrafts[event.id] ?? toFeedbackDraft(event)

              return (
                <article
                  className="rounded-[1.5rem] border border-zinc-200 bg-zinc-50 p-6"
                  key={event.id}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-sm uppercase tracking-[0.2em] text-zinc-500">
                        Match score {event.projectedRestaurantScore}
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
                      <p className="mt-1 text-sm text-zinc-600">
                        Duration: {event.duration_minutes} minutes
                      </p>
                      <p className="mt-1 text-sm text-zinc-600">
                        Energy {event.venue_energy ?? '--'} | Price {event.venue_price ?? '--'}
                      </p>
                      {event.venueDistanceKm !== null ? (
                        <p className="mt-1 text-sm text-zinc-600">
                          Approx {event.venueDistanceKm} km from your anchor
                        </p>
                      ) : null}
                      <p className="mt-1 text-sm text-zinc-600">
                        Scene {renderTagList(event.venue_scene)} | Crowd {renderTagList(event.venue_crowd)}
                      </p>
                      <p className="mt-1 text-sm text-zinc-600">
                        Music {renderTagList(event.venue_music)} | Setting {renderTagList(event.venue_setting)}
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
                        <span className="font-medium text-zinc-950">{event.spotsLeft}</span>
                      </p>
                      <p className="mt-1">
                        Waitlist:{' '}
                        <span className="font-medium text-zinc-950">{event.waitlistCount}</span>
                      </p>
                      <p className="mt-1">
                        Confirmed today:{' '}
                        <span className="font-medium text-zinc-950">
                          {event.confirmedTodayCount}/{event.minimumViableAttendees}
                        </span>
                      </p>
                      <p className="mt-1">
                        Health:{' '}
                        <span className="font-medium text-zinc-950">
                          {formatViabilityStatus(event.viabilityStatus)}
                        </span>
                      </p>
                    </div>
                  </div>

                  {event.description ? (
                    <p className="mt-4 text-sm leading-7 text-zinc-600">{event.description}</p>
                  ) : null}

                  {event.viabilityStatus === 'at_risk' ? (
                    <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                      This event is at risk. Same-day confirmations are below the viable threshold,
                      so don&apos;t ignore the numbers and assume someone else will carry it.
                    </div>
                  ) : null}

                  {event.viabilityStatus === 'forced_go' ? (
                    <div className="mt-5 rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-700">
                      The host team has forced this event to proceed despite the low same-day count.
                    </div>
                  ) : null}

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                        Venue fit
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-zinc-950">
                        {event.projectedRestaurantScore}
                      </p>
                      <p className="mt-1 text-sm text-zinc-600">
                        {event.venueMatchSummary}
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

                  <div className="mt-5 rounded-2xl border border-zinc-200 bg-white p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                      Your status
                    </p>
                    <p className="mt-2 text-lg font-semibold text-zinc-950">
                      {event.signupStatus === 'going'
                        ? 'Confirmed'
                        : event.signupStatus === 'waitlisted'
                          ? `Waitlisted${event.waitlistPosition ? ` (#${event.waitlistPosition})` : ''}`
                          : 'Not joined'}
                    </p>
                    <p className="mt-1 text-sm text-zinc-600">
                      {event.signupStatus === 'going'
                        ? 'You have a confirmed seat at this event.'
                        : event.signupStatus === 'waitlisted'
                          ? 'You are in the queue. If someone drops out early enough, promotion happens automatically.'
                          : 'Join the event to lock your seat, or join the waitlist if it is already full.'}
                    </p>
                    {event.signupStatus === 'going' ? (
                      <p className="mt-2 text-sm text-zinc-600">
                        Day-of response: {formatDayConfirmationStatus(event.dayOfConfirmationStatus)}
                      </p>
                    ) : null}
                  </div>

                  {event.needsDayOfConfirmation ? (
                    <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-amber-700">
                        Today&apos;s confirmation
                      </p>
                      <p className="mt-2 text-base font-semibold text-zinc-950">
                        This event is today. Confirm whether you are still going.
                      </p>
                      <p className="mt-2 text-sm text-zinc-700">
                        This is stricter than the original signup on purpose. A seat from
                        three days ago is not the same as a seat someone will actually use
                        tonight.
                      </p>
                      <div className="mt-4 flex flex-wrap gap-3">
                        <button
                          className="rounded-xl bg-zinc-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
                          disabled={eventActionLoadingId === event.id}
                          onClick={() => void setDayOfConfirmation(event.id, 'confirm')}
                          type="button"
                        >
                          {eventActionLoadingId === event.id
                            ? 'Updating...'
                            : 'Confirm I am still going'}
                        </button>
                        <button
                          className="rounded-xl border border-zinc-950 px-4 py-2.5 text-sm font-medium text-zinc-950 transition hover:bg-zinc-950 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-300 disabled:text-zinc-400"
                          disabled={eventActionLoadingId === event.id}
                          onClick={() => void setDayOfConfirmation(event.id, 'decline')}
                          type="button"
                        >
                          {eventActionLoadingId === event.id
                            ? 'Updating...'
                            : "I can't make it"}
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {event.shouldReconsiderGoing ? (
                    <div className="mt-5 rounded-2xl border border-zinc-200 bg-white p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                        Viability check
                      </p>
                      <p className="mt-2 text-base font-semibold text-zinc-950">
                        {event.confirmedTodayCount} people have confirmed today.
                      </p>
                      <p className="mt-2 text-sm text-zinc-600">
                        The event target is {event.minimumViableAttendees}. If the number
                        stays low, you can still leave instead of drifting into a
                        weak plan.
                      </p>
                      <p className="mt-2 text-sm text-zinc-600">
                        People confirmed today:
                        <span className="ml-1 font-medium text-zinc-950">
                          {event.attendeePreview
                            .filter((attendee) => attendee.dayOfConfirmationStatus === 'confirmed')
                            .map((attendee) => attendee.displayName)
                            .join(', ') || 'No one yet'}
                        </span>
                      </p>
                    </div>
                  ) : null}

                  <div className="mt-5 rounded-2xl border border-zinc-200 bg-white p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                      Attendee visibility
                    </p>
                    {event.canViewAttendees ? (
                      <>
                        <p className="mt-2 text-sm text-zinc-600">
                          Confirmed attendees you can currently see, including whether they
                          have checked in for today:
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {event.attendeePreview.length > 0 ? (
                            event.attendeePreview.map((attendee, index) => (
                              <span
                                className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-sm text-zinc-700"
                                key={`${event.id}-${attendee.displayName}-${index}`}
                              >
                                <span className="font-medium text-zinc-950">
                                  {attendee.displayName}
                                </span>
                                {' - '}
                                {attendee.dayOfConfirmationStatus === 'confirmed'
                                  ? 'confirmed today'
                                  : 'pending today'}
                              </span>
                            ))
                          ) : (
                            <p className="text-sm font-medium text-zinc-950">
                              No confirmed attendees yet.
                            </p>
                          )}
                        </div>
                      </>
                    ) : (
                      <p className="mt-2 text-sm text-zinc-600">
                        Join the event or waitlist to see first names of confirmed attendees.
                      </p>
                    )}
                  </div>

                  {event.canSubmitFeedback ? (
                    <div className="mt-5 rounded-2xl border border-zinc-200 bg-white p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                        Post-event feedback
                      </p>
                      <p className="mt-2 text-sm text-zinc-600">
                        This matters more than more scoring. Tell the product whether the
                        venue and group actually worked.
                      </p>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <label className="space-y-2">
                          <span className="text-sm font-medium text-zinc-700">
                            Venue rating
                          </span>
                          <select
                            className="w-full rounded-xl border border-zinc-300 px-4 py-3 outline-none transition focus:border-zinc-950"
                            onChange={(nextEvent) =>
                              setFeedbackDrafts((current) => ({
                                ...current,
                                [event.id]: {
                                  ...feedbackDraft,
                                  venueRating: nextEvent.target.value,
                                },
                              }))
                            }
                            value={feedbackDraft.venueRating}
                          >
                            <option value="">Select</option>
                            {[1, 2, 3, 4, 5].map((rating) => (
                              <option key={rating} value={rating}>
                                {rating}/5
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="space-y-2">
                          <span className="text-sm font-medium text-zinc-700">
                            Group rating
                          </span>
                          <select
                            className="w-full rounded-xl border border-zinc-300 px-4 py-3 outline-none transition focus:border-zinc-950"
                            onChange={(nextEvent) =>
                              setFeedbackDrafts((current) => ({
                                ...current,
                                [event.id]: {
                                  ...feedbackDraft,
                                  groupRating: nextEvent.target.value,
                                },
                              }))
                            }
                            value={feedbackDraft.groupRating}
                          >
                            <option value="">Select</option>
                            {[1, 2, 3, 4, 5].map((rating) => (
                              <option key={rating} value={rating}>
                                {rating}/5
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <div className="mt-3">
                        <p className="text-sm font-medium text-zinc-700">
                          Would you join again?
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {[
                            { label: 'Yes', value: 'yes' },
                            { label: 'No', value: 'no' },
                          ].map((option) => (
                            <button
                              className={`rounded-xl px-3 py-2 text-xs font-medium transition ${
                                feedbackDraft.wouldJoinAgain === option.value
                                  ? 'bg-zinc-950 text-white'
                                  : 'border border-zinc-950 text-zinc-950 hover:bg-zinc-950 hover:text-white'
                              }`}
                              key={option.value}
                              onClick={() =>
                                setFeedbackDrafts((current) => ({
                                  ...current,
                                  [event.id]: {
                                    ...feedbackDraft,
                                    wouldJoinAgain: option.value as 'yes' | 'no',
                                  },
                                }))
                              }
                              type="button"
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <label className="mt-3 block space-y-2">
                        <span className="text-sm font-medium text-zinc-700">Notes</span>
                        <textarea
                          className="min-h-24 w-full rounded-xl border border-zinc-300 px-4 py-3 outline-none transition focus:border-zinc-950"
                          onChange={(nextEvent) =>
                            setFeedbackDrafts((current) => ({
                              ...current,
                              [event.id]: {
                                ...feedbackDraft,
                                notes: nextEvent.target.value,
                              },
                            }))
                          }
                          placeholder="What worked or didn't?"
                          value={feedbackDraft.notes}
                        />
                      </label>
                      <div className="mt-4 flex flex-wrap items-center gap-3">
                        <button
                          className="rounded-xl bg-zinc-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
                          disabled={
                            feedbackSavingId === event.id ||
                            !feedbackDraft.groupRating ||
                            !feedbackDraft.venueRating ||
                            !feedbackDraft.wouldJoinAgain
                          }
                          onClick={() => void submitFeedback(event.id)}
                          type="button"
                        >
                          {feedbackSavingId === event.id
                            ? 'Saving...'
                            : event.feedback.submitted
                              ? 'Update feedback'
                              : 'Save feedback'}
                        </button>
                        {event.feedback.submitted ? (
                          <p className="text-sm text-zinc-600">
                            Feedback already submitted. You can still update it.
                          </p>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-5 flex flex-wrap gap-3">
                    {event.isJoined || event.signupStatus === 'waitlisted' ? (
                      <button
                        className="rounded-xl border border-zinc-950 px-4 py-2.5 text-sm font-medium text-zinc-950 transition hover:bg-zinc-950 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-300 disabled:text-zinc-400"
                        disabled={eventActionLoadingId === event.id}
                        onClick={() => void setEventSignup(event.id, 'leave')}
                        type="button"
                      >
                        {getJoinButtonLabel(event)}
                      </button>
                    ) : (
                      <button
                        className="rounded-xl bg-zinc-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
                        disabled={eventActionLoadingId === event.id || event.status !== 'open'}
                        onClick={() => void setEventSignup(event.id, 'join')}
                        type="button"
                      >
                        {getJoinButtonLabel(event)}
                      </button>
                    )}
                  </div>
                </article>
              )
            })
          ) : (
            <div className="rounded-[1.5rem] border border-zinc-200 bg-zinc-50 p-6 text-sm text-zinc-600">
              No events are available to match right now. Admins need to publish
              tagged venue nights before the ranking model has anything useful
              to work with.
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
