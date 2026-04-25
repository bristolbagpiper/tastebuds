'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

import { AppShell } from '@/components/app/AppShell'
import { Button } from '@/components/app/Button'
import { EmptyState } from '@/components/app/EmptyState'
import { PageHeader } from '@/components/app/PageHeader'
import { RestaurantCard } from '@/components/app/RestaurantCard'
import { RestaurantDetailsModal } from '@/components/app/RestaurantDetailsModal'
import {
  fetchRestaurants,
  getAppBootstrap,
  logout,
  setSavedRestaurant,
} from '@/lib/app/client'
import type { DashboardRestaurant } from '@/lib/app/types'

export default function RestaurantsPage() {
  const router = useRouter()
  const [restaurants, setRestaurants] = useState<DashboardRestaurant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showSavedOnly, setShowSavedOnly] = useState(false)
  const [selectedRestaurant, setSelectedRestaurant] = useState<DashboardRestaurant | null>(null)
  const [restaurantActionLoadingId, setRestaurantActionLoadingId] = useState<number | null>(null)

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
    <AppShell currentPath="/restaurants" onLogout={handleLogout}>
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
        description="Restaurants ranked by how well they match your taste, budget and social vibe."
        eyebrow="Restaurants"
        title="Places to start from"
      />

      {error ? (
        <div className="rounded-[1.5rem] border border-[#f3d87a] bg-[#fff8dc] p-4 text-sm text-[#715c00]">
          {error}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.75rem] border border-[color:var(--border-soft)] bg-white p-5 shadow-[0_10px_40px_-10px_rgba(113,92,0,0.08)]">
        <p className="tb-copy text-sm">
          {restaurants.filter((restaurant) => restaurant.isSaved).length} saved / {restaurants.length} ranked for you by taste match
        </p>
        <Button href="/events" variant="secondary">
          Browse events
        </Button>
      </div>

      <div className="grid gap-5">
        {visibleRestaurants.length > 0 ? (
          visibleRestaurants.map((restaurant) => (
            <RestaurantCard
              key={restaurant.id}
              onOpenDetails={setSelectedRestaurant}
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

      {selectedRestaurant ? (
        <RestaurantDetailsModal
          onClose={() => setSelectedRestaurant(null)}
          onToggleSaved={(restaurantId, action) => void handleToggleSaved(restaurantId, action)}
          restaurant={
            restaurants.find((restaurant) => restaurant.id === selectedRestaurant.id) ??
            selectedRestaurant
          }
          saving={restaurantActionLoadingId === selectedRestaurant.id}
        />
      ) : null}
    </AppShell>
  )
}
