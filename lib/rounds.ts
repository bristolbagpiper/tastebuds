const NEW_YORK_TIME_ZONE = 'America/New_York'
const WEDNESDAY_INDEX = 3

export type MatchIntent = 'dating' | 'friendship'

function getCalendarPartsInTimeZone(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone,
    year: 'numeric',
  })

  const parts = formatter.formatToParts(date)

  return {
    day: Number(parts.find((part) => part.type === 'day')?.value),
    month: Number(parts.find((part) => part.type === 'month')?.value),
    year: Number(parts.find((part) => part.type === 'year')?.value),
  }
}

export function getUpcomingWednesdayDate(now = new Date()) {
  const { year, month, day } = getCalendarPartsInTimeZone(
    now,
    NEW_YORK_TIME_ZONE
  )

  const baseDate = new Date(Date.UTC(year, month - 1, day))
  const currentDayIndex = baseDate.getUTCDay()
  const daysUntilWednesday =
    (WEDNESDAY_INDEX - currentDayIndex + 7) % 7

  baseDate.setUTCDate(baseDate.getUTCDate() + daysUntilWednesday)

  return baseDate.toISOString().slice(0, 10)
}

export function formatRoundDate(roundDate: string) {
  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
    weekday: 'long',
  }).format(new Date(`${roundDate}T12:00:00Z`))
}

export function getIntentLabel(intent: MatchIntent) {
  return intent === 'dating' ? 'Dating' : 'Friendship'
}

export function getIntentRoundLabel(intent: MatchIntent) {
  return `${getIntentLabel(intent)} event`
}
