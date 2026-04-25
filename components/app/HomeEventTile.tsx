import Link from 'next/link'

import { GooglePlacePhoto } from '@/components/app/GooglePlacePhoto'
import { MatchScoreBadge } from '@/components/app/MatchScoreBadge'
import type { DashboardEvent } from '@/lib/app/types'

const EVENT_IMAGES = [
  'https://lh3.googleusercontent.com/aida-public/AB6AXuDqYWhd6CM0ja06fxxtGnrn-4gj2rJVjMEzPPAOzzyCNV05xUzS1i0rvjhfOFFbDniolswf3SLzB7QetHgaiH8UN9QWWN9wmtAnwLlXKLA2r-JGAr9DXLUN-FwLD_RiJcXVM8D0wwVokUfryW29TwmiZGmwJbLav9xiQSoHnGMiTPx3CQC82QPicuBDljcSBEJPOmDGwE3pEa-c6p5KFZkmbQ0V6U4AOygft8A2_Y1D6E4jUv1JcwVw_CFF9Mc9czMgDYSC7zoADxFy',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuAqL25hEDVJv9pN6Zjs2G2TZpmVWjMIFv-OpmSYKCvu0eyrh3F9GhwQk9ZaWR2q7OlehbXZMd2CrViUaNbHp4wL3RnOThQf28i4tcy4QFtSiddzWQNTpcV6j3Pct_FxUjVjSuGeUile0FLHm17i2yNXaMj9z74GrLizBt7x3SNmO1mwugeE6Wl5u7G_Dgj37zhoULyZUeFJFsXvdx2JayLb22Co6BZzBvR70FXOf0ggxi2hGt_S0JMVwEc4cBWONW_uMA8xEJN8ru8B',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuCygTik5ExFv6d7QT2oGaLcpDJDr8C4Tte6UAOHLM8J9XSVspf3cV2m9S5-nQp9zTL50-_IUuNNTBCkkDHmWn8tTh-dEqVQsfnWqcW_AoOPIaBF8nset8-4AYSeqnpZ9lpsDXDSnBmU2DTWyIs3R7K8GShwB9wJew46FIsu7_S68vJaX70JM_yIrO0DnN7moy8nH6WuMW8IwZAVI83ZVGXZKoBxDeJrmmgAE1kzube4go9GkuP2XlEHgfEzTspjq0vlUt8xRBJyARE1',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuCxNfyXjpd5uXbtI5ZwNkfFjXFXvmQ7j2g_YUjKIEmetFmNaMFFqHcBniBnsT17KEBNJa4VNYO9VaQHJCr7SA2WqF0p0AP3uAJqq3AVBdqra9EkmMxwFVsxcACH2dlTC2xTVssN_zHAXQN05iisrUID5xsa8M-o4IyRlhWHPKslpQ1f0LPR0SvjqNavrPIxTf_GNplbRltlI_sEYTtCUrzlxMymtLdIxGCZaC3d1wi4v3RnRJ8Zyq9bbwpNK-0zVNZz8F0zlJ0rlCM3',
] as const

const FALLBACK_AVATARS = ['AL', 'JM', 'RK', 'ST', 'MV', 'PP'] as const

function getEventImage(index: number) {
  return EVENT_IMAGES[index % EVENT_IMAGES.length]
}

function getEventLabel(event: DashboardEvent) {
  if (event.signupStatus === 'going') {
    return 'Your table'
  }

  if (event.spotsLeft === 0) {
    return 'Table full'
  }

  return 'Meetup'
}

function getEventDateBadge(value: string) {
  const date = new Date(value)

  return {
    day: new Intl.DateTimeFormat('en-US', {
      day: '2-digit',
      timeZone: 'America/New_York',
    }).format(date),
    month: new Intl.DateTimeFormat('en-US', {
      month: 'short',
      timeZone: 'America/New_York',
    }).format(date),
  }
}

function formatEventWindow(event: DashboardEvent) {
  const start = new Date(event.starts_at)
  const end = new Date(start.getTime() + event.duration_minutes * 60 * 1000)

  const formatter = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/New_York',
  })

  return `${formatter.format(start)} - ${formatter.format(end)}`
}

function getAttendeeChips(event: DashboardEvent) {
  if (event.attendeePreview.length > 0) {
    const preview = event.attendeePreview.slice(0, 3).map((attendee) =>
      attendee.displayName
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part.charAt(0).toUpperCase())
        .join('')
    )

    const remaining = Math.max(event.attendeeCount - preview.length, 0)
    return { preview, remaining }
  }

  const preview = FALLBACK_AVATARS.slice(0, Math.min(3, Math.max(event.attendeeCount, 2)))
  const remaining = Math.max(event.attendeeCount - preview.length, 0)
  return { preview, remaining }
}

export function HomeEventTile({
  event,
  index,
}: {
  event: DashboardEvent
  index: number
}) {
  const badge = getEventDateBadge(event.starts_at)
  const attendees = getAttendeeChips(event)

  return (
    <Link
      className="group overflow-hidden rounded-2xl border border-[#ece7dc] bg-white shadow-[0_10px_40px_-10px_rgba(113,92,0,0.08)]"
      href={`/events/${event.id}`}
    >
      <div className="relative h-44 overflow-hidden">
        <GooglePlacePhoto
          alt={event.restaurant_name}
          fallbackSrc={getEventImage(index)}
          imageClassName="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          placeId={event.restaurantGooglePlaceId}
        />
        <div className="absolute left-4 top-4 rounded-lg bg-white/90 px-3 py-2 text-center backdrop-blur">
          <span className="block text-xl font-bold leading-none text-[#1a1c1b]">{badge.day}</span>
          <span className="mt-1 block text-[10px] font-semibold uppercase tracking-[0.18em] text-[#715c00]">
            {badge.month}
          </span>
        </div>
      </div>
      <div className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <MatchScoreBadge compact score={event.projectedRestaurantScore} />
          <span className="inline-flex items-center rounded-full bg-[#ffe8ef] px-2.5 py-1 text-[11px] font-semibold tracking-[0.08em] text-[#ab2c5d]">
            {getEventLabel(event)}
          </span>
        </div>
        <h4 className="mt-2 text-xl font-semibold leading-6 text-[#1a1c1b]">{event.title}</h4>
        <div className="mt-3 flex items-center gap-1 text-sm text-[#6c6558]">
          <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
            <path
              d="M12 7v5l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.8"
            />
          </svg>
          <span>{formatEventWindow(event)}</span>
        </div>
        <p className="mt-3 line-clamp-2 text-sm leading-6 text-[#6c6558]">
          {event.personalMatchSummary ?? event.venueMatchSummary}
        </p>
        <div className="mt-4 flex -space-x-2">
          {attendees.preview.map((chip, chipIndex) => (
            <div
              className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-[#bee9ff] text-[10px] font-bold text-[#004d65]"
              key={`${event.id}-${chip}-${chipIndex}`}
            >
              {chip}
            </div>
          ))}
          {attendees.remaining > 0 ? (
            <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-[#84d7fd] text-[10px] font-bold text-[#005d79]">
              +{attendees.remaining}
            </div>
          ) : null}
        </div>
      </div>
    </Link>
  )
}
