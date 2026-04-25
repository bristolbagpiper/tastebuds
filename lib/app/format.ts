import type { DashboardEvent, FeedbackDraft, NotificationSummary } from '@/lib/app/types'

export function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ')
}

export function formatEventDate(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'America/New_York',
  }).format(new Date(value))
}

export function formatNotificationDate(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/New_York',
  }).format(new Date(value))
}

export function formatIntent() {
  return 'Friendship'
}

export function formatMatchScore(score: number | null | undefined) {
  if (typeof score !== 'number' || Number.isNaN(score)) {
    return '--'
  }

  return `${Math.max(0, Math.min(100, Math.round(score)))}/100`
}

export function describeMatchStrength(score: number | null | undefined) {
  if (typeof score !== 'number' || Number.isNaN(score)) {
    return 'Personal fit'
  }

  if (score >= 90) {
    return 'Exceptional fit'
  }

  if (score >= 80) {
    return 'Strong fit'
  }

  if (score >= 65) {
    return 'Good fit'
  }

  return 'Stretch fit'
}

export function formatGooglePriceLevel(value: string | null | undefined) {
  switch (value) {
    case 'PRICE_LEVEL_FREE':
      return 'Free'
    case 'PRICE_LEVEL_INEXPENSIVE':
      return '$'
    case 'PRICE_LEVEL_MODERATE':
      return '$$'
    case 'PRICE_LEVEL_EXPENSIVE':
      return '$$$'
    case 'PRICE_LEVEL_VERY_EXPENSIVE':
      return '$$$$'
    default:
      return value ?? null
  }
}

export function formatNotificationType(type: NotificationSummary['type']) {
  switch (type) {
    case 'event_signup':
      return 'Signup'
    case 'event_update':
      return 'Update'
    case 'event_at_risk':
      return 'At risk'
    case 'event_reminder_24h':
    case 'event_reminder_2h':
      return 'Reminder'
    case 'event_day_confirmation':
      return 'Confirm today'
    case 'event_follow_up':
      return 'Follow-up'
    case 'event_attendance':
      return 'Attendance'
    default:
      return 'Notice'
  }
}

export function formatDayConfirmationStatus(
  status: DashboardEvent['dayOfConfirmationStatus']
) {
  switch (status) {
    case 'confirmed':
      return 'Confirmed today'
    case 'declined':
      return 'Declined today'
    case 'pending':
      return 'Awaiting your answer'
    default:
      return 'Not required yet'
  }
}

export function formatViabilityStatus(status: DashboardEvent['viabilityStatus']) {
  switch (status) {
    case 'at_risk':
      return 'At risk'
    case 'forced_go':
      return 'Forced to proceed'
    case 'cancelled_low_confirmations':
      return 'Cancelled for low confirmations'
    default:
      return 'Healthy'
  }
}

export function renderTagList(values: string[] | null | undefined) {
  if (!values?.length) {
    return 'Not set'
  }

  return values.join(', ')
}

export function isSameCalendarDay(value: string) {
  const targetDate = new Date(value)
  const now = new Date()

  return (
    targetDate.getFullYear() === now.getFullYear() &&
    targetDate.getMonth() === now.getMonth() &&
    targetDate.getDate() === now.getDate()
  )
}

export function toFeedbackDraft(event: DashboardEvent): FeedbackDraft {
  return {
    groupRating: event.feedback.groupRating ? String(event.feedback.groupRating) : '',
    notes: event.feedback.notes ?? '',
    venueRating: event.feedback.venueRating ? String(event.feedback.venueRating) : '',
    wouldJoinAgain:
      event.feedback.wouldJoinAgain === null
        ? ''
        : event.feedback.wouldJoinAgain
          ? 'yes'
          : 'no',
  }
}

export function isProfileComplete(profile: {
  display_name: string | null
  home_latitude: number | null
  home_longitude: number | null
  preferred_crowd: string[] | null
  preferred_energy: string[] | null
  preferred_music: string[] | null
  preferred_price: string[] | null
  preferred_scene: string[] | null
  preferred_setting: string[] | null
  subregion: string | null
} | null) {
  return Boolean(
    profile?.display_name &&
      profile.home_latitude !== null &&
      profile.home_longitude !== null &&
      profile.subregion &&
      profile.preferred_energy?.length &&
      profile.preferred_scene?.length &&
      profile.preferred_crowd?.length &&
      profile.preferred_music?.length &&
      profile.preferred_setting?.length &&
      profile.preferred_price?.length
  )
}
