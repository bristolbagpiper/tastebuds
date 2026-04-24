'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

import { AppShell } from '@/components/app/AppShell'
import { Button } from '@/components/app/Button'
import { EmptyState } from '@/components/app/EmptyState'
import { PageHeader } from '@/components/app/PageHeader'
import { RestaurantCard } from '@/components/app/RestaurantCard'
import {
  fetchRestaurants,
  getAppBootstrap,
  logout,
  setEventSignup,
  setSavedRestaurant,
} from '@/lib/app/client'
import type { DashboardRestaurant } from '@/lib/app/types'

export default function RestaurantsPage() {
  const router = useRouter()
  const [email, setEmail] = useState<string | null>(null)
  const [restaurants, setRestaurants] = useState<DashboardRestaurant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showSavedOnly, setShowSavedOnly] = useState(false)
  const [restaurantActionLoadingId, setRestaurantActionLoadingId] = useState<number | null>(null)
  const [eventActionLoadingId, setEventActionLoadingId] = useState<number | null>(null)

  useEffect(() => {
    let active = true

    async function loadPage() {
      try {
        const bootstrap = await getAppBootstrap()

        if (!active) {
          return
        }

        const payload = await fetchRestaurants(bootstrap.accessToken)

        if (!active) {
          return
        }

        if (payload.onboardingRequired) {
          router.replace('/onboarding')
          return
        }

        setEmail(bootstrap.email)
        setRestaurants(payload.restaurants ?? [])
        setLoading(false)
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : 'Could not load restaurants.')
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

  async function handleToggleSaved(restaurantId: number, action: 'save' | 'unsave') {
    setError('')
    setRestaurantActionLoadingId(restaurantId)

    try {
      await setSavedRestaurant(restaurantId, action)
      const payload = await fetchRestaurants()
      setRestaurants(payload.restaurants ?? [])
    } catch (nextError) {
      setError(
        nextError instanceof Error ? nextError.message : 'Could not update saved restaurants.'
      )
    } finally {
      setRestaurantActionLoadingId(null)
    }
  }

  async function handleJoinEvent(eventId: number) {
    setError('')
    setEventActionLoadingId(eventId)

    try {
      await setEventSignup(eventId, 'join')
      const payload = await fetchRestaurants()
      setRestaurants(payload.restaurants ?? [])
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not join event.')
    } finally {
      setEventActionLoadingId(null)
    }
  }

  const visibleRestaurants = useMemo(
    () =>
      showSavedOnly
        ? restaurants.filter((restaurant) => restaurant.isSaved)
        : restaurants,
    [restaurants, showSavedOnly]
  )

  if (loading) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-6xl items-center px-8">
        <p className="tb-copy text-sm">Loading restaurants...</p>
      </main>
    )
  }

  return (
    <AppShell currentPath="/restaurants" email={email} onLogout={handleLogout} title="Restaurants">
      <PageHeader
        action={
          <div className="flex gap-2">
            <Button
              onClick={() => setShowSavedOnly(false)}
              size="sm"
              variant={showSavedOnly ? 'secondary' : 'primary'}
            >
              All
            </Button>
            <Button
              onClick={() => setShowSavedOnly(true)}
              size="sm"
              variant={showSavedOnly ? 'primary' : 'secondary'}
            >
              Saved
            </Button>
          </div>
        }
        description="Restaurants picked around your taste, budget and social vibe."
        eyebrow="Restaurants"
        title="Find your next spot"
      />

      {error ? (
        <div className="mt-6 rounded-3xl border border-[color:color-mix(in_srgb,var(--accent)_28%,white)] bg-[color:color-mix(in_srgb,var(--accent)_10%,var(--surface))] p-4 text-sm text-[color:var(--accent-strong)]">
          {error}
        </div>
      ) : null}

      <div className="mt-6 flex items-center justify-between gap-3">
        <p className="tb-copy text-sm">
          {restaurants.filter((restaurant) => restaurant.isSaved).length} saved / {restaurants.length} picked for you
        </p>
        <Button href="/events" variant="secondary">
          Browse events
        </Button>
      </div>

      <div className="mt-6 grid gap-4">
        {visibleRestaurants.length > 0 ? (
          visibleRestaurants.map((restaurant) => (
            <RestaurantCard
              eventLoadingId={eventActionLoadingId}
              key={restaurant.id}
              onJoinEvent={(eventId) => void handleJoinEvent(eventId)}
              onToggleSaved={(restaurantId, action) => void handleToggleSaved(restaurantId, action)}
              restaurant={restaurant}
              saving={restaurantActionLoadingId === restaurant.id}
            />
          ))
        ) : (
          <EmptyState
            action={
              <Button onClick={() => setShowSavedOnly(false)} variant="secondary">
                Show all matches
              </Button>
            }
            description="No restaurants fit this view right now."
            title="Nothing here yet"
          />
        )}
      </div>
    </AppShell>
  )
}
