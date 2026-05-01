import type { ReactNode } from 'react'

import { Button } from '@/components/app/Button'
import { GooglePlacePhoto } from '@/components/app/GooglePlacePhoto'
import { MatchScoreBadge } from '@/components/app/MatchScoreBadge'
import { TasteTag } from '@/components/app/TasteTag'
import { formatDayConfirmationStatus, formatEventDate } from '@/lib/app/format'
import type { DashboardEvent, FeedbackDraft } from '@/lib/app/types'

const EVENT_IMAGES = [
  'https://lh3.googleusercontent.com/aida-public/AB6AXuDqYWhd6CM0ja06fxxtGnrn-4gj2rJVjMEzPPAOzzyCNV05xUzS1i0rvjhfOFFbDniolswf3SLzB7QetHgaiH8UN9QWWN9wmtAnwLlXKLA2r-JGAr9DXLUN-FwLD_RiJcXVM8D0wwVokUfryW29TwmiZGmwJbLav9xiQSoHnGMiTPx3CQC82QPicuBDljcSBEJPOmDGwE3pEa-c6p5KFZkmbQ0V6U4AOygft8A2_Y1D6E4jUv1JcwVw_CFF9Mc9czMgDYSC7zoADxFy',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuAqL25hEDVJv9pN6Zjs2G2TZpmVWjMIFv-OpmSYKCvu0eyrh3F9GhwQk9ZaWR2q7OlehbXZMd2CrViUaNbHp4wL3RnOThQf28i4tcy4QFtSiddzWQNTpcV6j3Pct_FxUjVjSuGeUile0FLHm17i2yNXaMj9z74GrLizBt7x3SNmO1mwugeE6Wl5u7G_Dgj37zhoULyZUeFJFsXvdx2JayLb22Co6BZzBvR70FXOf0ggxi2hGt_S0JMVwEc4cBWONW_uMA8xEJN8ru8B',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuCygTik5ExFv6d7QT2oGaLcpDJDr8C4Tte6UAOHLM8J9XSVspf3cV2m9S5-nQp9zTL50-_IUuNNTBCkkDHmWn8tTh-dEqVQsfnWqcW_AoOPIaBF8nset8-4AYSeqnpZ9lpsDXDSnBmU2DTWyIs3R7K8GShwB9wJew46FIsu7_S68vJaX70JM_yIrO0DnN7moy8nH6WuMW8IwZAVI83ZVGXZKoBxDeJrmmgAE1kzube4go9GkuP2XlEHgfEzTspjq0vlUt8xRBJyARE1',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuCxNfyXjpd5uXbtI5ZwNkfFjXFXvmQ7j2g_YUjKIEmetFmNaMFFqHcBniBnsT17KEBNJa4VNYO9VaQHJCr7SA2WqF0p0AP3uAJqq3AVBdqra9EkmMxwFVsxcACH2dlTC2xTVssN_zHAXQN05iisrUID5xsa8M-o4IyRlhWHPKslpQ1f0LPR0SvjqNavrPIxTf_GNplbRltlI_sEYTtCUrzlxMymtLdIxGCZaC3d1wi4v3RnRJ8Zyq9bbwpNK-0zVNZz8F0zlJ0rlCM3',
] as const

function getActionLabel(
  event: DashboardEvent,
  eventActionLoadingId: number | null | undefined
) {
  if (eventActionLoadingId === event.id) {
    return 'Updating...'
  }

  if (event.hasEnded) {
    return 'Event ended'
  }

  if (event.status === 'closed' && !event.isJoined) {
    return 'Signups closed'
  }

  if (event.isJoined) {
    return 'Leave table'
  }

  return event.spotsLeft === 0 ? 'Table full' : 'Join table'
}

function getListTags(event: DashboardEvent) {
  const tags: string[] = []

  if (event.restaurant_cuisines?.[0]) {
    tags.push(event.restaurant_cuisines[0])
  }

  if (event.venue_price) {
    tags.push(event.venue_price)
  }

  if (event.venue_scene?.[0]) {
    tags.push(event.venue_scene[0])
  }

  if (event.venue_energy) {
    tags.push(event.venue_energy)
  }

  return tags.slice(0, 4)
}

