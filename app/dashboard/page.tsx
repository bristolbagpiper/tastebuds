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
import {
  fetchEvents,
  fetchNotifications,
  fetchRestaurants,
  getAppBootstrap,
  logout,
  setEventSignup,
  setSavedRestaurant,
} from '@/lib/app/client'
import { isProfileComplete } from '@/lib/app/format'
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
  const nextEvent = joinedEvents[0] ?? events.find((event) => event.status === 'open') ?? null

  const nextAction = useMemo(() => {
    const dayConfirmationEvent = events.find((event) => event.needsDayOfConfirmation)

    if (dayConfirmationEvent) {
      return {
        cta: '/events/' + dayConfirmationEvent.id,
        description: 'A dinner you joined is happening today and still needs your reply.',
        label: 'Confirm your table',
      }
    }

    if (unreadNotificationCount > 0) {
      return {
        cta: '/notifications',
        description: `${unreadNotificationCount} unread ${unreadNotificationCount === 1 ? 'note is' : 'notes are'} waiting in your inbox.`,
        label: 'Check your inbox',
      }
    }

    if (topRestaurant && !topRestaurant.isSaved) {
      return {
        cta: '/restaurants',
        description: `${topRestaurant.name} is a strong fit for your taste, budget and social vibe.`,
        label: 'Save your next spot',
      }
    }

    if (nextEvent) {
      return {
        cta: `/events/${nextEvent.id}`,
        description: 'There is already a table worth deciding on.',
        label: 'Review your next table',
      }
    }

    return {
      cta: '/profile',
      description: 'A sharper taste profile gives you better tables back.',
      label: 'Refresh your profile',
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
    <AppShell currentPath="/dashboard" email={email} onLogout={handleLogout} title="Home">
      <PageHeader
        description="Find your next table."
        eyebrow="Home"
        title={`Good evening${profile?.display_name ? `, ${profile.display_name}` : ''}`}
      />

      <section className="rounded-[2rem] border border-[color:rgba(199,106,74,0.16)] bg-[color:rgba(255,248,243,0.9)] px-6 py-7 shadow-[0_24px_50px_rgba(94,74,60,0.08)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="tb-label text-xs font-medium uppercase tracking-[0.16em]">Start here</p>
            <p className="mt-3 text-3xl font-semibold text-[color:var(--foreground)]">Find my table</p>
            <p className="tb-copy mt-3 max-w-2xl text-base leading-7">
              Restaurants picked around your taste, budget and social vibe.
            </p>
          </div>
          <Button href="/restaurants">Find my table</Button>
        </div>
      </section>

      {actionError ? (
        <div className="mt-6 rounded-3xl border border-[color:color-mix(in_srgb,var(--accent)_28%,white)] bg-[color:color-mix(in_srgb,var(--accent)_10%,var(--surface))] p-4 text-sm text-[color:var(--accent-strong)]">
          {actionError}
        </div>
      ) : null}

      <section className="rounded-[2rem] bg-[color:rgba(255,255,255,0.56)] px-6 py-6">
        <p className="tb-label text-xs font-medium uppercase tracking-[0.16em]">Best next step</p>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-2xl font-semibold text-[color:var(--foreground)]">{nextAction.label}</p>
            <p className="tb-copy mt-2 max-w-2xl text-sm leading-7">{nextAction.description}</p>
          </div>
          <Button href={nextAction.cta}>Open</Button>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <ActionCard
          description="Browse places picked for your taste."
          href="/restaurants"
          label="Restaurants"
          meta={<span className="tb-label text-sm font-medium">{restaurants.length} picks</span>}
        />
        <ActionCard
          description="See live dinners and the ones you have joined."
          href="/events"
          label="Events"
          meta={<span className="tb-label text-sm font-medium">{events.length} live</span>}
        />
        <ActionCard
          description="Open reminders, changes and table updates."
          href="/notifications"
          label="Inbox"
          meta={<span className="tb-label text-sm font-medium">{unreadNotificationCount} unread</span>}
        />
        <ActionCard
          description="Keep your taste profile up to date."
          href="/profile"
          label="Profile"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
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
              description="No restaurant picks are ready yet."
              title="Nothing picked yet"
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
              description={savedRestaurants.length > 0 ? 'No events are live yet.' : 'Save a few restaurants and we will surface the right dinners here.'}
              title="Nothing live yet"
            />
          )}
        </section>
      </div>
    </AppShell>
  )
}
