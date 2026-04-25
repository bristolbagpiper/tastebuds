'use client'

/* eslint-disable @next/next/no-img-element */

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

import { AppShell } from '@/components/app/AppShell'
import { Button } from '@/components/app/Button'
import { HomeEventTile } from '@/components/app/HomeEventTile'
import { SavedSpotsMap } from '@/components/app/SavedSpotsMap'
import { SavedRestaurantTile } from '@/components/app/SavedRestaurantTile'
import {
  fetchEvents,
  fetchNotifications,
  fetchRestaurants,
  getAppBootstrap,
  logout,
} from '@/lib/app/client'
import { isProfileComplete } from '@/lib/app/format'
import type { DashboardEvent, DashboardRestaurant, NotificationSummary } from '@/lib/app/types'

const HERO_IMAGE =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuAUde5tCk6qkkIUCGrBtU0O2eqtI3yJCAby_3JYeQG8PVOEa4RS4dbAqYLDna1zTSWNx4TLbixCVbGu9oJMJ4u71yokBhwg01rS4seZMwvTid_N9e3YfaS_AuoJVqKp4Xsrmvv__ilnBm_cpG0obYrqG175I8hA82K1odZ47iXF1uPovUEGJxmZNCztVBuIgmV_-NRZWEns9PriDlew-alB9nyMP8sbwMlZMJyhSre5OiTG7GX7EG_qkRwBffJSopQ9kjLWvHMkp3VE'

