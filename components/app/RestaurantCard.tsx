import Link from 'next/link'

import { Button } from '@/components/app/Button'
import { MatchScoreBadge } from '@/components/app/MatchScoreBadge'
import { TasteTag } from '@/components/app/TasteTag'
import { formatEventDate, formatViabilityStatus } from '@/lib/app/format'
import type { DashboardRestaurant } from '@/lib/app/types'

function renderTags(label: string, values: string[] | null | undefined) {
  if (!values?.length) {
    return null
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="tb-label text-sm">{label}</span>
      {values.map((value) => (
        <TasteTag key={`${label}-${value}`}>{value}</TasteTag>
      ))}
    </div>
  )
}

export function RestaurantCard({
  eventLoadingId,
  onJoinEvent,
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
  return (
    <article className="tb-panel-soft rounded-3xl p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <div className="flex flex-wrap items-center gap-3">
            <MatchScoreBadge score={restaurant.matchScore} />
            {restaurant.isSaved ? (
              <span className="rounded-full border border-[color:var(--border-soft)] bg-[color:var(--surface)] px-3 py-1 text-sm font-medium text-[color:var(--text-muted)]">
                Saved
              </span>
            ) : null}
          </div>
          <h2 className="mt-3 text-2xl font-semibold text-[color:var(--foreground)]">
            {restaurant.name}
          </h2>
          <p className="tb-copy mt-2 text-sm">
            {restaurant.subregion}
            {restaurant.neighbourhood ? `, ${restaurant.neighbourhood}` : ''}
          </p>
          {restaurant.formattedAddress ? (
            <p className="tb-copy mt-1 text-sm">{restaurant.formattedAddress}</p>
          ) : null}
          {restaurant.googleRating !== null ? (
            <p className="tb-copy mt-1 text-sm">
              Google rating {restaurant.googleRating} ({restaurant.googleUserRatingsTotal ?? 0}{' '}
              reviews)
            </p>
          ) : null}
          {restaurant.venueDistanceKm !== null ? (
            <p className="tb-copy mt-1 text-sm">
              Approx {restaurant.venueDistanceKm} km from your anchor
            </p>
          ) : null}
        </div>
        <div className="tb-panel rounded-3xl px-4 py-3 text-sm text-[color:var(--text-muted)]">
          <p>
            Energy:{' '}
            <span className="font-medium text-[color:var(--foreground)]">
              {restaurant.venue_energy ?? '--'}
            </span>
          </p>
          <p>
            Price:{' '}
            <span className="font-medium text-[color:var(--foreground)]">
              {restaurant.venue_price ?? '--'}
            </span>
          </p>
          <p>
            Events:{' '}
            <span className="font-medium text-[color:var(--foreground)]">
              {restaurant.availableEventCount}
            </span>
          </p>
        </div>
      </div>

      <p className="tb-copy mt-4 text-sm leading-7">{restaurant.venueMatchSummary}</p>

      <div className="mt-4 flex flex-wrap gap-2">
        {renderTags('Scene', restaurant.venue_scene)}
        {renderTags('Crowd', restaurant.venue_crowd)}
        {renderTags('Music', restaurant.venue_music)}
        {renderTags('Setting', restaurant.venue_setting)}
        {restaurant.restaurant_cuisines?.map((value) => (
          <TasteTag key={`cuisine-${value}`}>{value}</TasteTag>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
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
        {restaurant.googleMapsUri ? (
          <Button href={restaurant.googleMapsUri} target="_blank" variant="secondary">
            Open map
          </Button>
        ) : null}
      </div>

      <div className="tb-panel mt-5 rounded-3xl p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-[color:var(--foreground)]">Available events here</p>
          <Link
            className="text-sm font-medium text-[color:var(--text-muted)] hover:text-[color:var(--accent-strong)]"
            href="/events"
          >
            See all events
          </Link>
        </div>
        {restaurant.availableEvents.length > 0 ? (
          <div className="mt-3 space-y-3">
            {restaurant.availableEvents.map((event) => (
              <div
                className="tb-panel-quiet flex flex-wrap items-center justify-between gap-3 rounded-2xl px-3 py-3"
                key={event.id}
              >
                <div>
                  <p className="text-sm font-medium text-[color:var(--foreground)]">{event.title}</p>
                  <p className="tb-copy mt-1 text-xs">{formatEventDate(event.startsAt)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="tb-label text-xs">
                    {formatViabilityStatus(event.viabilityStatus)}
                  </span>
                  {onJoinEvent ? (
                    <Button
                      disabled={eventLoadingId === event.id}
                      onClick={() => onJoinEvent(event.id)}
                      size="sm"
                    >
                      {eventLoadingId === event.id
                        ? 'Updating...'
                        : event.signupStatus === 'going'
                          ? 'Joined'
                          : event.signupStatus === 'waitlisted'
                            ? 'Waitlisted'
                            : 'Join'}
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="tb-copy mt-3 text-sm">
            No active events here yet. That is exactly why restaurant-level saves matter.
          </p>
        )}
      </div>
    </article>
  )
}
