'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { AppShell } from '@/components/app/AppShell'
import { Button } from '@/components/app/Button'
import { EmptyState } from '@/components/app/EmptyState'
import { EventCard } from '@/components/app/EventCard'
import { PageHeader } from '@/components/app/PageHeader'
import {
  fetchEvents,
  getAppBootstrap,
  logout,
  setDayOfConfirmation,
  setEventSignup,
  submitFeedback,
} from '@/lib/app/client'
import { toFeedbackDraft } from '@/lib/app/format'
import type { DashboardEvent, FeedbackDraft } from '@/lib/app/types'

export default function EventDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const eventId = Number(params.id)
  const [email, setEmail] = useState<string | null>(null)
  const [event, setEvent] = useState<DashboardEvent | null>(null)
  const [feedbackDraft, setFeedbackDraft] = useState<FeedbackDraft | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [eventActionLoadingId, setEventActionLoadingId] = useState<number | null>(null)
  const [feedbackSavingId, setFeedbackSavingId] = useState<number | null>(null)

  async function reloadEvent() {
    const bootstrap = await getAppBootstrap()
    const payload = await fetchEvents(bootstrap.accessToken)
    const nextEvent = (payload.events ?? []).find((item) => item.id === eventId) ?? null
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

        const payload = await fetchEvents(bootstrap.accessToken)

        if (!active) {
          return
        }

        if (payload.onboardingRequired) {
          router.replace('/onboarding')
          return
        }

        const nextEvent = (payload.events ?? []).find((item) => item.id === eventId) ?? null
        setEmail(bootstrap.email)
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
    <AppShell currentPath="/events" email={email} onLogout={handleLogout} title="Event detail">
      <PageHeader
        action={
          <Button href="/events" variant="secondary">
            Back to events
          </Button>
        }
        description="Detailed event actions live here now, not buried inside a giant dashboard."
        eyebrow="Events"
        title={event?.title ?? 'Event'}
      />

      {error ? (
        <div className="mt-6 rounded-3xl border border-[color:color-mix(in_srgb,var(--accent)_28%,white)] bg-[color:color-mix(in_srgb,var(--accent)_10%,var(--surface))] p-4 text-sm text-[color:var(--accent-strong)]">
          {error}
        </div>
      ) : null}

      <div className="mt-6">
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
            showDetails
          />
        ) : (
          <EmptyState
            action={
              <Button href="/events" variant="secondary">
                Back to events
              </Button>
            }
            description="This event is no longer available from the current API response."
            title="Event not found"
          />
        )}
      </div>
    </AppShell>
  )
}
