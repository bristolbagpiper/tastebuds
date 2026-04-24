'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

import { ActionCard } from '@/components/app/ActionCard'
import { AppShell } from '@/components/app/AppShell'
import { Button } from '@/components/app/Button'
import { EmptyState } from '@/components/app/EmptyState'
import { EventCard } from '@/components/app/EventCard'
import { PageHeader } from '@/components/app/PageHeader'
import { RestaurantCard } from '@/components/app/RestaurantCard'
import { StatCard } from '@/components/app/StatCard'
import {
  fetchEvents,
  fetchNotifications,
  fetchRestaurants,
  getAppBootstrap,
  logout,
  setEventSignup,
  setSavedRestaurant,
} from '@/lib/app/client'
import { isSameCalendarDay, isProfileComplete } from '@/lib/app/format'
import type { DashboardEvent, DashboardRestaurant, NotificationSummary, Profile } from '@/lib/app/types'

export default function DashboardPage() {
  const router = useRouter()
  const [email, setEmail] = useState<string | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [events, setEvents] = useState<DashboardEvent[]>([])
  const [restaurants, setRestaurants] = useState<DashboardRestaurant[]>([])
  const [notifications, setNotifications] = useState<NotificationSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [setupError, setSetupError] = useState('')
  const [actionError, setActionError] = useState('')
  const [eventActionLoadingId, setEventActionLoadingId] = useState<number | null>(null)
  const [restaurantActionLoadingId, setRestaurantActionLoadingId] = useState<number | null>(null)

  useEffect(() => {
    let active = true

    async function loadDashboard() {
      try {
        const bootstrap = await getAppBootstrap()

        if (!active) {
          return
        }

        if (!isProfileComplete(bootstrap.profile)) {
          router.replace('/onboarding')
          return
        }

        const [eventsPayload, restaurantsPayload, notificationResponse] = await Promise.all([
          fetchEvents(bootstrap.accessToken),
          fetchRestaurants(bootstrap.accessToken),
          fetchNotifications(bootstrap.userId),
        ])

        if (!active) {
          return
        }

        if (eventsPayload.onboardingRequired || restaurantsPayload.onboardingRequired) {
          router.replace('/onboarding')
          return
        }

        if (notificationResponse.error) {
          setSetupError(notificationResponse.error.message)
          setLoading(false)
          return
        }

        setEmail(bootstrap.email)
        setProfile(bootstrap.profile)
        setNotifications(notificationResponse.data ?? [])
        setEvents(eventsPayload.events ?? [])
        setRestaurants(restaurantsPayload.restaurants ?? [])
        setLoading(false)
      } catch (error) {
        setSetupError(error instanceof Error ? error.message : 'Could not load dashboard.')
        setLoading(false)
      }
    }

    void loadDashboard()

    return () => {
      active = false
    }
  }, [router])

  async function handleLogout() {
    await logout()
    router.replace('/login')
  }

  async function handleEventSignup(eventId: number) {
    setActionError('')
    setEventActionLoadingId(eventId)

    try {
      await setEventSignup(eventId, 'join')
      const payload = await fetchEvents()
      setEvents(payload.events ?? [])
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : 'Could not update your event signup.'
      )
    } finally {
      setEventActionLoadingId(null)
    }
  }

  async function handleNextEventAction(event: DashboardEvent, action: 'join' | 'leave') {
    setActionError('')
    setEventActionLoadingId(event.id)

    try {
      await setEventSignup(event.id, action)
      const payload = await fetchEvents()
      setEvents(payload.events ?? [])
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : 'Could not update your event signup.'
      )
    } finally {
      setEventActionLoadingId(null)
    }
  }

  async function handleToggleSaved(restaurantId: number, action: 'save' | 'unsave') {
    setActionError('')
    setRestaurantActionLoadingId(restaurantId)

    try {
      await setSavedRestaurant(restaurantId, action)
      const payload = await fetchRestaurants()
      setRestaurants(payload.restaurants ?? [])
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : 'Could not update saved restaurants.'
      )
    } finally {
      setRestaurantActionLoadingId(null)
    }
  }

  const unreadNotificationCount = notifications.filter((item) => !item.read_at).length
  const savedRestaurants = restaurants.filter((restaurant) => restaurant.isSaved)
  const topRestaurant = restaurants.find((restaurant) => !restaurant.isSaved) ?? restaurants[0] ?? null
  const joinedEvents = events.filter(
    (event) => event.signupStatus === 'going' || event.signupStatus === 'waitlisted'
  )
  const nextEvent =
    joinedEvents[0] ??
    events.find((event) => event.status === 'open') ??
    null
  const tonightCount = events.filter((event) => isSameCalendarDay(event.starts_at)).length

  const nextAction = useMemo(() => {
    const dayConfirmationEvent = events.find((event) => event.needsDayOfConfirmation)

    if (dayConfirmationEvent) {
      return {
        cta: '/events/' + dayConfirmationEvent.id,
        description: 'A joined event needs same-day confirmation.',
        label: 'Confirm today',
      }
    }

    if (unreadNotificationCount > 0) {
      return {
        cta: '/notifications',
        description: `${unreadNotificationCount} unread notification${unreadNotificationCount === 1 ? '' : 's'} waiting.`,
        label: 'Clear notifications',
      }
    }

    if (topRestaurant && !topRestaurant.isSaved) {
      return {
        cta: '/restaurants',
        description: `${topRestaurant.name} is your strongest open restaurant match right now.`,
        label: 'Review top restaurant',
      }
    }

    if (nextEvent) {
      return {
        cta: `/events/${nextEvent.id}`,
        description: 'Your best next event decision is already available.',
        label: 'Open next event',
      }
    }

    return {
      cta: '/profile',
      description: 'Tighten your taste profile so the recommendations stay usable.',
      label: 'Refine profile',
    }
  }, [events, nextEvent, topRestaurant, unreadNotificationCount])

  if (loading) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-6xl items-center px-8">
        <p className="tb-copy text-sm">Loading dashboard...</p>
      </main>
    )
  }

  if (setupError) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center px-8 py-16">
        <p className="tb-label text-sm font-medium uppercase tracking-[0.2em]">Dashboard</p>
        <h1 className="mt-3 text-4xl font-semibold text-[color:var(--foreground)]">Data setup still has gaps</h1>
        <p className="tb-copy mt-4 max-w-2xl text-base">{setupError}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button href="/" variant="secondary">
            Back to home
          </Button>
          <Button onClick={handleLogout}>Log out</Button>
        </div>
      </main>
    )
  }

  return (
    <AppShell currentPath="/dashboard" email={email} onLogout={handleLogout} title="Dashboard">
      <PageHeader
        description="This is the home screen now, not the entire product stuffed into one route."
        eyebrow="Home"
        title={`Good evening${profile?.display_name ? `, ${profile.display_name}` : ''}`}
      />

      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <StatCard label="Top restaurant match" note={topRestaurant?.name ?? 'No match yet'} value={topRestaurant?.matchScore ?? '--'} />
        <StatCard label="Saved restaurants" note="Your shortlist" value={savedRestaurants.length} />
        <StatCard label="Tonight" note="Events happening today" value={tonightCount} />
        <StatCard label="Unread notices" note="Needs attention" value={unreadNotificationCount} />
      </div>

      <section className="tb-panel-soft mt-6 rounded-3xl p-6">
        <p className="tb-label text-xs font-medium uppercase tracking-[0.16em]">Best next action</p>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-2xl font-semibold text-[color:var(--foreground)]">{nextAction.label}</p>
            <p className="tb-copy mt-2 text-sm leading-6">{nextAction.description}</p>
          </div>
          <Button href={nextAction.cta}>Open</Button>
        </div>
      </section>

      {actionError ? (
        <div className="mt-6 rounded-3xl border border-[color:color-mix(in_srgb,var(--accent)_28%,white)] bg-[color:color-mix(in_srgb,var(--accent)_10%,var(--surface))] p-4 text-sm text-[color:var(--accent-strong)]">
          {actionError}
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <ActionCard
          description="Browse your matched restaurants, curate saved venues, and join from restaurant-led suggestions."
          href="/restaurants"
          label="Restaurants"
          meta={<span className="tb-label text-sm font-medium">{restaurants.length}</span>}
        />
        <ActionCard
          description="Review joined plans, open opportunities, and waitlist status."
          href="/events"
          label="Events"
          meta={<span className="tb-label text-sm font-medium">{events.length}</span>}
        />
        <ActionCard
          description="Edit the taste profile that drives scoring and distance logic."
          href="/profile"
          label="Profile"
        />
        <ActionCard
          description="Clear notices, reminders, and event status changes without dragging that whole workflow into the home screen."
          href="/notifications"
          label="Notifications"
          meta={<span className="tb-label text-sm font-medium">{unreadNotificationCount} unread</span>}
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-[color:var(--foreground)]">Top restaurant match</h2>
            <Link className="text-sm font-medium text-[color:var(--text-muted)] hover:text-[color:var(--accent-strong)]" href="/restaurants">
              View all
            </Link>
          </div>
          {topRestaurant ? (
            <RestaurantCard
              eventLoadingId={eventActionLoadingId}
              onJoinEvent={(eventId) => void handleEventSignup(eventId)}
              onToggleSaved={(restaurantId, action) => void handleToggleSaved(restaurantId, action)}
              restaurant={topRestaurant}
              saving={restaurantActionLoadingId === topRestaurant.id}
            />
          ) : (
            <EmptyState
              description="No restaurant matches are available right now."
              title="No restaurants yet"
            />
          )}
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-[color:var(--foreground)]">
              {joinedEvents.length > 0 ? 'Next joined event' : 'Strongest event recommendation'}
            </h2>
            <Link className="text-sm font-medium text-[color:var(--text-muted)] hover:text-[color:var(--accent-strong)]" href="/events">
              View all
            </Link>
          </div>
          {nextEvent ? (
            <EventCard
              detailHref={`/events/${nextEvent.id}`}
              event={nextEvent}
              eventActionLoadingId={eventActionLoadingId}
              onSetEventSignup={(action) => void handleNextEventAction(nextEvent, action)}
            />
          ) : (
            <EmptyState
              description="No event matches are available right now."
              title="No events yet"
            />
          )}
        </section>
      </div>
    </AppShell>
  )
}
