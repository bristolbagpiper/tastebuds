export type Profile = {
  age_range_comfort: string[] | null
  bio: string | null
  cuisine_preferences: string[] | null
  conversation_preference: string[] | null
  display_name: string | null
  dietary_restrictions: string[] | null
  drinking_preferences: string[] | null
  group_size_comfort: string[] | null
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
  preferred_vibes: string[] | null
  subregion: string | null
}

export type NotificationSummary = {
  body: string
  created_at: string
  id: number
  read_at: string | null
  title: string
  type:
    | 'event_signup'
    | 'event_update'
    | 'event_at_risk'
    | 'event_reminder_24h'
    | 'event_reminder_2h'
    | 'event_follow_up'
    | 'event_day_confirmation'
    | 'event_attendance'
    | 'restaurant_removed'
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
  google_good_for_groups?: boolean | null
  google_good_for_watching_sports?: boolean | null
  google_live_music?: boolean | null
  google_open_now?: boolean | null
  google_opening_hours?: string[] | null
  google_outdoor_seating?: boolean | null
  google_reservable?: boolean | null
  google_serves_beer?: boolean | null
  google_serves_brunch?: boolean | null
  google_serves_cocktails?: boolean | null
  google_serves_dessert?: boolean | null
  google_serves_dinner?: boolean | null
  google_serves_vegetarian_food?: boolean | null
  google_serves_wine?: boolean | null
  hasEnded: boolean
  id: number
  intent: 'dating' | 'friendship'
  isJoined: boolean
  minimumViableAttendees: number
  needsDayOfConfirmation: boolean
  menu_experience_tags?: string[] | null
  personalMatchScore: number | null
  personalMatchSummary: string | null
  projectedRestaurantScore: number
  restaurant_cuisines: string[] | null
  restaurantGooglePlaceId: string | null
  restaurant_name: string
  restaurant_neighbourhood: string | null
  restaurant_subregion: string
  shouldReconsiderGoing: boolean
  signupStatus: 'going' | 'cancelled' | 'removed' | 'no_show' | 'attended' | null
  spotsLeft: number
  starts_at: string
  status: 'open' | 'closed' | 'cancelled'
  title: string
  venue_crowd: string[] | null
  venueDistanceKm: number | null
  venue_energy: string | null
  venue_formats?: string[] | null
  venue_good_for_casual_meetups?: boolean | null
  venue_good_for_cocktails?: boolean | null
  venue_good_for_conversation?: boolean | null
  venue_good_for_dinner?: boolean | null
  venue_group_friendly?: boolean | null
  venue_indoor_outdoor?: string[] | null
  venueMatchSummary: string
  venue_music: string[] | null
  venue_noise_level?: string | null
  venue_price: string | null
  venue_reservation_friendly?: boolean | null
  venue_scene: string[] | null
  venue_seating_types?: string[] | null
  venue_setting: string[] | null
  venue_vibes?: string[] | null
  viabilityStatus: 'healthy' | 'at_risk' | 'forced_go' | 'cancelled_low_confirmations'
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
    signupStatus: 'going' | null
    startsAt: string
    title: string
    viabilityStatus: 'healthy' | 'at_risk' | 'forced_go' | 'cancelled_low_confirmations'
  }[]
  formattedAddress: string | null
  googleEditorialSummary: string | null
  googleGoodForGroups?: boolean | null
  googleGoodForWatchingSports?: boolean | null
  googleLiveMusic?: boolean | null
  googleMapsUri: string | null
  googleOpenNow?: boolean | null
  googleOpeningHours?: string[] | null
  googleOutdoorSeating?: boolean | null
  googlePlaceId: string | null
  googlePlacePhotoAuthorName?: string | null
  googlePlacePhotoUri?: string | null
  googlePriceLevel: string | null
  googleRating: number | null
  googleReservable?: boolean | null
  googleServesBeer?: boolean | null
  googleServesBrunch?: boolean | null
  googleServesCocktails?: boolean | null
  googleServesDessert?: boolean | null
  googleServesDinner?: boolean | null
  googleServesVegetarianFood?: boolean | null
  googleServesWine?: boolean | null
  googleUserRatingsTotal: number | null
  googleWebsiteUri: string | null
  id: number
  isSaved: boolean
  matchScore: number
  menu_experience_tags?: string[] | null
  name: string
  neighbourhood: string | null
  restaurant_cuisines: string[] | null
  subregion: string
  venue_latitude: number | null
  venue_longitude: number | null
  venueDistanceKm: number | null
  venue_formats?: string[] | null
  venue_good_for_casual_meetups?: boolean | null
  venue_good_for_cocktails?: boolean | null
  venue_good_for_conversation?: boolean | null
  venue_good_for_dinner?: boolean | null
  venue_group_friendly?: boolean | null
  venue_indoor_outdoor?: string[] | null
  venueMatchSummary: string
  venue_crowd: string[] | null
  venue_energy: string | null
  venue_music: string[] | null
  venue_noise_level?: string | null
  venue_price: string | null
  venue_reservation_friendly?: boolean | null
  venue_scene: string[] | null
  venue_seating_types?: string[] | null
  venue_setting: string[] | null
  venue_vibes?: string[] | null
}
