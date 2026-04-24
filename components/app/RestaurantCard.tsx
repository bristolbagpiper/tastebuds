import Link from 'next/link'

import { Button } from '@/components/app/Button'
import { MatchScoreBadge } from '@/components/app/MatchScoreBadge'
import { TasteTag } from '@/components/app/TasteTag'
import type { DashboardRestaurant } from '@/lib/app/types'

function getPriorityTags(restaurant: DashboardRestaurant) {
  const tags: string[] = []

  if (restaurant.restaurant_cuisines?.[0]) {
    tags.push(restaurant.restaurant_cuisines[0])
  }

  if (restaurant.venue_price) {
    tags.push(restaurant.venue_price)
  }

  if (restaurant.venue_energy) {
    tags.push(restaurant.venue_energy)
  }

  if (restaurant.venue_scene?.[0]) {
    tags.push(restaurant.venue_scene[0])
  }

  if (restaurant.venue_setting?.[0]) {
    tags.push(restaurant.venue_setting[0])
  }

  return tags.slice(0, 5)
}

function getMatchReason(restaurant: DashboardRestaurant) {
  if (restaurant.venueMatchSummary) {
    return restaurant.venueMatchSummary
  }

  if (restaurant.restaurant_cuisines?.length) {
    return `Picked for ${restaurant.restaurant_cuisines[0].toLowerCase()} food in a setting that fits your night out.`
  }

  return 'Picked around your taste, budget and social vibe.'
}

export function RestaurantCard({
  onToggleSaved,
  restaurant,
  saving,
}: {
  eventLoadingId?: number | null
  onJoinEvent?: (eventId: number) => void
  onToggleSaved?: (restaurantId: number, action: 'save' | 'unsave') => void
  restaurant: DashboardRestaurant
  saving?: boolean
}) {
  const priorityTags = getPriorityTags(restaurant)

  return (
    <article className="tb-panel-soft rounded-[2rem] p-6 shadow-[0_20px_45px_rgba(94,74,60,0.08)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <div className="flex flex-wrap items-center gap-3">
            <MatchScoreBadge score={restaurant.matchScore} />
            {restaurant.isSaved ? (
              <span className="rounded-full border border-[color:var(--border-soft)] bg-[color:rgba(255,255,255,0.7)] px-3 py-1 text-sm font-medium text-[color:var(--text-muted)]">
                Saved
              </span>
            ) : null}
          </div>
          <h2 className="mt-4 text-2xl font-semibold text-[color:var(--foreground)]">
            {restaurant.name}
          </h2>
          <p className="tb-copy mt-2 text-sm">
            {restaurant.restaurant_cuisines?.[0] ?? 'Restaurant'} in {restaurant.subregion}
            {restaurant.neighbourhood ? `, ${restaurant.neighbourhood}` : ''}
          </p>
          {restaurant.googleRating !== null ? (
            <p className="tb-copy mt-1 text-sm">
              Rated {restaurant.googleRating} on Google
              {restaurant.googleUserRatingsTotal
                ? ` from ${restaurant.googleUserRatingsTotal} reviews`
                : ''}
            </p>
          ) : null}
        </div>
      </div>

      <p className="mt-4 text-base leading-7 text-[color:var(--foreground)]">
        {getMatchReason(restaurant)}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {priorityTags.map((value) => (
          <TasteTag key={`${restaurant.id}-${value}`}>{value}</TasteTag>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        {onToggleSaved ? (
          <Button
            disabled={saving}
            onClick={() =>
              onToggleSaved(restaurant.id, restaurant.isSaved ? 'unsave' : 'save')
            }
            variant={restaurant.isSaved ? 'secondary' : 'primary'}
          >
            {saving ? 'Updating...' : restaurant.isSaved ? 'Remove from saved' : 'Save restaurant'}
          </Button>
        ) : null}
        <Button href="/events" variant="secondary">
          See events
        </Button>
        {restaurant.googleMapsUri ? (
          <Button href={restaurant.googleMapsUri} target="_blank" variant="secondary">
            View map
          </Button>
        ) : null}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm">
        <p className="tb-copy">
          {restaurant.availableEventCount > 0
            ? `${restaurant.availableEventCount} live ${restaurant.availableEventCount === 1 ? 'table' : 'tables'} here right now.`
            : 'No events are live here yet.'}
        </p>
        {restaurant.availableEventCount > 0 ? (
          <Link
            className="font-medium text-[color:var(--accent-strong)] hover:text-[color:var(--foreground)]"
            href="/events"
          >
            Browse tables
          </Link>
        ) : null}
      </div>
    </article>
  )
}