function getSeatSummary(event: DashboardEvent) {
  if (event.hasEnded) {
    if (event.feedback.submitted) {
      return 'You left feedback for this table.'
    }

    if (event.canSubmitFeedback) {
      return 'This table has ended. Feedback is still open.'
    }

    return 'This table has ended.'
  }

  if (event.isJoined) {
    return 'You have a seat at this table.'
  }

  if (event.spotsLeft > 0) {
    return `${event.spotsLeft} ${event.spotsLeft === 1 ? 'seat' : 'seats'} left from a group of ${event.capacity}.`
  }

  return `This table is currently full for a group of ${event.capacity}.`
}

function getDetailSeatTitle(event: DashboardEvent) {
  if (event.hasEnded) {
    return 'This table has ended'
  }

  if (event.signupStatus === 'going') {
    return 'You are in'
  }

  return event.spotsLeft === 0 ? 'This table is full' : 'You have not joined yet'
}

function getDetailSeatDescription(event: DashboardEvent) {
  if (event.hasEnded || event.signupStatus !== 'going') {
    return getSeatSummary(event)
  }

  return `Today's reply: ${formatDayConfirmationStatus(event.dayOfConfirmationStatus)}.`
}

function getAtAGlanceSeatSummary(event: DashboardEvent) {
  if (event.hasEnded) {
    return event.feedback.submitted ? 'Feedback submitted' : 'Ended'
  }

  return event.spotsLeft > 0
    ? `${event.spotsLeft} ${event.spotsLeft === 1 ? 'seat' : 'seats'} left`
    : 'Table full'
}

function getShortEventWindow(event: DashboardEvent) {
  const start = new Date(event.starts_at)
  const end = new Date(start.getTime() + event.duration_minutes * 60 * 1000)
  const formatter = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/New_York',
  })
  const endFormatter = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/New_York',
  })

  return `${formatter.format(start)} - ${endFormatter.format(end)}`
}