export default function DashboardPage() {
  const router = useRouter()
  const [events, setEvents] = useState<DashboardEvent[]>([])
  const [restaurants, setRestaurants] = useState<DashboardRestaurant[]>([])
  const [notifications, setNotifications] = useState<NotificationSummary[]>([])
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [setupError, setSetupError] = useState('')

  async function handleLogout() {
    await logout()
    router.replace('/login')
  }

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

  const savedRestaurants = useMemo(
    () => restaurants.filter((restaurant) => restaurant.isSaved).slice(0, 3),
    [restaurants]
  )

  const savedRestaurantKeys = useMemo(
    () =>
      new Set(
        savedRestaurants.map((restaurant) =>
          restaurant.googlePlaceId
            ? `place:${restaurant.googlePlaceId}`
            : `name:${restaurant.name.toLowerCase()}::${restaurant.subregion.toLowerCase()}`
        )
      ),
    [savedRestaurants]
  )

  const displayEvents = useMemo(
    () =>
      events
        .filter((event) => {
          const placeKey = event.restaurantGooglePlaceId
            ? `place:${event.restaurantGooglePlaceId}`
            : null
          const fallbackKey = `name:${event.restaurant_name.toLowerCase()}::${event.restaurant_subregion.toLowerCase()}`

          return (placeKey !== null && savedRestaurantKeys.has(placeKey)) || savedRestaurantKeys.has(fallbackKey)
        })
        .slice(0, 4),
    [events, savedRestaurantKeys]
  )
  const unreadNotificationCount = notifications.filter((item) => !item.read_at).length
  const activeRestaurantId =
    selectedRestaurantId && savedRestaurants.some((restaurant) => restaurant.id === selectedRestaurantId)
      ? selectedRestaurantId
      : null

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f9f9f7]">
        <div className="mx-auto flex min-h-screen max-w-7xl items-center px-8">
          <p className="text-sm text-[#6c6558]">Loading dashboard...</p>
        </div>
      </main>
    )
  }

  if (setupError) {
    return (
      <AppShell
        currentPath="/dashboard"
        onLogout={handleLogout}
      >
        <div className="mx-auto flex min-h-[50vh] max-w-3xl flex-col justify-center">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-[#6c6558]">Dashboard</p>
          <h1 className="mt-3 text-4xl font-semibold text-[#1a1c1b]">Couldn&apos;t load your dashboard</h1>
          <p className="mt-4 max-w-2xl text-base text-[#6c6558]">{setupError}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button href="/" variant="secondary">
              Back to home
            </Button>
            <Button onClick={() => void handleLogout()}>
              Log out
            </Button>
          </div>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell
      currentPath="/dashboard"
      onLogout={handleLogout}
    >
        <section className="rounded-[2rem] bg-[linear-gradient(135deg,#ffffff_0%,#f4f4f2_100%)] p-6 shadow-[0_10px_40px_-10px_rgba(113,92,0,0.08)] md:p-8 lg:p-10">
          <div className="flex flex-col items-start justify-between gap-8 md:flex-row md:items-center">
            <div className="max-w-xl">
              <h1 className="text-[2.25rem] font-bold leading-[0.95] tracking-[-0.04em] text-[#0f1720] sm:text-[3.25rem]">
                Morning flavors, shared tonight.
              </h1>
              <p className="mt-6 text-lg leading-8 text-[#5b5348]">
                Discover the best spots for your next social outing. From brunch favorites to
                evening hideaways.
              </p>
              <div className="mt-8">
                <Button
                  className="rounded-full border-[#ffd740] bg-[#ffd740] px-8 py-4 text-base font-bold text-[#231b00] shadow-[0_14px_28px_rgba(255,215,64,0.42)] hover:border-[#eac32b] hover:bg-[#eac32b] sm:px-10 sm:py-5 sm:text-lg"
                  href="/restaurants"
                >
                  <span className="mr-2">Find My Night</span>
                  <svg aria-hidden="true" className="h-5 w-5 sm:h-6 sm:w-6" fill="none" viewBox="0 0 24 24">
                    <path
                      d="M5 12h14m-5-5 5 5-5 5"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.8"
                    />
                  </svg>
                </Button>
              </div>
            </div>

            <div className="w-full md:w-[46%]">
              <div className="overflow-hidden rounded-2xl shadow-2xl">
                <img
                  alt="Warm restaurant interior"
                  className="aspect-[16/9] w-full object-cover"
                  src={HERO_IMAGE}
                />
              </div>
            </div>
          </div>
        </section>

        <section className="mt-12">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-[2rem] font-bold leading-none tracking-[-0.03em] text-[#0f1720]">
                Your Saved Spots
              </h2>
              <p className="mt-2 text-sm text-[#6c6558]">The places you&apos;ve been dreaming about.</p>
            </div>
            <Link className="text-sm font-medium text-[#3d8db0] hover:underline" href="/restaurants">
              View all saved
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="space-y-4 lg:col-span-1">
              {savedRestaurants.length > 0 ? (
                savedRestaurants.map((restaurant, index) => (
                  <SavedRestaurantTile
                    active={restaurant.id === activeRestaurantId}
                    index={index}
                    key={restaurant.id}
                    onSelect={() => setSelectedRestaurantId(restaurant.id)}
                    restaurant={restaurant}
                  />
                ))
              ) : (
                <div className="rounded-xl border border-[#ece7dc] bg-white p-5 shadow-[0_10px_40px_-10px_rgba(113,92,0,0.08)]">
                  <h3 className="text-lg font-semibold text-[#131313]">No saved spots yet</h3>
                  <p className="mt-2 text-sm leading-6 text-[#6c6558]">
                    Save a restaurant first and it&apos;ll show up here with its live map pin.
                  </p>
                  <div className="mt-4">
                    <Button className="rounded-full" href="/restaurants">
                      Explore restaurants
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div className="lg:col-span-2">
              {savedRestaurants.length > 0 ? (
                <SavedSpotsMap
                  onSelectRestaurant={setSelectedRestaurantId}
                  restaurants={savedRestaurants}
                  selectedRestaurantId={activeRestaurantId}
                />
              ) : (
                <div className="flex min-h-[400px] flex-col items-center justify-center rounded-3xl border border-[#d8e6e8] bg-[#dce9e8] px-6 text-center">
                  <p className="text-base font-semibold text-[#1a1c1b]">Your saved map will appear here</p>
                  <p className="mt-3 max-w-md text-sm leading-6 text-[#6f8f98]">
                    Keep a shortlist of places you want to try, then use the map to compare them at a glance.
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="mt-2">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-[2rem] font-bold leading-none tracking-[-0.03em] text-[#0f1720]">
                Upcoming Meetups &amp; Events
              </h2>
              <p className="mt-2 text-sm text-[#6c6558]">Don&apos;t just eat, connect.</p>
            </div>
            <Link
              className="rounded-full bg-[#f0f0ed] px-4 py-2 text-sm font-medium text-[#4e4e4e] transition hover:bg-[#e5e5e1]"
              href="/events"
            >
              Calendar View
            </Link>
          </div>

          {displayEvents.length > 0 ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
              {displayEvents.map((event, index) => (
                <HomeEventTile event={event} index={index} key={event.id} />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-[#ece7dc] bg-white p-6 shadow-[0_10px_40px_-10px_rgba(113,92,0,0.08)]">
              <h3 className="text-2xl font-semibold text-[#131313]">
                {savedRestaurants.length > 0 ? 'No events are live yet' : 'Save a restaurant to unlock tables'}
              </h3>
              <p className="mt-3 max-w-2xl text-base leading-7 text-[#6c6558]">
                {savedRestaurants.length > 0
                  ? 'We’ll bring forward the right tables from your saved spots as they go live.'
                  : 'Events only show up here after you save a venue, so the shortlist stays tied to places you actually want.'}
              </p>
            </div>
          )}

          <div className="mt-10 rounded-2xl border border-[#ece7dc] bg-white p-5 shadow-[0_10px_40px_-10px_rgba(113,92,0,0.08)]">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-[#6c6558]">
                  {unreadNotificationCount > 0
                    ? `${unreadNotificationCount} unread update${unreadNotificationCount === 1 ? '' : 's'} in your inbox.`
                    : 'Your inbox is clear right now.'}
                </p>
                <p className="mt-1 text-base text-[#131313]">
                  Check reminders, confirmations and table changes.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button className="rounded-full" href="/notifications" variant="secondary">
                  Open inbox
                </Button>
                <Button className="rounded-full" href="/profile" variant="secondary">
                  Profile
                </Button>
              </div>
            </div>
          </div>
        </section>
    </AppShell>
  )
}
