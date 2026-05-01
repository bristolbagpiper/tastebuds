'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

import { AppShell } from '@/components/app/AppShell'
import { Button } from '@/components/app/Button'
import { EmptyState } from '@/components/app/EmptyState'
import { EventCard } from '@/components/app/EventCard'
import { PageHeader } from '@/components/app/PageHeader'
import {
  fetchEvents,
  fetchRestaurants,
  getAppBootstrap,
  logout,
  setEventSignup,
} from '@/lib/app/client'
import type { DashboardEvent, DashboardRestaurant } from '@/lib/app/types'

function getSavedRestaurantKeys(restaurants: DashboardRestaurant[]) {
  return new Set(
    restaurants
      .filter((restaurant) => restaurant.isSaved)
      .map((restaurant) =>
        restaurant.googlePlaceId
          ? `place:${restaurant.googlePlaceId}`
          : `name:${restaurant.name.toLowerCase()}::${restaurant.subregion.toLowerCase()}`
      )
  )
}

function isVisibleEvent(event: DashboardEvent, savedRestaurantKeys: Set<string>) {
  if (
    event.signupStatus === 'going' ||
    event.signupStatus === 'attended' ||
    event.signupStatus === 'no_show'
  ) {
    return true
  }

  const placeKey = event.restaurantGooglePlaceId
    ? `place:${event.restaurantGooglePlaceId}`
    : null
  const fallbackKey = `name:${event.restaurant_name.toLowerCase()}::${event.restaurant_subregion.toLowerCase()}`

  return (placeKey !== null && savedRestaurantKeys.has(placeKey)) || savedRestaurantKeys.has(fallbackKey)
}

function needsFeedback(event: DashboardEvent) {
  return event.canSubmitFeedback && !event.feedback.submitted
}

function isRelevantPastEvent(event: DashboardEvent) {
  return (
    event.hasEnded &&
    (event.signupStatus === 'going' ||
      event.signupStatus === 'attended' ||
      event.signupStatus === 'no_show' ||
      event.feedback.submitted)
  )
}