function getDateBadge(value: string) {
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

function getEventImage(event: DashboardEvent) {
  return EVENT_IMAGES[event.id % EVENT_IMAGES.length] ?? EVENT_IMAGES[0]!
}

function getAttendeeInitials(displayName: string) {
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')

  return initials || '?'
}

function getAttendeePreviewStatus(
  event: DashboardEvent,
  status: DashboardEvent['attendeePreview'][number]['dayOfConfirmationStatus']
) {
  if (!event.needsDayOfConfirmation) {
    return 'Joined'
  }

  switch (status) {
    case 'confirmed':
      return 'Confirmed today'
    case 'declined':
      return 'Unable today'
    case 'pending':
    default:
      return 'Awaiting reply'
  }
}

function DetailPanel({
  children,
  title,
}: {
  children: ReactNode
  title: string
}) {
  return (
    <section className="rounded-[1.75rem] bg-[#f7f5f0] p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--text-muted)]">
        {title}
      </p>
      <div className="mt-3">{children}</div>
    </section>
  )
}

export function EventCard({
  detailHref,
  event,
  eventActionLoadingId,
  feedbackDraft,
  feedbackSavingId,
  onFeedbackDraftChange,
  onSetDayOfConfirmation,
  onSetEventSignup,
  onSubmitFeedback,
  similarEvents = [],
  showDetails = false,
}: {
  detailHref?: string
  event: DashboardEvent
  eventActionLoadingId?: number | null
  feedbackDraft?: FeedbackDraft
  feedbackSavingId?: number | null
  onFeedbackDraftChange?: (draft: FeedbackDraft) => void
  onSetDayOfConfirmation?: (action: 'confirm' | 'decline') => void
  onSetEventSignup?: (action: 'join' | 'leave') => void
  onSubmitFeedback?: () => void
  similarEvents?: DashboardEvent[]
  showDetails?: boolean
}) {
  const listTags = getListTags(event)
  const badge = getDateBadge(event.starts_at)
  const detailBody = event.description?.trim() || 'Small dinners with people you are likely to get on with.'
  const matchSummary = event.personalMatchSummary ?? event.venueMatchSummary

  return (
    <article className={`overflow-hidden rounded-[2rem] border bg-white shadow-[0_10px_40px_-10px_rgba(113,92,0,0.08)] ${event.hasEnded ? 'border-[color:var(--accent-border)] opacity-90' : 'border-[color:var(--border-soft)]'}`}>
      <div className={showDetails ? '' : 'grid gap-0 lg:grid-cols-[300px_minmax(0,1fr)]'}>
        <div className={showDetails ? 'relative h-72 overflow-hidden sm:h-80' : 'relative min-h-64 overflow-hidden'}>
          <GooglePlacePhoto
            alt={event.restaurant_name}
            attributionClassName="absolute bottom-3 left-3 rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-medium text-white"
            fallbackSrc={getEventImage(event)}
            imageClassName="h-full w-full object-cover"
            placeId={event.restaurantGooglePlaceId}
          />
          <div className="absolute left-4 top-4 rounded-lg bg-white/90 px-3 py-2 text-center backdrop-blur">
            <span className="block text-xl font-bold leading-none text-[#1a1c1b]">{badge.day}</span>
            <span className="mt-1 block text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--accent-strong)]">
              {badge.month}
            </span>
          </div>
        </div>

        <div className="p-6 md:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <div className="flex flex-wrap items-start gap-3">
                <MatchScoreBadge
                  className={showDetails ? 'min-w-[190px]' : undefined}
                  compact={!showDetails}
                  score={event.projectedRestaurantScore}
                />
                {event.signupStatus === 'going' ? (
                  <span className="rounded-full bg-[color:var(--accent-soft)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--accent-strong)]">
                    Joined
                  </span>
                ) : null}
                {event.hasEnded ? (
                  <span className="rounded-full bg-[#efe9dc] px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--text-muted)]">
                    Ended
                  </span>
                ) : null}
                {event.canSubmitFeedback && !event.feedback.submitted ? (
                  <span className="rounded-full bg-[color:var(--accent-soft)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--accent-strong)]">
                    Feedback due
                  </span>
                ) : null}
              </div>

              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-[color:var(--foreground)]">
                {event.title}
              </h2>
              <p className="mt-2 text-sm font-medium text-[color:var(--foreground)]">
                {event.restaurant_name} / {event.restaurant_subregion}
                {event.restaurant_neighbourhood ? `, ${event.restaurant_neighbourhood}` : ''}
              </p>
              <p className="mt-2 text-sm text-[color:var(--text-muted)]">{getShortEventWindow(event)}</p>
              <p className="mt-2 text-sm text-[color:var(--text-muted)]">{getSeatSummary(event)}</p>
              {showDetails ? (
                <p className="mt-5 max-w-3xl text-base leading-7 text-[color:var(--foreground)]">
                  {detailBody}
                </p>
              ) : null}
            </div>
          </div>

          {!showDetails ? (
            <div className="mt-5 max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--text-muted)]">
                Why it fits you
              </p>
              <p className="mt-2 text-base leading-7 text-[color:var(--foreground)]">{matchSummary}</p>
              <p className="mt-4 text-base leading-7 text-[color:var(--foreground)]">{detailBody}</p>
            </div>
          ) : null}

          <div className="mt-5 flex flex-wrap gap-2">
            {listTags.map((value) => (
              <TasteTag key={`${event.id}-${value}`}>{value}</TasteTag>
            ))}
          </div>

          {!showDetails && detailHref ? (
            <div className="mt-6 flex flex-wrap gap-3">
              {onSetEventSignup ? (
                <Button
                  disabled={
                    eventActionLoadingId === event.id ||
                    event.hasEnded ||
                    (!event.isJoined && (event.status !== 'open' || event.spotsLeft === 0))
                  }
                  onClick={() =>
                    onSetEventSignup(event.isJoined ? 'leave' : 'join')
                  }
                  variant={event.isJoined ? 'secondary' : 'primary'}
                >
                  {getActionLabel(event, eventActionLoadingId)}
                </Button>
              ) : null}
              <Button href={detailHref} variant="secondary">
                See details
              </Button>
            </div>
          ) : null}

          {showDetails ? (
            <>
              <section className="mt-8 grid gap-4 lg:grid-cols-2">
                <DetailPanel title="Why this fits you">
                  <p className="text-sm leading-7 text-[color:var(--foreground)]">
                    {matchSummary}
                  </p>
                </DetailPanel>
                <DetailPanel title="What to expect">
                  <p className="text-sm leading-7 text-[color:var(--foreground)]">
                    {event.description?.trim() ||
                      `${event.restaurant_name} in ${event.restaurant_subregion}${event.restaurant_neighbourhood ? `, ${event.restaurant_neighbourhood}` : ''} for a group of ${event.capacity}.`}
                  </p>
                </DetailPanel>
                <DetailPanel title="Your seat">
                  <p className="text-base font-semibold text-[color:var(--foreground)]">
                    {getDetailSeatTitle(event)}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[color:var(--text-muted)]">
                    {getDetailSeatDescription(event)}
                  </p>
                </DetailPanel>
                <DetailPanel title="At a glance">
                  <div className="space-y-2 text-sm text-[color:var(--foreground)]">
                    <p>{formatEventDate(event.starts_at)}</p>
                    <p>Table for {event.capacity}</p>
                    <p>{getAtAGlanceSeatSummary(event)}</p>
                  </div>
                </DetailPanel>
              </section>

              {event.needsDayOfConfirmation && onSetDayOfConfirmation ? (
                <section className="mt-5 rounded-[1.75rem] border border-[color:var(--accent-border)] bg-[color:var(--accent-softer)] p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--accent-strong)]">
                    Confirmation needed today
                  </p>
                  <p className="mt-2 text-base font-semibold text-[color:var(--foreground)]">
                    This dinner is happening today. Confirm whether you are still going.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Button
                      disabled={eventActionLoadingId === event.id}
                      onClick={() => onSetDayOfConfirmation('confirm')}
                    >
                      {eventActionLoadingId === event.id ? 'Updating...' : 'Confirm I am still going'}
                    </Button>
                    <Button
                      disabled={eventActionLoadingId === event.id}
                      onClick={() => onSetDayOfConfirmation('decline')}
                      variant="secondary"
                    >
                      {eventActionLoadingId === event.id ? 'Updating...' : "I can't make it"}
                    </Button>
                  </div>
                </section>
              ) : null}

              <div className="mt-5">
                <DetailPanel title="Attendee preview">
                  {event.canViewAttendees ? (
                    event.attendeePreview.length > 0 ? (
                      <div className="space-y-3">
                        {event.attendeePreview.map((attendee, index) => (
                          <div
                            className="flex items-center gap-3 rounded-2xl border border-[color:var(--border-soft)] bg-white px-4 py-3"
                            key={`${event.id}-${attendee.displayName}-${index}`}
                          >
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color:var(--accent-soft)] text-sm font-semibold text-[color:var(--accent-strong)]">
                              {getAttendeeInitials(attendee.displayName)}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-[color:var(--foreground)]">
                                {attendee.displayName}
                              </p>
                              <p className="mt-1 text-xs text-[color:var(--text-muted)]">
                                {getAttendeePreviewStatus(event, attendee.dayOfConfirmationStatus)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-[color:var(--text-muted)]">No one has confirmed yet.</p>
                    )
                  ) : (
                    <p className="text-sm text-[color:var(--text-muted)]">Join to see more about the table.</p>
                  )}
                </DetailPanel>
              </div>

              {!event.isJoined && event.spotsLeft === 0 ? (
                <div className="mt-5">
                  <DetailPanel title="Try these instead">
                    {similarEvents.length > 0 ? (
                      <div className="flex flex-wrap gap-3">
                        {similarEvents.map((similarEvent) => (
                          <Button
                            href={`/events/${similarEvent.id}`}
                            key={similarEvent.id}
                            variant="secondary"
                          >
                            {similarEvent.title}
                          </Button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-[color:var(--text-muted)]">
                        No close alternatives are live right now.
                      </p>
                    )}
                  </DetailPanel>
                </div>
              ) : null}

              {event.canSubmitFeedback && feedbackDraft && onFeedbackDraftChange && onSubmitFeedback ? (
                <div className="mt-5">
                  <DetailPanel title="After the dinner">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="space-y-2">
                        <span className="text-sm font-medium text-[color:var(--foreground)]">Venue rating</span>
                        <select
                          className="tb-input"
                          onChange={(nextEvent) =>
                            onFeedbackDraftChange({
                              ...feedbackDraft,
                              venueRating: nextEvent.target.value,
                            })
                          }
                          value={feedbackDraft.venueRating}
                        >
                          <option value="">Select</option>
                          {[1, 2, 3, 4, 5].map((rating) => (
                            <option key={rating} value={rating}>
                              {rating}/5
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="space-y-2">
                        <span className="text-sm font-medium text-[color:var(--foreground)]">Group rating</span>
                        <select
                          className="tb-input"
                          onChange={(nextEvent) =>
                            onFeedbackDraftChange({
                              ...feedbackDraft,
                              groupRating: nextEvent.target.value,
                            })
                          }
                          value={feedbackDraft.groupRating}
                        >
                          <option value="">Select</option>
                          {[1, 2, 3, 4, 5].map((rating) => (
                            <option key={rating} value={rating}>
                              {rating}/5
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <div className="mt-4">
                      <p className="text-sm font-medium text-[color:var(--foreground)]">Would you join again?</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {[
                          { label: 'Yes', value: 'yes' as const },
                          { label: 'No', value: 'no' as const },
                        ].map((option) => (
                          <Button
                            className="min-w-20"
                            key={option.value}
                            onClick={() =>
                              onFeedbackDraftChange({
                                ...feedbackDraft,
                                wouldJoinAgain: option.value,
                              })
                            }
                            size="sm"
                            variant={
                              feedbackDraft.wouldJoinAgain === option.value ? 'primary' : 'secondary'
                            }
                          >
                            {option.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                    <label className="mt-4 block space-y-2">
                      <span className="text-sm font-medium text-[color:var(--foreground)]">Notes</span>
                      <textarea
                        className="tb-input min-h-24"
                        onChange={(nextEvent) =>
                          onFeedbackDraftChange({
                            ...feedbackDraft,
                            notes: nextEvent.target.value,
                          })
                        }
                        placeholder="What worked or didn't?"
                        value={feedbackDraft.notes}
                      />
                    </label>
                    <div className="mt-4">
                      <Button
                        disabled={
                          feedbackSavingId === event.id ||
                          !feedbackDraft.groupRating ||
                          !feedbackDraft.venueRating ||
                          !feedbackDraft.wouldJoinAgain
                        }
                        onClick={onSubmitFeedback}
                      >
                        {feedbackSavingId === event.id
                          ? 'Saving...'
                          : event.feedback.submitted
                            ? 'Update feedback'
                            : 'Save feedback'}
                      </Button>
                    </div>
                  </DetailPanel>
                </div>
              ) : null}

              <div className="mt-6 flex flex-wrap gap-3">
                <Button href="/events" variant="secondary">
                  Back to events
                </Button>
                {onSetEventSignup ? (
                  <Button
                    disabled={
                      eventActionLoadingId === event.id ||
                      event.hasEnded ||
                      (!event.isJoined && (event.status !== 'open' || event.spotsLeft === 0))
                    }
                    onClick={() =>
                      onSetEventSignup(event.isJoined ? 'leave' : 'join')
                    }
                    variant={event.isJoined ? 'secondary' : 'primary'}
                  >
                    {getActionLabel(event, eventActionLoadingId)}
                  </Button>
                ) : null}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </article>
  )
}
