import Link from 'next/link'

import { Button } from '@/components/app/Button'
import { GooglePlacePhoto } from '@/components/app/GooglePlacePhoto'
import { MatchScoreBadge } from '@/components/app/MatchScoreBadge'
import { TasteTag } from '@/components/app/TasteTag'
import type { DashboardRestaurant } from '@/lib/app/types'

const RESTAURANT_IMAGES = [
  'https://lh3.googleusercontent.com/aida-public/AB6AXuDCoHML1D-nS9Lpd8JQsgkHZQy7xiCa4Cx9EeNcbmIe5Kp0jdxofD_dVVn6Ze22xEPoZgJTuKre5B1fsb1Pbbme3gUS-P9eUKSbS3DQQs4TkPqXXH3lEx8hArTWwf3eLo4jmiZBqoc5svsyFDFqKkvvC_rj4reYIojqZPtWbKTLiBugXIwtxa9qGGkVZ1Qvn7lEgs5cvkJpPYEypfeu3_hwcW_FJI1Rnh9Ib_QPpp-r_W-cmqmkxuliA_xVq0jvZHb9l0FtG2aimNlH',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuAslHXH8KjoZPnFH9tLgGOz8rpffzYp31oJCQ03BpWAGdwlFuUFHoISTgdAoZH_NjW-csUz083j3OW2m7Eg3SuZatWjxorJGliozLUIdLQ8c8z6hpL2bj-HYYYYraZ1M28INpoA-BFsk74mlHt5pUxujHqONyF7wwIBG2LeEI48EBwtXkT82xYxLlx3ZfU9xA0fKFD9uG5VwLYImjp2Ds_E_MAAvem_kn52S1La_X3JIpw26-1BtApNmFDKsn5tXXeqRiG9EglOZ9X-',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuANwT_OCTmuJC4naZhU3nuu-_tl7nhx6boXESOu4GLp5ZWE2QupS8HMNQ8yy0ZzGILo9KDGkmYrfwOLwnmf-PZa_KNHdtjFKXI3pdft5g3EDqysljfjWnmqJQWnFOECkd1pt8ssY2BZq9Y5OJu_J9oiPE-ORo3hrHoDFk9xM-r8zFq_WS3azkfo5wzdoYL0xRq9J7_gQ0fi_xMOec9JpOSZFaAFZtm5hw0wQLDQAfNvmSuc06elFW9SCXwRrjWPtLEmFN4LjA5o3yx8',
] as const

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

function getRestaurantImage(restaurant: DashboardRestaurant) {
  return RESTAURANT_IMAGES[restaurant.id % RESTAURANT_IMAGES.length]
}

export function RestaurantCard({
  onOpenDetails,
  onToggleSaved,
  restaurant,
  saving,
}: {
  onOpenDetails?: (restaurant: DashboardRestaurant) => void
  onToggleSaved?: (restaurantId: number, action: 'save' | 'unsave') => void
  restaurant: DashboardRestaurant
  saving?: boolean
}) {
  const priorityTags = getPriorityTags(restaurant)
  const subtitle = `${restaurant.restaurant_cuisines?.[0] ?? 'Restaurant'} in ${restaurant.subregion}${
    restaurant.neighbourhood ? `, ${restaurant.neighbourhood}` : ''
  }`

  return (
    <article
      className="cursor-pointer overflow-hidden rounded-[2rem] border border-[color:var(--border-soft)] bg-white shadow-[0_10px_40px_-10px_rgba(113,92,0,0.08)] transition hover:shadow-[0_18px_48px_-12px_rgba(113,92,0,0.16)]"
      onClick={() => onOpenDetails?.(restaurant)}
      onKeyDown={(event) => {
        if ((event.key === 'Enter' || event.key === ' ') && onOpenDetails) {
          event.preventDefault()
          onOpenDetails(restaurant)
        }
      }}
      role={onOpenDetails ? 'button' : undefined}
      tabIndex={onOpenDetails ? 0 : undefined}
    >
      <div className="grid gap-0 md:grid-cols-[260px_minmax(0,1fr)]">
        <div className="relative min-h-56 overflow-hidden">
          <GooglePlacePhoto
            alt={restaurant.name}
            attributionClassName="absolute bottom-3 left-3 rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-medium text-white"
            fallbackSrc={getRestaurantImage(restaurant)}
            imageClassName="h-full w-full object-cover"
            placeId={restaurant.googlePlaceId}
          />
          <div className="absolute left-4 top-4 max-w-[220px]">
            <MatchScoreBadge score={restaurant.matchScore} />
          </div>
        </div>

        <div className="p-6 md:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              {restaurant.isSaved ? (
                <span className="rounded-full bg-[color:var(--accent-soft)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--accent-strong)]">
                  Saved
                </span>
              ) : null}
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[color:var(--foreground)]">
                {restaurant.name}
              </h2>
              <p className="mt-2 text-sm text-[color:var(--text-muted)]">{subtitle}</p>
              {restaurant.googleRating !== null ? (
                <p className="mt-2 text-sm text-[color:var(--text-muted)]">
                  {restaurant.googleRating.toFixed(1)}
                  {restaurant.googleUserRatingsTotal
                    ? ` on Google from ${restaurant.googleUserRatingsTotal} reviews`
                    : ' on Google'}
                </p>
              ) : null}
            </div>
          </div>

          <p className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--text-muted)]">
            Why it fits you
          </p>
          <p className="mt-2 max-w-3xl text-base leading-7 text-[color:var(--foreground)]">
            {getMatchReason(restaurant)}
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            {priorityTags.map((value) => (
              <TasteTag key={`${restaurant.id}-${value}`}>{value}</TasteTag>
            ))}
          </div>

          <div
            className="mt-6 flex flex-wrap items-center gap-3"
            onClick={(event) => event.stopPropagation()}
          >
            {onToggleSaved ? (
              <Button
                disabled={saving}
                onClick={(event) => {
                  event.stopPropagation()
                  onToggleSaved(restaurant.id, restaurant.isSaved ? 'unsave' : 'save')
                }}
                variant={restaurant.isSaved ? 'secondary' : 'primary'}
              >
                {saving ? 'Updating...' : restaurant.isSaved ? 'Unsave' : 'Save restaurant'}
              </Button>
            ) : null}
            {onOpenDetails ? (
              <Button
                onClick={(event) => {
                  event.stopPropagation()
                  onOpenDetails(restaurant)
                }}
                variant="secondary"
              >
                Details
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

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--border-soft)] pt-5 text-sm">
            <p className="text-[color:var(--text-muted)]">
              {restaurant.availableEventCount > 0
                ? `${restaurant.availableEventCount} ${restaurant.availableEventCount === 1 ? 'table is' : 'tables are'} live here right now.`
                : 'No events are live here yet.'}
            </p>
            {restaurant.availableEventCount > 0 ? (
              <span onClick={(event) => event.stopPropagation()}>
                <Link
                  className="font-semibold text-[color:var(--link)] hover:underline"
                  href="/events"
                >
                  Browse tables
                </Link>
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  )
}
