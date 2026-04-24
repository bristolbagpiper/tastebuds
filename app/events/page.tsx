'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

import { AppShell } from '@/components/app/AppShell'
import { EmptyState } from '@/components/app/EmptyState'
import { EventCard } from '@/components/app/EventCard'
import { PageHeader } from '@/components/app/PageHeader'
import { fetchEvents, getAppBootstrap, logout, setEventSignup } from '@/lib/app/client'
import type { DashboardEvent } from '@/lib/app/types'

export default function EventsPage() {
  const router = useRouter()
  const [email, setEmail] = useState<string | null>(null)
  const [events, setEvents] = useState<DashboardEvent[]>([])
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

        const payload = await fetchEvents(bootstrap.accessToken)

        if (!active) {
          return
        }

        if (payload.onboardingRequired) {
          router.replace('/onboarding')
          return
        }

        setEmail(bootstrap.email)
        setEvents(payload.events ?? [])
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
    const joinedEvents = events.filter(
      (event) => event.signupStatus === 'going' || event.signupStatus === 'waitlisted'
    )
    const unjoinedEvents = events.filter(
      (event) => event.signupStatus !== 'going' && event.signupStatus !== 'waitlisted'
    )

    return [...joinedEvents, ...unjoinedEvents]
  }, [events])

  if (loading) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-6xl items-center px-8">
        <p className="tb-copy text-sm">Loading events...</p>
      </main>
    )
  }

  return (
    <AppShell currentPath="/events" email={email} onLogout={handleLogout} title="Events">
      <PageHeader
        description="Small dinners with people you are likely to get on with."
        eyebrow="Events"
        title="Live tables"
      />

      {error ? (
        <div className="mt-6 rounded-3xl border border-[color:color-mix(in_srgb,var(--accent)_28%,white)] bg-[color:color-mix(in_srgb,var(--accent)_10%,var(--surface))] p-4 text-sm text-[color:var(--accent-strong)]">
          {error}
        </div>
      ) : null}

      <div className="mt-6 grid gap-4">
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
            description="No events are live yet."
            title="Nothing live right now"
          />
        )}
      </div>
    </AppShell>
  )
}
