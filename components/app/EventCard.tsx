import { Button } from '@/components/app/Button'
import { MatchScoreBadge } from '@/components/app/MatchScoreBadge'
import { TasteTag } from '@/components/app/TasteTag'
import { formatDayConfirmationStatus, formatEventDate } from '@/lib/app/format'
import type { DashboardEvent, FeedbackDraft } from '@/lib/app/types'

function getActionLabel(
  event: DashboardEvent,
  eventActionLoadingId: number | null | undefined
) {
  if (eventActionLoadingId === event.id) {
    return 'Updating...'
  }

  if (event.status === 'closed' && !event.isJoined && event.signupStatus !== 'waitlisted') {
    return 'Signups closed'
  }

  if (event.signupStatus === 'waitlisted') {
    return 'Leave waitlist'
  }

  if (event.isJoined) {
    return 'Leave table'
  }

  return event.spotsLeft === 0 ? 'Join waitlist' : 'Join table'
}

function getListTags(event: DashboardEvent) {
  const tags: string[] = []

  if (event.restaurant_cuisines?.[0]) {
    tags.push(event.restaurant_cuisines[0])
  }

  if (event.venue_price) {
    tags.push(event.venue_price)
  }

  if (event.venue_energy) {
    tags.push(event.venue_energy)
  }

  if (event.venue_scene?.[0]) {
    tags.push(event.venue_scene[0])
  }

  return tags.slice(0, 5)
}

