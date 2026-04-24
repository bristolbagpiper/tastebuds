import { Button } from '@/components/app/Button'
import { MatchScoreBadge } from '@/components/app/MatchScoreBadge'
import { TasteTag } from '@/components/app/TasteTag'
import {
  formatDayConfirmationStatus,
  formatEventDate,
  formatViabilityStatus,
} from '@/lib/app/format'
import type { DashboardEvent, FeedbackDraft } from '@/lib/app/types'

function renderTags(values: string[] | null | undefined) {
  if (!values?.length) {
    return null
  }

  return (
    <div className="flex flex-wrap gap-2">
      {values.map((value) => (
        <TasteTag key={value}>{value}</TasteTag>
      ))}
    </div>
  )
}

function getActionLabel(
  event: DashboardEvent,
  eventActionLoadingId: number | null | undefined
) {
  if (eventActionLoadingId === event.id) {
    return event.signupStatus === 'waitlisted' ? 'Updating...' : 'Joining...'
  }

  if (event.status === 'closed' && !event.isJoined && event.signupStatus !== 'waitlisted') {
    return 'Signup closed'
  }

  if (event.signupStatus === 'waitlisted') {
    return 'Leave waitlist'
  }

  if (event.isJoined) {
    return 'Leave event'
  }

  return event.spotsLeft === 0 ? 'Join waitlist' : 'Join event'
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
  return (
    <article className="tb-panel-soft rounded-3xl p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <div className="flex flex-wrap items-center gap-3">
            <MatchScoreBadge score={event.projectedRestaurantScore} />
            <span className="rounded-full border border-[color:var(--border-soft)] bg-[color:var(--surface)] px-3 py-1 text-sm font-medium text-[color:var(--text-muted)]">
              {formatViabilityStatus(event.viabilityStatus)}
            </span>
          </div>
          <h2 className="mt-3 text-2xl font-semibold text-[color:var(--foreground)]">
            {event.title}
          </h2>
          <p className="mt-2 text-sm text-[color:var(--foreground)]">
            {event.restaurant_name} - {event.restaurant_subregion}
            {event.restaurant_neighbourhood ? `, ${event.restaurant_neighbourhood}` : ''}
          </p>
          <p className="tb-copy mt-1 text-sm">{formatEventDate(event.starts_at)}</p>
          <p className="tb-copy mt-1 text-sm">Duration: {event.duration_minutes} minutes</p>
          {event.venueDistanceKm !== null ? (
            <p className="tb-copy mt-1 text-sm">
              Approx {event.venueDistanceKm} km from your anchor
            </p>
          ) : null}
        </div>
        <div className="tb-panel rounded-3xl px-4 py-3 text-sm text-[color:var(--text-muted)]">
          <p>
            Attending:{' '}
            <span className="font-medium text-[color:var(--foreground)]">
              {event.attendeeCount}/{event.capacity}
            </span>
          </p>
          <p>
            Spots left:{' '}
            <span className="font-medium text-[color:var(--foreground)]">{event.spotsLeft}</span>
          </p>
          <p>
            Waitlist:{' '}
            <span className="font-medium text-[color:var(--foreground)]">{event.waitlistCount}</span>
          </p>
          <p>
            Today:{' '}
            <span className="font-medium text-[color:var(--foreground)]">
              {event.confirmedTodayCount}/{event.minimumViableAttendees}
            </span>
          </p>
        </div>
      </div>

      {event.description ? <p className="tb-copy mt-4 text-sm leading-7">{event.description}</p> : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {event.venue_energy ? <TasteTag>{event.venue_energy}</TasteTag> : null}
        {event.venue_price ? <TasteTag>{event.venue_price}</TasteTag> : null}
        {renderTags(event.venue_scene)}
        {renderTags(event.venue_crowd)}
        {renderTags(event.venue_music)}
        {renderTags(event.venue_setting)}
        {event.restaurant_cuisines?.map((value) => (
          <TasteTag key={`cuisine-${value}`}>{value}</TasteTag>
        ))}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="tb-panel rounded-3xl p-4">
          <p className="tb-label text-xs font-medium uppercase tracking-[0.14em]">Venue fit</p>
          <p className="tb-copy mt-2 text-sm leading-6">{event.venueMatchSummary}</p>
        </div>
        <div className="tb-panel rounded-3xl p-4">
          <p className="tb-label text-xs font-medium uppercase tracking-[0.14em]">Your status</p>
          <p className="mt-2 text-base font-semibold text-[color:var(--foreground)]">
            {event.signupStatus === 'going'
              ? 'Confirmed'
              : event.signupStatus === 'waitlisted'
                ? `Waitlisted${event.waitlistPosition ? ` (#${event.waitlistPosition})` : ''}`
                : 'Not joined'}
          </p>
          <p className="tb-copy mt-2 text-sm leading-6">
            {event.signupStatus === 'going'
              ? `Day-of response: ${formatDayConfirmationStatus(event.dayOfConfirmationStatus)}`
              : event.personalMatchSummary ?? 'Join the event to compute your attendee fit.'}
          </p>
        </div>
      </div>

      {!showDetails && detailHref ? (
        <div className="mt-5 flex flex-wrap gap-3">
          <Button href={detailHref} variant="secondary">
            Open details
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
      ) : null}

      {showDetails ? (
        <>
          {event.needsDayOfConfirmation && onSetDayOfConfirmation ? (
            <section className="mt-5 rounded-3xl border border-[color:color-mix(in_srgb,var(--accent)_28%,white)] bg-[color:color-mix(in_srgb,var(--accent)_10%,var(--surface))] p-4">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-[color:var(--accent-strong)]">
                Today&apos;s confirmation
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

          <section className="tb-panel mt-5 rounded-3xl p-4">
            <p className="tb-label text-xs font-medium uppercase tracking-[0.14em]">
              Attendee visibility
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
                      {' - '}
                      {attendee.dayOfConfirmationStatus === 'confirmed' ? 'confirmed today' : 'pending today'}
                    </span>
                  ))
                ) : (
                  <p className="tb-copy text-sm">No confirmed attendees yet.</p>
                )}
              </div>
            ) : (
              <p className="tb-copy mt-3 text-sm">
                Join the event or waitlist to see attendee preview.
              </p>
            )}
          </section>

          {event.canSubmitFeedback && feedbackDraft && onFeedbackDraftChange && onSubmitFeedback ? (
            <section className="tb-panel mt-5 rounded-3xl p-4">
              <p className="tb-label text-xs font-medium uppercase tracking-[0.14em]">
                Post-event feedback
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
