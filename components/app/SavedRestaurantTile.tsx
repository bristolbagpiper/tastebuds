import type { DashboardRestaurant } from '@/lib/app/types'
import { GooglePlacePhoto } from '@/components/app/GooglePlacePhoto'
import { MatchScoreBadge } from '@/components/app/MatchScoreBadge'

const RESTAURANT_IMAGES = [
  'https://lh3.googleusercontent.com/aida-public/AB6AXuDCoHML1D-nS9Lpd8JQsgkHZQy7xiCa4Cx9EeNcbmIe5Kp0jdxofD_dVVn6Ze22xEPoZgJTuKre5B1fsb1Pbbme3gUS-P9eUKSbS3DQQs4TkPqXXH3lEx8hArTWwf3eLo4jmiZBqoc5svsyFDFqKkvvC_rj4reYIojqZPtWbKTLiBugXIwtxa9qGGkVZ1Qvn7lEgs5cvkJpPYEypfeu3_hwcW_FJI1Rnh9Ib_QPpp-r_W-cmqmkxuliA_xVq0jvZHb9l0FtG2aimNlH',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuAslHXH8KjoZPnFH9tLgGOz8rpffzYp31oJCQ03BpWAGdwlFuUFHoISTgdAoZH_NjW-csUz083j3OW2m7Eg3SuZatWjxorJGliozLUIdLQ8c8z6hpL2bj-HYYYYraZ1M28INpoA-BFsk74mlHt5pUxujHqONyF7wwIBG2LeEI48EBwtXkT82xYxLlx3ZfU9xA0fKFD9uG5VwLYImjp2Ds_E_MAAvem_kn52S1La_X3JIpw26-1BtApNmFDKsn5tXXeqRiG9EglOZ9X-',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuANwT_OCTmuJC4naZhU3nuu-_tl7nhx6boXESOu4GLp5ZWE2QupS8HMNQ8yy0ZzGILo9KDGkmYrfwOLwnmf-PZa_KNHdtjFKXI3pdft5g3EDqysljfjWnmqJQWnFOECkd1pt8ssY2BZq9Y5OJu_J9oiPE-ORo3hrHoDFk9xM-r8zFq_WS3azkfo5wzdoYL0xRq9J7_gQ0fi_xMOec9JpOSZFaAFZtm5hw0wQLDQAfNvmSuc06elFW9SCXwRrjWPtLEmFN4LjA5o3yx8',
] as const

function formatRating(restaurant: DashboardRestaurant) {
  if (restaurant.googleRating === null) {
    return null
  }

  const reviews = restaurant.googleUserRatingsTotal
    ? ` (${restaurant.googleUserRatingsTotal} reviews)`
    : ''

  return `${restaurant.googleRating.toFixed(1)}${reviews}`
}

function getRestaurantSubtitle(restaurant: DashboardRestaurant) {
  if (restaurant.googleEditorialSummary) {
    return restaurant.googleEditorialSummary
  }

  if (restaurant.restaurant_cuisines?.[0]) {
    return `${restaurant.restaurant_cuisines[0]} in ${restaurant.subregion}${
      restaurant.neighbourhood ? `, ${restaurant.neighbourhood}` : ''
    }`
  }

  return `Picked around your taste in ${restaurant.subregion}`
}

function getRestaurantImage(index: number) {
  return RESTAURANT_IMAGES[index % RESTAURANT_IMAGES.length]
}

export function SavedRestaurantTile({
  active,
  index,
  onSelect,
  restaurant,
}: {
  active: boolean
  index: number
  onSelect: () => void
  restaurant: DashboardRestaurant
}) {
  return (
    <button
      className={`flex w-full gap-4 rounded-xl border bg-white p-3 text-left shadow-[0_10px_40px_-10px_rgba(113,92,0,0.08)] transition ${
        active
          ? 'border-[#ffd740] ring-2 ring-[#ffeaa0]'
          : 'border-[#ece7dc] hover:translate-x-1'
      }`}
      onClick={onSelect}
      type="button"
    >
      <GooglePlacePhoto
        alt={restaurant.name}
        fallbackSrc={getRestaurantImage(index)}
        imageClassName="h-16 w-16 rounded-lg object-cover"
        placeId={restaurant.googlePlaceId}
      />
      <div className="min-w-0">
        <MatchScoreBadge className="mb-2" compact score={restaurant.matchScore} />
        <h3 className="truncate text-[1.05rem] font-semibold leading-5 text-[#131313]">
          {restaurant.name}
        </h3>
        {formatRating(restaurant) ? (
          <div className="mt-1 flex items-center gap-1 text-[10px] font-medium text-[#d29000]">
            <svg aria-hidden="true" className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24">
              <path d="M12 3.6 14.9 9l5.9.8-4.3 4.2 1 5.8L12 17l-5.5 2.8 1-5.8L3.2 9.8 9.1 9 12 3.6Z" />
            </svg>
            <span>{formatRating(restaurant)}</span>
          </div>
        ) : null}
        <p className="mt-1 line-clamp-2 text-xs leading-4 text-[#6c6558]">
          {getRestaurantSubtitle(restaurant)}
        </p>
        <div className="mt-2">
          <span className="text-[11px] font-medium text-[#3d8db0]">View on map</span>
        </div>
      </div>
    </button>
  )
}