function getSeatSummary(event: DashboardEvent) {
  if (event.isJoined) {
    return 'You have a seat at this table.'
  }

  if (event.signupStatus === 'waitlisted') {
    return event.waitlistPosition
      ? `You are on the waitlist at #${event.waitlistPosition}.`
      : 'You are on the waitlist for this table.'
  }

  if (event.spotsLeft > 0) {
    return `${event.spotsLeft} ${event.spotsLeft === 1 ? 'seat' : 'seats'} left from a group of ${event.capacity}.`
  }

  return `The table is full, but the waitlist is open for this group of ${event.capacity}.`
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
  showDetails?: boolean
}) {
  const listTags = getListTags(event)

  return (
    <article className="tb-panel-soft rounded-[2rem] p-6 shadow-[0_20px_45px_rgba(94,74,60,0.08)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <div className="flex flex-wrap items-center gap-3">
            <MatchScoreBadge score={event.projectedRestaurantScore} />
            {event.signupStatus === 'going' ? (
              <span className="rounded-full border border-[color:var(--border-soft)] bg-[color:rgba(255,255,255,0.7)] px-3 py-1 text-sm font-medium text-[color:var(--text-muted)]">
                Joined
              </span>
            ) : null}
            {event.signupStatus === 'waitlisted' ? (
              <span className="rounded-full border border-[color:var(--border-soft)] bg-[color:rgba(255,255,255,0.7)] px-3 py-1 text-sm font-medium text-[color:var(--text-muted)]">
                Waitlist
              </span>
            ) : null}
          </div>
          <h2 className="mt-4 text-2xl font-semibold text-[color:var(--foreground)]">
            {event.title}
          </h2>
          <p className="mt-2 text-sm text-[color:var(--foreground)]">
            {event.restaurant_name} • {event.restaurant_subregion}
            {event.restaurant_neighbourhood ? `, ${event.restaurant_neighbourhood}` : ''}
          </p>
          <p className="tb-copy mt-1 text-sm">{formatEventDate(event.starts_at)}</p>
          <p className="tb-copy mt-2 text-sm">{getSeatSummary(event)}</p>
        </div>
      </div>

      <p className="mt-4 text-base leading-7 text-[color:var(--foreground)]">
        {event.description?.trim() || 'Small dinners with people you are likely to get on with.'}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {listTags.map((value) => (
          <TasteTag key={`${event.id}-${value}`}>{value}</TasteTag>
        ))}
      </div>

      {!showDetails && detailHref ? (
        <div className="mt-6 flex flex-wrap gap-3">
          {onSetEventSignup ? (
            <Button
              disabled={eventActionLoadingId === event.id || (!event.isJoined && event.status !== 'open')}
              onClick={() =>
                onSetEventSignup(event.isJoined || event.signupStatus === 'waitlisted' ? 'leave' : 'join')
              }
              variant={event.isJoined || event.signupStatus === 'waitlisted' ? 'secondary' : 'primary'}
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
          <section className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="rounded-3xl bg-[color:rgba(255,255,255,0.62)] p-5">
              <p className="tb-label text-xs font-medium uppercase tracking-[0.14em]">Why this fits you</p>
              <p className="mt-3 text-sm leading-7 text-[color:var(--foreground)]">
                {event.personalMatchSummary ?? event.venueMatchSummary}
              </p>
            </div>
            <div className="rounded-3xl bg-[color:rgba(255,255,255,0.62)] p-5">
              <p className="tb-label text-xs font-medium uppercase tracking-[0.14em]">What to expect</p>
              <p className="mt-3 text-sm leading-7 text-[color:var(--foreground)]">
                {event.description?.trim() ||
                  `${event.restaurant_name} in ${event.restaurant_subregion}${event.restaurant_neighbourhood ? `, ${event.restaurant_neighbourhood}` : ''} for a group of ${event.capacity}.`}
              </p>
            </div>
            <div className="rounded-3xl bg-[color:rgba(255,255,255,0.62)] p-5">
              <p className="tb-label text-xs font-medium uppercase tracking-[0.14em]">Your seat</p>
              <p className="mt-3 text-base font-semibold text-[color:var(--foreground)]">
                {event.signupStatus === 'going'
                  ? 'You are in'
                  : event.signupStatus === 'waitlisted'
                    ? 'You are on the waitlist'
                    : 'You have not joined yet'}
              </p>
              <p className="tb-copy mt-2 text-sm leading-6">
                {event.signupStatus === 'going'
                  ? `Today’s reply: ${formatDayConfirmationStatus(event.dayOfConfirmationStatus)}.`
                  : getSeatSummary(event)}
              </p>
            </div>
            <div className="rounded-3xl bg-[color:rgba(255,255,255,0.62)] p-5">
              <p className="tb-label text-xs font-medium uppercase tracking-[0.14em]">At a glance</p>
              <div className="mt-3 space-y-2 text-sm text-[color:var(--foreground)]">
                <p>{formatEventDate(event.starts_at)}</p>
                <p>Table for {event.capacity}</p>
                <p>
                  {event.spotsLeft > 0
                    ? `${event.spotsLeft} ${event.spotsLeft === 1 ? 'seat' : 'seats'} left`
                    : 'Waitlist open'}
                </p>
              </div>
            </div>
          </section>

          {event.needsDayOfConfirmation && onSetDayOfConfirmation ? (
            <section className="mt-5 rounded-3xl border border-[color:color-mix(in_srgb,var(--accent)_28%,white)] bg-[color:color-mix(in_srgb,var(--accent)_10%,var(--surface))] p-4">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-[color:var(--accent-strong)]">
                Confirmation needed today
              </p>
              <p className="mt-2 text-base font-semibold text-[color:var(--foreground)]">
                This event is today. Confirm whether you are still going.
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

          <section className="mt-5 rounded-3xl bg-[color:rgba(255,255,255,0.62)] p-5">
            <p className="tb-label text-xs font-medium uppercase tracking-[0.14em]">
              Attendee preview
            </p>
            {event.canViewAttendees ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {event.attendeePreview.length > 0 ? (
                  event.attendeePreview.map((attendee, index) => (
                    <span
                      className="rounded-full border border-[color:var(--border-soft)] bg-[color:var(--surface-strong)] px-3 py-1 text-sm text-[color:var(--text-muted)]"
                      key={`${event.id}-${attendee.displayName}-${index}`}
                    >
                      <span className="font-medium text-[color:var(--foreground)]">
                        {attendee.displayName}
                      </span>
                      {' • '}
                      {attendee.dayOfConfirmationStatus === 'confirmed' ? 'confirmed today' : 'pending today'}
                    </span>
                  ))
                ) : (
                  <p className="tb-copy text-sm">No one has confirmed yet.</p>
                )}
              </div>
            ) : (
              <p className="tb-copy mt-3 text-sm">Join to see more about the table.</p>
            )}
          </section>

          {event.canSubmitFeedback && feedbackDraft && onFeedbackDraftChange && onSubmitFeedback ? (
            <section className="mt-5 rounded-3xl bg-[color:rgba(255,255,255,0.62)] p-5">
              <p className="tb-label text-xs font-medium uppercase tracking-[0.14em]">
                After the dinner
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
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
              <div className="mt-3">
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
              <label className="mt-3 block space-y-2">
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
            </section>
          ) : null}

          <div className="mt-5 flex flex-wrap gap-3">
            <Button href="/events" variant="secondary">
              Back to events
            </Button>
            {onSetEventSignup ? (
              <Button
                disabled={eventActionLoadingId === event.id || (!event.isJoined && event.status !== 'open')}
                onClick={() =>
                  onSetEventSignup(event.isJoined || event.signupStatus === 'waitlisted' ? 'leave' : 'join')
                }
                variant={event.isJoined || event.signupStatus === 'waitlisted' ? 'secondary' : 'primary'}
              >
                {getActionLabel(event, eventActionLoadingId)}
              </Button>
            ) : null}
          </div>
        </>
      ) : null}
    </article>
  )
}
