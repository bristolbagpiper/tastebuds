export type Profile = {
  bio: string | null
  cuisine_preferences: string[] | null
  display_name: string | null
  home_latitude: number | null
  home_longitude: number | null
  intent: 'dating' | 'friendship' | null
  max_travel_minutes: number | null
  neighbourhood: string | null
  preferred_crowd: string[] | null
  preferred_energy: string[] | null
  preferred_music: string[] | null
  preferred_price: string[] | null
  preferred_scene: string[] | null
  preferred_setting: string[] | null
  subregion: string | null
}

export type NotificationSummary = {
  body: string
  created_at: string
  id: number
  read_at: string | null
  title: string
  type: string
}

export type DashboardEvent = {
  attendeeCount: number
  attendeePreview: {
    dayOfConfirmationStatus: 'pending' | 'confirmed' | 'declined'
    displayName: string
  }[]
  canSubmitFeedback: boolean
  canViewAttendees: boolean
  capacity: number
  confirmedTodayCount: number
  dayOfConfirmationStatus: 'pending' | 'confirmed' | 'declined' | null
  description: string | null
  duration_minutes: number
  feedback: {
    groupRating: number | null
    notes: string
    submitted: boolean
    venueRating: number | null
    wouldJoinAgain: boolean | null
  }
  hasEnded: boolean
  id: number
  intent: 'dating' | 'friendship'
  isJoined: boolean
  minimumViableAttendees: number
  needsDayOfConfirmation: boolean
  personalMatchScore: number | null
  personalMatchSummary: string | null
  projectedRestaurantScore: number
  restaurant_cuisines: string[] | null
  restaurant_name: string
  restaurant_neighbourhood: string | null
  restaurant_subregion: string
  shouldReconsiderGoing: boolean
  signupStatus: 'going' | 'waitlisted' | 'cancelled' | 'removed' | 'no_show' | 'attended' | null
  spotsLeft: number
  starts_at: string
  status: 'open' | 'closed' | 'cancelled'
  title: string
  venue_crowd: string[] | null
  venueDistanceKm: number | null
  venue_energy: string | null
  venueMatchSummary: string
  venue_music: string[] | null
  venue_price: string | null
  venue_scene: string[] | null
  venue_setting: string[] | null
  viabilityStatus: 'healthy' | 'at_risk' | 'forced_go' | 'cancelled_low_confirmations'
  waitlistCount: number
  waitlistPosition: number | null
}

export type FeedbackDraft = {
  groupRating: string
  notes: string
  venueRating: string
  wouldJoinAgain: '' | 'no' | 'yes'
}

export type DashboardRestaurant = {
  availableEventCount: number
  availableEvents: {
    id: number
    signupStatus: 'going' | 'waitlisted' | null
    startsAt: string
    title: string
    viabilityStatus: 'healthy' | 'at_risk' | 'forced_go' | 'cancelled_low_confirmations'
  }[]
  formattedAddress: string | null
  googleEditorialSummary: string | null
  googleMapsUri: string | null
  googlePriceLevel: string | null
  googleRating: number | null
  googleUserRatingsTotal: number | null
  googleWebsiteUri: string | null
  id: number
  isSaved: boolean
  matchScore: number
  name: string
  neighbourhood: string | null
  restaurant_cuisines: string[] | null
  subregion: string
  venueDistanceKm: number | null
  venueMatchSummary: string
  venue_crowd: string[] | null
  venue_energy: string | null
  venue_music: string[] | null
  venue_price: string | null
  venue_scene: string[] | null
  venue_setting: string[] | null
}
