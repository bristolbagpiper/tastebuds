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
  if (event.signupStatus === 'going') {
    return true
  }

  const placeKey = event.restaurantGooglePlaceId
    ? `place:${event.restaurantGooglePlaceId}`
    : null
  const fallbackKey = `name:${event.restaurant_name.toLowerCase()}::${event.restaurant_subregion.toLowerCase()}`

  return (placeKey !== null && savedRestaurantKeys.has(placeKey)) || savedRestaurantKeys.has(fallbackKey)
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

  const orderedEvents = useMemo(() => {
    const visibleEvents = events.filter((event) => isVisibleEvent(event, savedRestaurantKeys))
    const joinedEvents = visibleEvents.filter(
      (event) => event.signupStatus === 'going'
    )
    const unjoinedEvents = visibleEvents.filter(
      (event) => event.signupStatus !== 'going'
    )

    return [...joinedEvents, ...unjoinedEvents]
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
          {orderedEvents.length > 0
            ? `${orderedEvents.length} live ${orderedEvents.length === 1 ? 'table' : 'tables'} ranked by your match score right now.`
            : 'Save a restaurant first to unlock live tables here.'}
        </p>
      </div>

      <div className="grid gap-5">
        {orderedEvents.length > 0 ? (
          orderedEvents.map((event) => (
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
    </AppShell>
  )
}
