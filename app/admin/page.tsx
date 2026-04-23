'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { MANHATTAN_SUBREGIONS, parseCuisinePreferenceInput } from '@/lib/events'
import { supabase } from '@/lib/supabase/client'

type EventIntent = 'dating' | 'friendship'

type AdminEvent = {
  attendeeCount: number
  capacity: number
  created_at: string
  description: string | null
  id: number
  intent: EventIntent
  restaurant_cuisines: string[]
  restaurant_name: string
  restaurant_neighbourhood: string | null
  restaurant_subregion: string
  starts_at: string
  status: 'open' | 'closed' | 'cancelled'
  title: string
}

type EmailRetryResult = {
  failed: number
  processed: number
  sent: number
  skipped: number
}

function toLocalDateTimeInputValue(date: Date) {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  const hours = `${date.getHours()}`.padStart(2, '0')
  const minutes = `${date.getMinutes()}`.padStart(2, '0')

  return `${year}-${month}-${day}T${hours}:${minutes}`
}

function formatEventDate(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'America/New_York',
  }).format(new Date(value))
}

export default function AdminPage() {
  const router = useRouter()
  const [email, setEmail] = useState<string | null>(null)
  const [events, setEvents] = useState<AdminEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [retryingEmails, setRetryingEmails] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [emailResult, setEmailResult] = useState<EmailRetryResult | null>(null)

  const [title, setTitle] = useState('')
  const [intent, setIntent] = useState<EventIntent>('dating')
  const [startsAt, setStartsAt] = useState(
    toLocalDateTimeInputValue(new Date(Date.now() + 48 * 60 * 60 * 1000))
  )
  const [restaurantName, setRestaurantName] = useState('')
  const [restaurantSubregion, setRestaurantSubregion] =
    useState<(typeof MANHATTAN_SUBREGIONS)[number]>('Midtown')
  const [restaurantNeighbourhood, setRestaurantNeighbourhood] = useState('')
  const [restaurantCuisines, setRestaurantCuisines] = useState('')
  const [capacity, setCapacity] = useState('12')
  const [description, setDescription] = useState('')

  useEffect(() => {
    let active = true

    async function loadAdmin() {
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

      setEmail(user.email ?? null)

      const {
        data: { session },
      } = await supabase.auth.getSession()
      const accessToken = session?.access_token

      if (!accessToken) {
        setError('Missing active session. Log in again.')
        setLoading(false)
        return
      }

      const response = await fetch('/api/admin/events', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      const payload = (await response.json()) as {
        error?: string
        events?: AdminEvent[]
      }

      if (!active) {
        return
      }

      if (!response.ok || payload.error) {
        setError(payload.error ?? 'Could not load admin events.')
        setLoading(false)
        return
      }

      setEvents(payload.events ?? [])
      setLoading(false)
    }

    void loadAdmin()

    return () => {
      active = false
    }
  }, [router])

  async function refreshEvents() {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    const accessToken = session?.access_token

    if (!accessToken) {
      setError('Missing active session. Log in again.')
      return
    }

    const response = await fetch('/api/admin/events', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    const payload = (await response.json()) as {
      error?: string
      events?: AdminEvent[]
    }

    if (!response.ok || payload.error) {
      setError(payload.error ?? 'Could not refresh admin events.')
      return
    }

    setEvents(payload.events ?? [])
  }

  async function createEvent(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSuccess('')
    setSubmitting(true)
    setEmailResult(null)

    const {
      data: { session },
    } = await supabase.auth.getSession()
    const accessToken = session?.access_token

    if (!accessToken) {
      setError('Missing active session. Log in again.')
      setSubmitting(false)
      return
    }

    const response = await fetch('/api/admin/events', {
      body: JSON.stringify({
        capacity: Number(capacity),
        description,
        intent,
        restaurantCuisines: parseCuisinePreferenceInput(restaurantCuisines),
        restaurantName,
        restaurantNeighbourhood,
        restaurantSubregion,
        startsAt: new Date(startsAt).toISOString(),
        title,
      }),
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      method: 'POST',
    })

    const payload = (await response.json()) as {
      error?: string
      event?: AdminEvent
    }

    if (!response.ok || payload.error || !payload.event) {
      setError(payload.error ?? 'Failed to create event.')
      setSubmitting(false)
      return
    }

    setSuccess('Event created.')
    setSubmitting(false)
    setTitle('')
    setRestaurantName('')
    setRestaurantNeighbourhood('')
    setRestaurantCuisines('')
    setDescription('')
    setCapacity('12')
    setStartsAt(toLocalDateTimeInputValue(new Date(Date.now() + 48 * 60 * 60 * 1000)))
    setIntent('dating')
    setRestaurantSubregion('Midtown')
    await refreshEvents()
  }

  async function retryFailedEmails() {
    setRetryingEmails(true)
    setEmailResult(null)
    setError('')

    const {
      data: { session },
    } = await supabase.auth.getSession()
    const accessToken = session?.access_token

    if (!accessToken) {
      setError('Missing active session. Log in again.')
      setRetryingEmails(false)
      return
    }

    const response = await fetch('/api/send-notification-emails', {
      body: JSON.stringify({ limit: 40 }),
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      method: 'POST',
    })

    const payload = (await response.json()) as {
      error?: string
      failed?: number
      processed?: number
      sent?: number
      skipped?: number
    }

    if (!response.ok || payload.error) {
      setError(payload.error ?? 'Failed to retry notification emails.')
      setRetryingEmails(false)
      return
    }

    setEmailResult({
      failed: payload.failed ?? 0,
      processed: payload.processed ?? 0,
      sent: payload.sent ?? 0,
      skipped: payload.skipped ?? 0,
    })
    setRetryingEmails(false)
  }

  if (loading) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-6xl items-center px-8">
        <p className="text-sm text-zinc-600">Loading admin tools...</p>
      </main>
    )
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-8 py-14">
      <p className="text-sm font-medium uppercase tracking-[0.2em] text-zinc-500">
        Admin
      </p>
      <h1 className="mt-3 text-4xl font-semibold text-zinc-950">
        Create restaurant events
      </h1>
      <p className="mt-4 max-w-3xl text-base text-zinc-600">
        Logged in as <span className="font-medium text-zinc-950">{email}</span>.
        Matching rounds are retired. Admins now create explicit events and users
        opt in directly.
      </p>

      {error ? (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          {success}
        </div>
      ) : null}

      {emailResult ? (
        <div className="mt-6 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
          Email retry processed {emailResult.processed}: sent {emailResult.sent},
          failed {emailResult.failed}, skipped {emailResult.skipped}.
        </div>
      ) : null}

      <section className="mt-8 rounded-[1.75rem] border border-zinc-200 bg-zinc-50 p-6">
        <h2 className="text-xl font-semibold text-zinc-950">New event</h2>
        <form className="mt-5 grid gap-4 sm:grid-cols-2" onSubmit={createEvent}>
          <label className="space-y-2 sm:col-span-2">
            <span className="text-sm font-medium text-zinc-700">Event title</span>
            <input
              className="w-full rounded-xl border border-zinc-300 px-4 py-3 outline-none transition focus:border-zinc-950"
              onChange={(nextEvent) => setTitle(nextEvent.target.value)}
              placeholder="Wednesday West Village Supper Club"
              required
              value={title}
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-zinc-700">Intent</span>
            <select
              className="w-full rounded-xl border border-zinc-300 px-4 py-3 outline-none transition focus:border-zinc-950"
              onChange={(nextEvent) =>
                setIntent(nextEvent.target.value as EventIntent)
              }
              value={intent}
            >
              <option value="dating">Dating</option>
              <option value="friendship">Friendship</option>
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-zinc-700">Starts at</span>
            <input
              className="w-full rounded-xl border border-zinc-300 px-4 py-3 outline-none transition focus:border-zinc-950"
              onChange={(nextEvent) => setStartsAt(nextEvent.target.value)}
              required
              type="datetime-local"
              value={startsAt}
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-zinc-700">
              Restaurant name
            </span>
            <input
              className="w-full rounded-xl border border-zinc-300 px-4 py-3 outline-none transition focus:border-zinc-950"
              onChange={(nextEvent) => setRestaurantName(nextEvent.target.value)}
              placeholder="L'Artusi"
              required
              value={restaurantName}
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-zinc-700">Subregion</span>
            <select
              className="w-full rounded-xl border border-zinc-300 px-4 py-3 outline-none transition focus:border-zinc-950"
              onChange={(nextEvent) =>
                setRestaurantSubregion(
                  nextEvent.target.value as (typeof MANHATTAN_SUBREGIONS)[number]
                )
              }
              value={restaurantSubregion}
            >
              {MANHATTAN_SUBREGIONS.map((subregion) => (
                <option key={subregion} value={subregion}>
                  {subregion}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-zinc-700">
              Neighbourhood
            </span>
            <input
              className="w-full rounded-xl border border-zinc-300 px-4 py-3 outline-none transition focus:border-zinc-950"
              onChange={(nextEvent) =>
                setRestaurantNeighbourhood(nextEvent.target.value)
              }
              placeholder="West Village"
              value={restaurantNeighbourhood}
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-zinc-700">Capacity</span>
            <input
              className="w-full rounded-xl border border-zinc-300 px-4 py-3 outline-none transition focus:border-zinc-950"
              min={2}
              onChange={(nextEvent) => setCapacity(nextEvent.target.value)}
              required
              type="number"
              value={capacity}
            />
          </label>

          <label className="space-y-2 sm:col-span-2">
            <span className="text-sm font-medium text-zinc-700">Cuisine tags</span>
            <input
              className="w-full rounded-xl border border-zinc-300 px-4 py-3 outline-none transition focus:border-zinc-950"
              onChange={(nextEvent) => setRestaurantCuisines(nextEvent.target.value)}
              placeholder="Italian, Pasta, Wine bar"
              value={restaurantCuisines}
            />
          </label>

          <label className="space-y-2 sm:col-span-2">
            <span className="text-sm font-medium text-zinc-700">Description</span>
            <textarea
              className="min-h-24 w-full rounded-xl border border-zinc-300 px-4 py-3 outline-none transition focus:border-zinc-950"
              onChange={(nextEvent) => setDescription(nextEvent.target.value)}
              placeholder="Optional context shown on the dashboard."
              value={description}
            />
          </label>

          <div className="flex flex-wrap gap-3 sm:col-span-2">
            <button
              className="rounded-xl bg-zinc-950 px-5 py-3 font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
              disabled={submitting}
              type="submit"
            >
              {submitting ? 'Creating event...' : 'Create event'}
            </button>
            <button
              className="rounded-xl border border-zinc-950 px-5 py-3 font-medium text-zinc-950 transition hover:bg-zinc-950 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-300 disabled:text-zinc-400"
              disabled={retryingEmails}
              onClick={() => void retryFailedEmails()}
              type="button"
            >
              {retryingEmails ? 'Retrying emails...' : 'Retry failed emails'}
            </button>
          </div>
        </form>
      </section>

      <section className="mt-8">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-zinc-500">
          Upcoming events
        </p>
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
                      {event.intent}
                    </p>
                    <h3 className="mt-2 text-2xl font-semibold text-zinc-950">
                      {event.title}
                    </h3>
                    <p className="mt-2 text-sm text-zinc-700">
                      {event.restaurant_name} · {event.restaurant_subregion}
                      {event.restaurant_neighbourhood
                        ? `, ${event.restaurant_neighbourhood}`
                        : ''}
                    </p>
                    <p className="mt-1 text-sm text-zinc-700">
                      {formatEventDate(event.starts_at)}
                    </p>
                    {event.restaurant_cuisines?.length ? (
                      <p className="mt-1 text-sm text-zinc-600">
                        {event.restaurant_cuisines.join(', ')}
                      </p>
                    ) : null}
                  </div>
                  <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700">
                    <p>
                      Attendees:{' '}
                      <span className="font-medium text-zinc-950">
                        {event.attendeeCount}/{event.capacity}
                      </span>
                    </p>
                    <p className="mt-1">
                      Status:{' '}
                      <span className="font-medium text-zinc-950">{event.status}</span>
                    </p>
                  </div>
                </div>
                {event.description ? (
                  <p className="mt-4 text-sm leading-7 text-zinc-600">
                    {event.description}
                  </p>
                ) : null}
              </article>
            ))
          ) : (
            <div className="rounded-[1.5rem] border border-zinc-200 bg-zinc-50 p-6 text-sm text-zinc-600">
              No events yet. Create one to let users self-enroll.
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
