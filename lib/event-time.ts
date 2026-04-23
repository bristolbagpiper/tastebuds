const NEW_YORK_TIMEZONE = 'America/New_York'
export const WAITLIST_PROMOTION_CUTOFF_HOURS = 4

function formatDateKey(value: Date | string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: NEW_YORK_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(typeof value === 'string' ? new Date(value) : value)
}

export function isSameEventDayInNewYork(startsAt: string, reference: Date = new Date()) {
  return formatDateKey(startsAt) === formatDateKey(reference)
}

export function hasEventStarted(startsAt: string, reference: Date = new Date()) {
  return new Date(startsAt).getTime() <= reference.getTime()
}

export function getHoursUntilEvent(startsAt: string, reference: Date = new Date()) {
  return (new Date(startsAt).getTime() - reference.getTime()) / (60 * 60 * 1000)
}

export function isPastWaitlistPromotionCutoff(
  startsAt: string,
  reference: Date = new Date()
) {
  return getHoursUntilEvent(startsAt, reference) <= WAITLIST_PROMOTION_CUTOFF_HOURS
}