export default function EventsPage() {
  const router = useRouter()
  const [events, setEvents] = useState<DashboardEvent[]>([])
  const [savedRestaurantKeys, setSavedRestaurantKeys] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [eventActionLoadingId, setEventActionLoadingId] = useState<number | null>(null)

  useEffect(() => {
    let active = true

    async function loadPage() {
      try {
        const bootstrap = await getAppBootstrap()

        if (!active) {
          return
        }

        const [eventsPayload, restaurantsPayload] = await Promise.all([
          fetchEvents(bootstrap.accessToken),
          fetchRestaurants(bootstrap.accessToken),
        ])

        if (!active) {
          return
        }

        if (eventsPayload.onboardingRequired || restaurantsPayload.onboardingRequired) {
          router.replace('/onboarding')
          return
        }

        setSavedRestaurantKeys(getSavedRestaurantKeys(restaurantsPayload.restaurants ?? []))
        setEvents(eventsPayload.events ?? [])
        setLoading(false)
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : 'Could not load events.')
        setLoading(false)
      }
    }

    void loadPage()

    return () => {
      active = false
    }
  }, [router])

  async function handleLogout() {
    await logout()
    router.replace('/login')
  }

  async function handleEventSignup(eventId: number, action: 'join' | 'leave') {
    setError('')
    setEventActionLoadingId(eventId)

    try {
      await setEventSignup(eventId, action)
      const payload = await fetchEvents()
      setEvents(payload.events ?? [])
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not update your event signup.')
    } finally {
      setEventActionLoadingId(null)
    }
  }

  const groupedEvents = useMemo(() => {
    const visibleEvents = events.filter((event) => isVisibleEvent(event, savedRestaurantKeys))
    const activeEvents = visibleEvents.filter((event) => !event.hasEnded)
    const joinedEvents = activeEvents.filter(
      (event) => event.signupStatus === 'going'
    )
    const unjoinedEvents = activeEvents.filter(
      (event) => event.signupStatus !== 'going'
    )
    const pastEvents = visibleEvents
      .filter(isRelevantPastEvent)
      .sort((left, right) => right.starts_at.localeCompare(left.starts_at))

    return {
      active: [...joinedEvents, ...unjoinedEvents],
      needsFeedback: pastEvents.filter(needsFeedback),
      past: pastEvents,
    }
  }, [events, savedRestaurantKeys])

  if (loading) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-6xl items-center px-8">
        <p className="tb-copy text-sm">Loading events...</p>
      </main>
    )
  }

  return (
    <AppShell currentPath="/events" onLogout={handleLogout}>
      <PageHeader
        description="Small dinners ranked by venue fit and the people you are likely to get on with."
        eyebrow="Events"
        title="Tables worth joining"
      />

      {error ? (
        <div className="rounded-[1.5rem] border border-[color:var(--accent-border)] bg-[color:var(--accent-softer)] p-4 text-sm text-[color:var(--accent-strong)]">
          {error}
        </div>
      ) : null}

      <div className="rounded-[1.75rem] border border-[color:var(--border-soft)] bg-white p-5 shadow-[0_10px_40px_-10px_rgba(113,92,0,0.08)]">
        <p className="text-sm text-[color:var(--text-muted)]">
          {groupedEvents.active.length > 0
            ? `${groupedEvents.active.length} live ${groupedEvents.active.length === 1 ? 'table' : 'tables'} ranked by your match score right now.`
            : groupedEvents.past.length > 0
              ? 'No live tables right now. Past events are saved below.'
              : 'Save a restaurant first to unlock live tables here.'}
        </p>
      </div>

      {groupedEvents.needsFeedback.length > 0 ? (
        <section className="rounded-[1.75rem] border border-[color:var(--accent-border)] bg-[color:var(--accent-softer)] p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--accent-strong)]">
                Feedback due
              </p>
              <p className="mt-2 text-base font-semibold text-[color:var(--foreground)]">
                {groupedEvents.needsFeedback.length === 1
                  ? `${groupedEvents.needsFeedback[0]!.title} has ended. Leave feedback while it is fresh.`
                  : `${groupedEvents.needsFeedback.length} past tables need your feedback.`}
              </p>
            </div>
            <Button href={`/events/${groupedEvents.needsFeedback[0]!.id}`}>
              Leave feedback
            </Button>
          </div>
        </section>
      ) : null}

      <div className="grid gap-5">
        {groupedEvents.active.length > 0 ? (
          groupedEvents.active.map((event) => (
            <EventCard
              detailHref={`/events/${event.id}`}
              event={event}
              eventActionLoadingId={eventActionLoadingId}
              key={event.id}
              onSetEventSignup={(action) => void handleEventSignup(event.id, action)}
            />
          ))
        ) : (
          <EmptyState
            action={
              <Button href="/restaurants">
                Save a restaurant
              </Button>
            }
            description="Events only appear here after you save the venue, so this list stays tied to places you actually want."
            title="No saved-venue tables yet"
          />
        )}
      </div>

      {groupedEvents.past.length > 0 ? (
        <details className="group rounded-[1.75rem] border border-[color:var(--border-soft)] bg-white p-5 shadow-[0_10px_40px_-10px_rgba(113,92,0,0.08)]">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold text-[color:var(--foreground)] marker:hidden">
            <span>
              Past events
              {groupedEvents.needsFeedback.length > 0 ? (
                <span className="ml-2 rounded-full bg-[color:var(--accent-soft)] px-2.5 py-1 text-xs font-semibold text-[color:var(--accent-strong)]">
                  {groupedEvents.needsFeedback.length} feedback due
                </span>
              ) : null}
            </span>
            <span className="text-xs uppercase tracking-[0.14em] text-[color:var(--text-muted)] group-open:hidden">
              Show
            </span>
            <span className="hidden text-xs uppercase tracking-[0.14em] text-[color:var(--text-muted)] group-open:inline">
              Hide
            </span>
          </summary>
          <div className="mt-5 grid gap-5">
            {groupedEvents.past.map((event) => (
              <EventCard
                detailHref={`/events/${event.id}`}
                event={event}
                eventActionLoadingId={eventActionLoadingId}
                key={event.id}
                onSetEventSignup={(action) => void handleEventSignup(event.id, action)}
              />
            ))}
          </div>
        </details>
      ) : null}
    </AppShell>
  )
}
