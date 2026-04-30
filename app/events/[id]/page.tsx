'use client'

import { useParams, useRouter } from 'next/navigation'
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
  setDayOfConfirmation,
  setEventSignup,
  submitFeedback,
} from '@/lib/app/client'
import { toFeedbackDraft } from '@/lib/app/format'
import type { DashboardEvent, DashboardRestaurant, FeedbackDraft } from '@/lib/app/types'

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

export default function EventDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const eventId = Number(params.id)
  const [allEvents, setAllEvents] = useState<DashboardEvent[]>([])
  const [event, setEvent] = useState<DashboardEvent | null>(null)
  const [feedbackDraft, setFeedbackDraft] = useState<FeedbackDraft | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [eventActionLoadingId, setEventActionLoadingId] = useState<number | null>(null)
  const [feedbackSavingId, setFeedbackSavingId] = useState<number | null>(null)

  async function reloadEvent() {
    const bootstrap = await getAppBootstrap()
    const [eventsPayload, restaurantsPayload] = await Promise.all([
      fetchEvents(bootstrap.accessToken),
      fetchRestaurants(bootstrap.accessToken),
    ])
    const savedRestaurantKeys = getSavedRestaurantKeys(restaurantsPayload.restaurants ?? [])
    const visibleEvents = (eventsPayload.events ?? []).filter((item) => isVisibleEvent(item, savedRestaurantKeys))
    setAllEvents(visibleEvents)
    const nextEvent = visibleEvents.find((item) => item.id === eventId) ?? null
    setEvent(nextEvent)
    setFeedbackDraft(nextEvent ? toFeedbackDraft(nextEvent) : null)
  }

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

        const savedRestaurantKeys = getSavedRestaurantKeys(restaurantsPayload.restaurants ?? [])
        const visibleEvents = (eventsPayload.events ?? []).filter((item) => isVisibleEvent(item, savedRestaurantKeys))
        const nextEvent = visibleEvents.find((item) => item.id === eventId) ?? null
        setAllEvents(visibleEvents)
        setEvent(nextEvent)
        setFeedbackDraft(nextEvent ? toFeedbackDraft(nextEvent) : null)
        setLoading(false)
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : 'Could not load event.')
        setLoading(false)
      }
    }

    if (!Number.isFinite(eventId)) {
      setError('Invalid event id.')
      setLoading(false)
      return
    }

    void loadPage()

    return () => {
      active = false
    }
  }, [eventId, router])

  const similarEvents = useMemo(() => {
    if (!event) {
      return []
    }

    return allEvents
      .filter(
        (candidate) =>
          candidate.id !== event.id &&
          candidate.status === 'open' &&
          candidate.spotsLeft > 0 &&
          !candidate.isJoined
      )
      .sort((left, right) => {
        const leftCuisineMatch =
          left.restaurant_cuisines?.[0] &&
          event.restaurant_cuisines?.includes(left.restaurant_cuisines[0])
            ? 1
            : 0
        const rightCuisineMatch =
          right.restaurant_cuisines?.[0] &&
          event.restaurant_cuisines?.includes(right.restaurant_cuisines[0])
            ? 1
            : 0

        if (rightCuisineMatch !== leftCuisineMatch) {
          return rightCuisineMatch - leftCuisineMatch
        }

        const leftAreaMatch = left.restaurant_subregion === event.restaurant_subregion ? 1 : 0
        const rightAreaMatch = right.restaurant_subregion === event.restaurant_subregion ? 1 : 0

        if (rightAreaMatch !== leftAreaMatch) {
          return rightAreaMatch - leftAreaMatch
        }

        if (right.projectedRestaurantScore !== left.projectedRestaurantScore) {
          return right.projectedRestaurantScore - left.projectedRestaurantScore
        }

        return left.starts_at.localeCompare(right.starts_at)
      })
      .slice(0, 3)
  }, [allEvents, event])

  async function handleLogout() {
    await logout()
    router.replace('/login')
  }

  async function handleEventSignup(action: 'join' | 'leave') {
    if (!event) {
      return
    }

    setError('')
    setEventActionLoadingId(event.id)

    try {
      await setEventSignup(event.id, action)
      await reloadEvent()
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not update your event signup.')
    } finally {
      setEventActionLoadingId(null)
    }
  }

  async function handleDayOfConfirmation(action: 'confirm' | 'decline') {
    if (!event) {
      return
    }

    setError('')
    setEventActionLoadingId(event.id)

    try {
      await setDayOfConfirmation(event.id, action)
      await reloadEvent()
    } catch (nextError) {
      setError(
        nextError instanceof Error ? nextError.message : 'Could not update same-day confirmation.'
      )
    } finally {
      setEventActionLoadingId(null)
    }
  }

  async function handleFeedbackSubmit() {
    if (!event || !feedbackDraft) {
      return
    }

    setError('')
    setFeedbackSavingId(event.id)

    try {
      await submitFeedback({
        eventId: event.id,
        groupRating: Number(feedbackDraft.groupRating),
        notes: feedbackDraft.notes,
        venueRating: Number(feedbackDraft.venueRating),
        wouldJoinAgain: feedbackDraft.wouldJoinAgain === 'yes',
      })
      await reloadEvent()
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not save feedback.')
    } finally {
      setFeedbackSavingId(null)
    }
  }

  if (loading) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-6xl items-center px-8">
        <p className="tb-copy text-sm">Loading event...</p>
      </main>
    )
  }

  return (
    <AppShell currentPath="/events" onLogout={handleLogout}>
      <PageHeader
        action={
          <Button href="/events" variant="secondary">
            Back to events
          </Button>
        }
        description="Everything you need before, during and after the dinner."
        eyebrow="Events"
        title={event?.title ?? 'Table details'}
      />

      {error ? (
        <div className="rounded-[1.5rem] border border-[color:var(--accent-border)] bg-[color:var(--accent-softer)] p-4 text-sm text-[color:var(--accent-strong)]">
          {error}
        </div>
      ) : null}

      <div>
        {event && feedbackDraft ? (
          <EventCard
            event={event}
            eventActionLoadingId={eventActionLoadingId}
            feedbackDraft={feedbackDraft}
            feedbackSavingId={feedbackSavingId}
            onFeedbackDraftChange={setFeedbackDraft}
            onSetDayOfConfirmation={(action) => void handleDayOfConfirmation(action)}
            onSetEventSignup={(action) => void handleEventSignup(action)}
            onSubmitFeedback={() => void handleFeedbackSubmit()}
            similarEvents={similarEvents}
            showDetails
          />
        ) : (
          <EmptyState
            action={
              <Button href="/events" variant="secondary">
                Back to events
              </Button>
            }
            description="Save the venue first or join from a saved-venue table to open the full event details."
            title="This table is not available here"
          />
        )}
      </div>
    </AppShell>
  )
}
