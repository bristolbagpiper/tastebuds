'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import {
  LocationSearchField,
  type LocationSuggestion,
} from '@/components/location-search-field'
import { hasEventStarted } from '@/lib/event-time'
import {
  CROWD_TAGS,
  ENERGY_LEVELS,
  MANHATTAN_SUBREGIONS,
  MUSIC_TAGS,
  PRICE_TAGS,
  SCENE_TAGS,
  SETTING_TAGS,
  parseCuisinePreferenceInput,
} from '@/lib/events'
import { supabase } from '@/lib/supabase/client'

type EventIntent = 'dating' | 'friendship'
type EventAction =
  | 'archive'
  | 'cancel'
  | 'cancel-low-confirmation'
  | 'close'
  | 'force-proceed'
  | 'reopen'
  | 'unarchive'
  | 'update'
type RestaurantAction = 'archive' | 'unarchive' | 'update'
type AttendeeAction = 'mark-attended' | 'mark-no-show' | 'remove' | 'restore'

type AdminEventAttendee = {
  cuisine_preferences: string[] | null
  day_of_confirmation_status: 'pending' | 'confirmed' | 'declined'
  display_name: string | null
  email: string | null
  neighbourhood: string | null
  personal_match_score: number
  personal_match_summary: string | null
  restaurant_match_score: number
  signup_status:
    | 'attended'
    | 'cancelled'
    | 'going'
    | 'no_show'
    | 'removed'
    | 'waitlisted'
  subregion: string | null
  user_id: string
}

type AdminEvent = {
  archived_at: string | null
  attendeeCount: number
  attendees: AdminEventAttendee[]
  attendedCount: number
  average_group_rating: number | null
  average_venue_rating: number | null
  capacity: number
  confirmedTodayCount: number
  created_at: string
  description: string | null
  dropoffCount: number
  duration_minutes: number
  feedback_count: number
  id: number
  intent: EventIntent
  minimum_viable_attendees: number
  noShowCount: number
  restaurant_id: number | null
  restaurant_cuisines: string[]
  restaurant_name: string
  restaurant_neighbourhood: string | null
  restaurant_subregion: string
  starts_at: string
  status: 'open' | 'closed' | 'cancelled'
  title: string
  venue_crowd: string[]
  venue_energy: string | null
  venue_latitude: number | null
  venue_longitude: number | null
  venue_music: string[]
  venue_price: string | null
  venue_scene: string[]
  venue_setting: string[]
  viability_status: 'healthy' | 'at_risk' | 'forced_go' | 'cancelled_low_confirmations'
  waitlistCount: number
  would_join_again_count: number
}

type EmailRetryResult = {
  failed: number
  processed: number
  sent: number
  skipped: number
}

type AdminSummary = {
  averageFillRate: number
  openEvents: number
  totalAtRisk: number
  totalDayConfirmed: number
  totalAttended: number
  totalConfirmed: number
  totalDropped: number
  totalEvents: number
  totalFeedback: number
  totalNoShows: number
  totalWaitlisted: number
}

type AutomationResult = {
  dayConfirmations: number
  followUps: number
  reminders24h: number
  reminders2h: number
}

type AdminRestaurant = {
  archived_at: string | null
  created_at: string
  cuisines: string[]
  eventCount: number
  formatted_address: string | null
  google_editorial_summary: string | null
  google_maps_uri: string | null
  google_phone_number: string | null
  google_place_id: string | null
  google_price_level: string | null
  google_rating: number | null
  google_user_ratings_total: number | null
  google_website_uri: string | null
  id: number
  name: string
  neighbourhood: string | null
  subregion: (typeof MANHATTAN_SUBREGIONS)[number]
  upcomingEventCount: number
  venue_crowd: string[]
  venue_energy: string | null
  venue_latitude: number | null
  venue_longitude: number | null
  venue_music: string[]
  venue_price: string | null
  venue_scene: string[]
  venue_setting: string[]
}

type GooglePoiSuggestion = {
  formattedAddress: string | null
  googleMapsUri: string | null
  id: string
  latitude: number | null
  longitude: number | null
  name: string
  openNow: boolean | null
  phoneNumber: string | null
  priceLevel: string | null
  rating: number | null
  userRatingCount: number | null
  websiteUri: string | null
}

type GooglePoiDetails = GooglePoiSuggestion & {
  editorialSummary: string | null
  openingHours: string[]
}

function toLocalDateTimeInputValue(date: Date) {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  const hours = `${date.getHours()}`.padStart(2, '0')
  const minutes = `${date.getMinutes()}`.padStart(2, '0')

  return `${year}-${month}-${day}T${hours}:${minutes}`
}

function getDefaultStartsAt() {
  return toLocalDateTimeInputValue(new Date(Date.now() + 48 * 60 * 60 * 1000))
}

function toInputDateValue(iso: string) {
  const nextDate = new Date(iso)

  if (Number.isNaN(nextDate.getTime())) {
    return getDefaultStartsAt()
  }

  return toLocalDateTimeInputValue(nextDate)
}

function formatEventDate(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'America/New_York',
  }).format(new Date(value))
}

function hasAdminEventEnded(event: Pick<AdminEvent, 'duration_minutes' | 'starts_at'>) {
  return (
    new Date(event.starts_at).getTime() + event.duration_minutes * 60 * 1000 <=
    Date.now()
  )
}

function formatIntent(intent: EventIntent) {
  return intent === 'dating' ? 'Dating' : 'Friendship'
}

function formatSignupStatus(status: AdminEventAttendee['signup_status']) {
  switch (status) {
    case 'going':
      return 'Going'
    case 'waitlisted':
      return 'Waitlisted'
    case 'attended':
      return 'Attended'
    case 'no_show':
      return 'No-show'
    case 'removed':
      return 'Removed'
    default:
      return 'Cancelled'
  }
}

function formatDayConfirmationStatus(
  status: AdminEventAttendee['day_of_confirmation_status']
) {
  switch (status) {
    case 'confirmed':
      return 'Confirmed today'
    case 'declined':
      return 'Declined today'
    default:
      return 'Pending today'
  }
}

function formatViabilityStatus(status: AdminEvent['viability_status']) {
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

function mapGooglePriceLevelToVenuePrice(value: string | null) {
  switch (value) {
    case 'PRICE_LEVEL_INEXPENSIVE':
      return '$'
    case 'PRICE_LEVEL_MODERATE':
      return '$$'
    case 'PRICE_LEVEL_EXPENSIVE':
      return '$$$'
    case 'PRICE_LEVEL_VERY_EXPENSIVE':
      return '$$$$'
    default:
      return null
  }
}

function toggleValue(current: string[], value: string) {
  return current.includes(value)
    ? current.filter((entry) => entry !== value)
    : [...current, value]
}

function TagPicker({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string
  onToggle: (value: string) => void
  options: readonly string[]
  selected: string[]
}) {
  return (
    <div className="space-y-2">
      <span className="text-sm font-medium text-zinc-700">{label}</span>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const active = selected.includes(option)

          return (
            <button
              className={`rounded-xl px-3 py-2 text-sm font-medium transition ${
                active
                  ? 'bg-zinc-950 text-white'
                  : 'border border-zinc-300 text-zinc-700 hover:border-zinc-950 hover:text-zinc-950'
              }`}
              key={option}
              onClick={() => onToggle(option)}
              type="button"
            >
              {option}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function AdminPage() {
  const router = useRouter()
  const [email, setEmail] = useState<string | null>(null)
  const [events, setEvents] = useState<AdminEvent[]>([])
  const [restaurants, setRestaurants] = useState<AdminRestaurant[]>([])
  const [summary, setSummary] = useState<AdminSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [restaurantSubmitting, setRestaurantSubmitting] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [showArchivedRestaurants, setShowArchivedRestaurants] = useState(false)
  const [retryingEmails, setRetryingEmails] = useState(false)
  const [runningAutomation, setRunningAutomation] = useState(false)
  const [eventActionLoadingId, setEventActionLoadingId] = useState<number | null>(
    null
  )
  const [restaurantActionLoadingId, setRestaurantActionLoadingId] = useState<number | null>(
    null
  )
  const [attendeeActionKey, setAttendeeActionKey] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [emailResult, setEmailResult] = useState<EmailRetryResult | null>(null)
  const [automationResult, setAutomationResult] = useState<AutomationResult | null>(
    null
  )
  const [editingEventId, setEditingEventId] = useState<number | null>(null)
  const [editingRestaurantId, setEditingRestaurantId] = useState<number | null>(null)
  const [poiSearchQuery, setPoiSearchQuery] = useState('')
  const [poiSearchLoading, setPoiSearchLoading] = useState(false)
  const [poiImportLoadingId, setPoiImportLoadingId] = useState<string | null>(null)
  const [poiResults, setPoiResults] = useState<GooglePoiSuggestion[]>([])

  const [title, setTitle] = useState('')
  const [intent, setIntent] = useState<EventIntent>('dating')
  const [startsAt, setStartsAt] = useState(getDefaultStartsAt())
  const [selectedRestaurantId, setSelectedRestaurantId] = useState('')
  const [restaurantName, setRestaurantName] = useState('')
  const [restaurantSubregion, setRestaurantSubregion] =
    useState<(typeof MANHATTAN_SUBREGIONS)[number]>('Midtown')
  const [restaurantNeighbourhood, setRestaurantNeighbourhood] = useState('')
  const [venueAddressQuery, setVenueAddressQuery] = useState('')
  const [restaurantCuisines, setRestaurantCuisines] = useState('')
  const [googlePlaceId, setGooglePlaceId] = useState('')
  const [googleMapsUri, setGoogleMapsUri] = useState('')
  const [formattedAddress, setFormattedAddress] = useState('')
  const [googleRating, setGoogleRating] = useState('')
  const [googleUserRatingsTotal, setGoogleUserRatingsTotal] = useState('')
  const [googlePriceLevel, setGooglePriceLevel] = useState('')
  const [googleEditorialSummary, setGoogleEditorialSummary] = useState('')
  const [googlePhoneNumber, setGooglePhoneNumber] = useState('')
  const [googleWebsiteUri, setGoogleWebsiteUri] = useState('')
  const [venueEnergy, setVenueEnergy] =
    useState<(typeof ENERGY_LEVELS)[number]>('Moderate')
  const [venueLatitude, setVenueLatitude] = useState('')
  const [venueLongitude, setVenueLongitude] = useState('')
  const [venueScene, setVenueScene] = useState<string[]>(['Social'])
  const [venueCrowd, setVenueCrowd] = useState<string[]>(['Mixed'])
  const [venueMusic, setVenueMusic] = useState<string[]>(['Background'])
  const [venueSetting, setVenueSetting] = useState<string[]>(['Restaurant'])
  const [venuePrice, setVenuePrice] = useState<(typeof PRICE_TAGS)[number]>('$$')
  const [capacity, setCapacity] = useState('12')
  const [minimumViableAttendees, setMinimumViableAttendees] = useState('2')
  const [durationMinutes, setDurationMinutes] = useState('120')
  const [description, setDescription] = useState('')

  useEffect(() => {
    let active = true

    async function loadAdmin() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!active) {
        return
      }

      if (!user) {
        router.replace('/login')
        return
      }

      setEmail(user.email ?? null)

      const {
        data: { session },
      } = await supabase.auth.getSession()
      const accessToken = session?.access_token

      if (!accessToken) {
        setError('Missing active session. Log in again.')
        setLoading(false)
        return
      }

      const [eventsResponse, restaurantsResponse] = await Promise.all([
        fetch(showArchived ? '/api/admin/events?includeArchived=true' : '/api/admin/events', {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }),
        fetch('/api/admin/restaurants', {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }),
      ])

      const eventsPayload = (await eventsResponse.json()) as {
        error?: string
        events?: AdminEvent[]
        summary?: AdminSummary
      }
      const restaurantsPayload = (await restaurantsResponse.json()) as {
        error?: string
        restaurants?: AdminRestaurant[]
      }

      if (!active) {
        return
      }

      if (!eventsResponse.ok || eventsPayload.error) {
        setError(eventsPayload.error ?? 'Could not load admin events.')
        setLoading(false)
        return
      }

      if (!restaurantsResponse.ok || restaurantsPayload.error) {
        setError(restaurantsPayload.error ?? 'Could not load restaurants.')
        setLoading(false)
        return
      }

      setEvents(eventsPayload.events ?? [])
      setSummary(eventsPayload.summary ?? null)
      setRestaurants(restaurantsPayload.restaurants ?? [])
      setLoading(false)
    }

    void loadAdmin()

    return () => {
      active = false
    }
  }, [router, showArchived])

  async function getAccessToken() {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    return session?.access_token ?? null
  }

  async function refreshEvents() {
    const accessToken = await getAccessToken()

    if (!accessToken) {
      setError('Missing active session. Log in again.')
      return
    }

    const response = await fetch(
      showArchived ? '/api/admin/events?includeArchived=true' : '/api/admin/events',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    )

    const payload = (await response.json()) as {
      error?: string
      events?: AdminEvent[]
      summary?: AdminSummary
    }

    if (!response.ok || payload.error) {
      setError(payload.error ?? 'Could not refresh admin events.')
      return
    }

    setEvents(payload.events ?? [])
    setSummary(payload.summary ?? null)
  }

  async function refreshRestaurants() {
    const accessToken = await getAccessToken()

    if (!accessToken) {
      setError('Missing active session. Log in again.')
      return
    }

    const response = await fetch('/api/admin/restaurants', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    const payload = (await response.json()) as {
      error?: string
      restaurants?: AdminRestaurant[]
    }

    if (!response.ok || payload.error) {
      setError(payload.error ?? 'Could not refresh restaurants.')
      return
    }

    setRestaurants(payload.restaurants ?? [])
  }

  const selectedRestaurant =
    restaurants.find((restaurant) => restaurant.id === Number(selectedRestaurantId)) ?? null

  const visibleRestaurants = restaurants.filter((restaurant) =>
    showArchivedRestaurants ? true : restaurant.archived_at === null
  )

  function resetEventForm() {
    setEditingEventId(null)
    setTitle('')
    setIntent('dating')
    setStartsAt(getDefaultStartsAt())
    setSelectedRestaurantId('')
    setCapacity('12')
    setMinimumViableAttendees('2')
    setDurationMinutes('120')
    setDescription('')
  }

  function loadEventForEdit(nextEvent: AdminEvent) {
    setError('')
    setSuccess('')
    setEditingEventId(nextEvent.id)
    setTitle(nextEvent.title)
    setIntent(nextEvent.intent)
    setStartsAt(toInputDateValue(nextEvent.starts_at))
    setSelectedRestaurantId(nextEvent.restaurant_id ? String(nextEvent.restaurant_id) : '')
    setCapacity(String(nextEvent.capacity))
    setMinimumViableAttendees(String(nextEvent.minimum_viable_attendees))
    setDurationMinutes(String(nextEvent.duration_minutes))
    setDescription(nextEvent.description ?? '')
  }

  function resetRestaurantForm() {
    setEditingRestaurantId(null)
    setRestaurantName('')
    setRestaurantSubregion('Midtown')
    setRestaurantNeighbourhood('')
    setPoiSearchQuery('')
    setPoiResults([])
    setVenueAddressQuery('')
    setRestaurantCuisines('')
    setGooglePlaceId('')
    setGoogleMapsUri('')
    setFormattedAddress('')
    setGoogleRating('')
    setGoogleUserRatingsTotal('')
    setGooglePriceLevel('')
    setGoogleEditorialSummary('')
    setGooglePhoneNumber('')
    setGoogleWebsiteUri('')
    setVenueEnergy('Moderate')
    setVenueLatitude('')
    setVenueLongitude('')
    setVenueScene(['Social'])
    setVenueCrowd(['Mixed'])
    setVenueMusic(['Background'])
    setVenueSetting(['Restaurant'])
    setVenuePrice('$$')
  }

  function loadRestaurantForEdit(restaurant: AdminRestaurant) {
    setError('')
    setSuccess('')
    setEditingRestaurantId(restaurant.id)
    setRestaurantName(restaurant.name)
    setRestaurantSubregion(restaurant.subregion)
    setRestaurantNeighbourhood(restaurant.neighbourhood ?? '')
    setPoiSearchQuery(restaurant.name)
    setPoiResults([])
    setVenueAddressQuery([restaurant.name, restaurant.neighbourhood].filter(Boolean).join(', '))
    setRestaurantCuisines(restaurant.cuisines.join(', '))
    setGooglePlaceId(restaurant.google_place_id ?? '')
    setGoogleMapsUri(restaurant.google_maps_uri ?? '')
    setFormattedAddress(restaurant.formatted_address ?? '')
    setGoogleRating(
      restaurant.google_rating === null || restaurant.google_rating === undefined
        ? ''
        : String(restaurant.google_rating)
    )
    setGoogleUserRatingsTotal(
      restaurant.google_user_ratings_total === null ||
        restaurant.google_user_ratings_total === undefined
        ? ''
        : String(restaurant.google_user_ratings_total)
    )
    setGooglePriceLevel(restaurant.google_price_level ?? '')
    setGoogleEditorialSummary(restaurant.google_editorial_summary ?? '')
    setGooglePhoneNumber(restaurant.google_phone_number ?? '')
    setGoogleWebsiteUri(restaurant.google_website_uri ?? '')
    setVenueEnergy(
      (restaurant.venue_energy as (typeof ENERGY_LEVELS)[number] | null) ?? 'Moderate'
    )
    setVenueLatitude(
      restaurant.venue_latitude === null || restaurant.venue_latitude === undefined
        ? ''
        : String(restaurant.venue_latitude)
    )
    setVenueLongitude(
      restaurant.venue_longitude === null || restaurant.venue_longitude === undefined
        ? ''
        : String(restaurant.venue_longitude)
    )
    setVenueScene(restaurant.venue_scene)
    setVenueCrowd(restaurant.venue_crowd)
    setVenueMusic(restaurant.venue_music)
    setVenueSetting(restaurant.venue_setting)
    setVenuePrice(
      (restaurant.venue_price as (typeof PRICE_TAGS)[number] | null) ?? '$$'
    )
  }

  function applyVenueAddressSuggestion(suggestion: LocationSuggestion) {
    setVenueAddressQuery(suggestion.label)
    setVenueLatitude(String(suggestion.latitude))
    setVenueLongitude(String(suggestion.longitude))
    setRestaurantNeighbourhood(suggestion.neighbourhood ?? '')
    setRestaurantSubregion(suggestion.subregion)
  }

  async function searchGooglePois() {
    const query = poiSearchQuery.trim()

    if (query.length < 3) {
      setPoiResults([])
      return
    }

    setPoiSearchLoading(true)
    setError('')

    const accessToken = await getAccessToken()

    if (!accessToken) {
      setError('Missing active session. Log in again.')
      setPoiSearchLoading(false)
      return
    }

    const response = await fetch(
      `/api/admin/restaurant-poi-search?q=${encodeURIComponent(query)}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    )

    const payload = (await response.json()) as {
      error?: string
      results?: GooglePoiSuggestion[]
    }

    if (!response.ok || payload.error) {
      setError(payload.error ?? 'Could not search venue POIs.')
      setPoiSearchLoading(false)
      return
    }

    setPoiResults(payload.results ?? [])
    setPoiSearchLoading(false)
  }

  async function importGooglePoi(placeId: string) {
    setPoiImportLoadingId(placeId)
    setError('')

    const accessToken = await getAccessToken()

    if (!accessToken) {
      setError('Missing active session. Log in again.')
      setPoiImportLoadingId(null)
      return
    }

    const response = await fetch('/api/admin/restaurant-poi-search', {
      body: JSON.stringify({ placeId }),
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      method: 'POST',
    })

    const payload = (await response.json()) as {
      details?: GooglePoiDetails
      error?: string
    }

    if (!response.ok || payload.error || !payload.details) {
      setError(payload.error ?? 'Could not import venue POI details.')
      setPoiImportLoadingId(null)
      return
    }

    const details = payload.details

    setRestaurantName(details.name)
    setGooglePlaceId(details.id)
    setGoogleMapsUri(details.googleMapsUri ?? '')
    setFormattedAddress(details.formattedAddress ?? '')
    setGoogleRating(details.rating === null ? '' : String(details.rating))
    setGoogleUserRatingsTotal(
      details.userRatingCount === null ? '' : String(details.userRatingCount)
    )
    setGooglePriceLevel(details.priceLevel ?? '')
    setGoogleEditorialSummary(details.editorialSummary ?? '')
    setGooglePhoneNumber(details.phoneNumber ?? '')
    setGoogleWebsiteUri(details.websiteUri ?? '')
    const mappedVenuePrice = mapGooglePriceLevelToVenuePrice(details.priceLevel)

    if (mappedVenuePrice) {
      setVenuePrice(mappedVenuePrice)
    }

    if (details.latitude !== null) {
      setVenueLatitude(String(details.latitude))
    }

    if (details.longitude !== null) {
      setVenueLongitude(String(details.longitude))
    }

    if (details.formattedAddress) {
      setVenueAddressQuery(details.formattedAddress)
    }

    setPoiImportLoadingId(null)
  }

  async function createOrUpdateRestaurant(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSuccess('')
    setRestaurantSubmitting(true)

    const accessToken = await getAccessToken()

    if (!accessToken) {
      setError('Missing active session. Log in again.')
      setRestaurantSubmitting(false)
      return
    }

    const parsedVenueLatitude = Number(venueLatitude)
    const parsedVenueLongitude = Number(venueLongitude)

    if (
      !Number.isFinite(parsedVenueLatitude) ||
      parsedVenueLatitude < -90 ||
      parsedVenueLatitude > 90 ||
      !Number.isFinite(parsedVenueLongitude) ||
      parsedVenueLongitude < -180 ||
      parsedVenueLongitude > 180
    ) {
      setError('Venue latitude and longitude must be valid coordinates.')
      setRestaurantSubmitting(false)
      return
    }

    const body = {
      action: 'update' as RestaurantAction,
      cuisines: parseCuisinePreferenceInput(restaurantCuisines),
      formattedAddress,
      googleEditorialSummary,
      googleMapsUri,
      googlePhoneNumber,
      googlePlaceId,
      googlePriceLevel,
      googleRating: googleRating ? Number(googleRating) : null,
      googleUserRatingsTotal: googleUserRatingsTotal
        ? Number(googleUserRatingsTotal)
        : null,
      googleWebsiteUri,
      name: restaurantName,
      neighbourhood: restaurantNeighbourhood,
      restaurantId: editingRestaurantId,
      subregion: restaurantSubregion,
      venueCrowd,
      venueEnergy,
      venueLatitude: parsedVenueLatitude,
      venueLongitude: parsedVenueLongitude,
      venueMusic,
      venuePrice,
      venueScene,
      venueSetting,
    }

    const response = await fetch('/api/admin/restaurants', {
      body: JSON.stringify(body),
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      method: editingRestaurantId ? 'PATCH' : 'POST',
    })

    const payload = (await response.json()) as {
      error?: string
      restaurant?: AdminRestaurant
    }

    if (!response.ok || payload.error || !payload.restaurant) {
      setError(
        payload.error ??
          (editingRestaurantId
            ? 'Failed to update restaurant.'
            : 'Failed to create restaurant.')
      )
      setRestaurantSubmitting(false)
      return
    }

    setSuccess(editingRestaurantId ? 'Restaurant updated.' : 'Restaurant created.')
    setRestaurantSubmitting(false)
    resetRestaurantForm()
    await refreshRestaurants()
  }

  async function createOrUpdateEvent(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSuccess('')
    setSubmitting(true)
    setEmailResult(null)

    const accessToken = await getAccessToken()

    if (!accessToken) {
      setError('Missing active session. Log in again.')
      setSubmitting(false)
      return
    }

    if (!selectedRestaurantId) {
      setError('Choose a restaurant before scheduling an event.')
      setSubmitting(false)
      return
    }

    const body = {
      action: 'update' as EventAction,
      capacity: Number(capacity),
      description,
      durationMinutes: Number(durationMinutes),
      eventId: editingEventId,
      intent,
      minimumViableAttendees: Number(minimumViableAttendees),
      restaurantId: Number(selectedRestaurantId),
      startsAt: new Date(startsAt).toISOString(),
      title,
    }

    const response = await fetch('/api/admin/events', {
      body: JSON.stringify(body),
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      method: editingEventId ? 'PATCH' : 'POST',
    })

    const payload = (await response.json()) as {
      error?: string
      event?: AdminEvent
    }

    if (!response.ok || payload.error || !payload.event) {
      setError(
        payload.error ??
          (editingEventId ? 'Failed to update event.' : 'Failed to create event.')
      )
      setSubmitting(false)
      return
    }

    setSuccess(editingEventId ? 'Event updated.' : 'Event created.')
    setSubmitting(false)
    resetEventForm()
    await Promise.all([refreshEvents(), refreshRestaurants()])
  }

  async function runRestaurantAction(
    restaurantId: number,
    action: RestaurantAction
  ) {
    setError('')
    setSuccess('')
    setRestaurantActionLoadingId(restaurantId)

    const accessToken = await getAccessToken()

    if (!accessToken) {
      setError('Missing active session. Log in again.')
      setRestaurantActionLoadingId(null)
      return
    }

    const response = await fetch('/api/admin/restaurants', {
      body: JSON.stringify({ action, restaurantId }),
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      method: 'PATCH',
    })

    const payload = (await response.json()) as {
      error?: string
    }

    if (!response.ok || payload.error) {
      setError(payload.error ?? 'Could not update restaurant.')
      setRestaurantActionLoadingId(null)
      return
    }

    setSuccess(
      action === 'archive' ? 'Restaurant archived.' : 'Restaurant restored.'
    )
    setRestaurantActionLoadingId(null)

    if (editingRestaurantId === restaurantId) {
      resetRestaurantForm()
    }

    await refreshRestaurants()
  }

  async function deleteRestaurant(restaurant: AdminRestaurant) {
    if (
      !window.confirm(
        `Delete "${restaurant.name}" permanently? This also deletes any events scheduled from it and their signups, notifications, and feedback.`
      )
    ) {
      return
    }

    setError('')
    setSuccess('')
    setRestaurantActionLoadingId(restaurant.id)

    const accessToken = await getAccessToken()

    if (!accessToken) {
      setError('Missing active session. Log in again.')
      setRestaurantActionLoadingId(null)
      return
    }

    const response = await fetch('/api/admin/restaurants', {
      body: JSON.stringify({ restaurantId: restaurant.id }),
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      method: 'DELETE',
    })

    const payload = (await response.json()) as { error?: string }

    if (!response.ok || payload.error) {
      setError(payload.error ?? 'Could not delete restaurant.')
      setRestaurantActionLoadingId(null)
      return
    }

    setSuccess('Restaurant deleted.')
    setRestaurantActionLoadingId(null)

    if (editingRestaurantId === restaurant.id) {
      resetRestaurantForm()
    }

    await refreshRestaurants()
  }

  async function runEventAction(eventId: number, action: EventAction) {
    setError('')
    setSuccess('')
    setEventActionLoadingId(eventId)

    const accessToken = await getAccessToken()

    if (!accessToken) {
      setError('Missing active session. Log in again.')
      setEventActionLoadingId(null)
      return
    }

    const response = await fetch('/api/admin/events', {
      body: JSON.stringify({ action, eventId }),
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      method: 'PATCH',
    })

    const payload = (await response.json()) as {
      error?: string
    }

    if (!response.ok || payload.error) {
      setError(payload.error ?? 'Could not update event state.')
      setEventActionLoadingId(null)
      return
    }

    setSuccess(
      action === 'close'
        ? 'Event closed.'
        : action === 'archive'
          ? 'Event archived.'
          : action === 'unarchive'
            ? 'Event restored from archive.'
        : action === 'force-proceed'
          ? 'Event forced to proceed.'
        : action === 'cancel-low-confirmation'
          ? 'Event cancelled for low confirmations.'
        : action === 'cancel'
          ? 'Event cancelled.'
          : action === 'reopen'
            ? 'Event reopened.'
            : 'Event updated.'
    )
    setEventActionLoadingId(null)

    if (editingEventId === eventId && action !== 'update') {
      resetEventForm()
    }

    await Promise.all([refreshEvents(), refreshRestaurants()])
  }

  async function deleteEvent(event: AdminEvent) {
    if (
      !window.confirm(
        `Delete "${event.title}" permanently? This deletes it even if it has not happened yet, along with its signups, notifications, and feedback.`
      )
    ) {
      return
    }

    setError('')
    setSuccess('')
    setEventActionLoadingId(event.id)

    const accessToken = await getAccessToken()

    if (!accessToken) {
      setError('Missing active session. Log in again.')
      setEventActionLoadingId(null)
      return
    }

    const response = await fetch('/api/admin/events', {
      body: JSON.stringify({ eventId: event.id }),
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      method: 'DELETE',
    })

    const payload = (await response.json()) as {
      error?: string
    }

    if (!response.ok || payload.error) {
      setError(payload.error ?? 'Could not delete event.')
      setEventActionLoadingId(null)
      return
    }

    setSuccess('Event deleted.')
    setEventActionLoadingId(null)

    if (editingEventId === event.id) {
      resetEventForm()
    }

    await Promise.all([refreshEvents(), refreshRestaurants()])
  }

  async function runAttendeeAction(
    eventId: number,
    userId: string,
    action: AttendeeAction
  ) {
    setError('')
    setSuccess('')

    const actionKey = `${eventId}:${userId}:${action}`
    setAttendeeActionKey(actionKey)

    const accessToken = await getAccessToken()

    if (!accessToken) {
      setError('Missing active session. Log in again.')
      setAttendeeActionKey(null)
      return
    }

    const response = await fetch('/api/admin/event-signups', {
      body: JSON.stringify({
        action,
        eventId,
        userId,
      }),
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      method: 'PATCH',
    })

    const payload = (await response.json()) as {
      error?: string
    }

    if (!response.ok || payload.error) {
      setError(payload.error ?? 'Could not update attendee.')
      setAttendeeActionKey(null)
      return
    }

    setSuccess(
      action === 'remove'
        ? 'Attendee removed.'
        : action === 'mark-attended'
          ? 'Attendee marked as attended.'
        : action === 'mark-no-show'
          ? 'Attendee marked as no-show.'
          : 'Attendee reinstated.'
    )
    setAttendeeActionKey(null)
    await refreshEvents()
  }

  async function retryFailedEmails() {
    setRetryingEmails(true)
    setEmailResult(null)
    setError('')

    const accessToken = await getAccessToken()

    if (!accessToken) {
      setError('Missing active session. Log in again.')
      setRetryingEmails(false)
      return
    }

    const response = await fetch('/api/send-notification-emails', {
      body: JSON.stringify({ limit: 40 }),
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      method: 'POST',
    })

    const payload = (await response.json()) as {
      error?: string
      failed?: number
      processed?: number
      sent?: number
      skipped?: number
    }

    if (!response.ok || payload.error) {
      setError(payload.error ?? 'Failed to retry notification emails.')
      setRetryingEmails(false)
      return
    }

    setEmailResult({
      failed: payload.failed ?? 0,
      processed: payload.processed ?? 0,
      sent: payload.sent ?? 0,
      skipped: payload.skipped ?? 0,
    })
    setRetryingEmails(false)
  }

  async function runAutomation() {
    setRunningAutomation(true)
    setAutomationResult(null)
    setError('')

    const accessToken = await getAccessToken()

    if (!accessToken) {
      setError('Missing active session. Log in again.')
      setRunningAutomation(false)
      return
    }

    const response = await fetch('/api/run-event-automation', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      method: 'POST',
    })

    const payload = (await response.json()) as {
      dayConfirmations?: number
      error?: string
      followUps?: number
      reminders24h?: number
      reminders2h?: number
    }

    if (!response.ok || payload.error) {
      setError(payload.error ?? 'Failed to run event automation.')
      setRunningAutomation(false)
      return
    }

    setAutomationResult({
      dayConfirmations: payload.dayConfirmations ?? 0,
      followUps: payload.followUps ?? 0,
      reminders24h: payload.reminders24h ?? 0,
      reminders2h: payload.reminders2h ?? 0,
    })
    setRunningAutomation(false)
  }

  if (loading) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-6xl items-center px-8">
        <p className="text-sm text-zinc-600">Loading admin tools...</p>
      </main>
    )
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-8 py-14">
      <p className="text-sm font-medium uppercase tracking-[0.2em] text-zinc-500">
        Admin
      </p>
      <h1 className="mt-3 text-4xl font-semibold text-zinc-950">
        Build matched venue nights
      </h1>
      <p className="mt-4 max-w-3xl text-base text-zinc-600">
        Logged in as <span className="font-medium text-zinc-950">{email}</span>.
        Restaurants are now the tagged inventory. Events should be scheduled from
        that inventory, not hand-built as disconnected one-offs.
      </p>

      {error ? (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          {success}
        </div>
      ) : null}

      {emailResult ? (
        <div className="mt-6 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
          Email retry processed {emailResult.processed}: sent {emailResult.sent},
          failed {emailResult.failed}, skipped {emailResult.skipped}.
        </div>
      ) : null}

      {automationResult ? (
        <div className="mt-6 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
          Automation queued {automationResult.reminders24h} 24h reminders,{' '}
          {automationResult.reminders2h} 2h reminders,{' '}
          {automationResult.dayConfirmations} same-day confirmations, and{' '}
          {automationResult.followUps} follow-ups.
        </div>
      ) : null}

      {summary ? (
        <section className="mt-8 grid gap-4 md:grid-cols-6">
          <div className="rounded-[1.5rem] border border-zinc-200 bg-zinc-50 p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Events</p>
            <p className="mt-2 text-3xl font-semibold text-zinc-950">
              {summary.totalEvents}
            </p>
            <p className="mt-1 text-sm text-zinc-600">
              {summary.openEvents} currently open
            </p>
          </div>
          <div className="rounded-[1.5rem] border border-zinc-200 bg-zinc-50 p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
              Confirmed / waitlist
            </p>
            <p className="mt-2 text-3xl font-semibold text-zinc-950">
              {summary.totalConfirmed} / {summary.totalWaitlisted}
            </p>
            <p className="mt-1 text-sm text-zinc-600">Active seats vs queue</p>
          </div>
          <div className="rounded-[1.5rem] border border-zinc-200 bg-zinc-50 p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
              Attendance
            </p>
            <p className="mt-2 text-3xl font-semibold text-zinc-950">
              {summary.totalAttended} / {summary.totalNoShows}
            </p>
            <p className="mt-1 text-sm text-zinc-600">Attended vs no-show</p>
          </div>
          <div className="rounded-[1.5rem] border border-zinc-200 bg-zinc-50 p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
              Confirmed today
            </p>
            <p className="mt-2 text-3xl font-semibold text-zinc-950">
              {summary.totalDayConfirmed}
            </p>
            <p className="mt-1 text-sm text-zinc-600">Same-day commitments</p>
          </div>
          <div className="rounded-[1.5rem] border border-zinc-200 bg-zinc-50 p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
              At risk / feedback
            </p>
            <p className="mt-2 text-3xl font-semibold text-zinc-950">
              {summary.totalAtRisk} / {summary.totalFeedback}
            </p>
            <p className="mt-1 text-sm text-zinc-600">Weak events vs feedback rows</p>
          </div>
          <div className="rounded-[1.5rem] border border-zinc-200 bg-zinc-50 p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
              Fill rate
            </p>
            <p className="mt-2 text-3xl font-semibold text-zinc-950">
              {summary.averageFillRate}%
            </p>
            <p className="mt-1 text-sm text-zinc-600">
              {summary.totalDropped} dropped signups
            </p>
          </div>
        </section>
      ) : null}

      <section className="mt-8 rounded-[1.75rem] border border-zinc-200 bg-zinc-50 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-zinc-950">
              {editingRestaurantId ? 'Edit restaurant' : 'Restaurant library'}
            </h2>
            <p className="mt-1 text-sm text-zinc-600">
              Define venue tags once, then schedule matched nights from this inventory.
            </p>
          </div>
          <button
            className="rounded-xl border border-zinc-950 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-zinc-950 hover:text-white"
            onClick={() => setShowArchivedRestaurants((current) => !current)}
            type="button"
          >
            {showArchivedRestaurants ? 'Hide archived restaurants' : 'Show archived restaurants'}
          </button>
        </div>

        <form className="mt-5 grid gap-4 sm:grid-cols-2" onSubmit={createOrUpdateRestaurant}>
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 sm:col-span-2">
            <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
              Google POI import
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              <input
                className="min-w-64 flex-1 rounded-xl border border-zinc-300 px-4 py-3 outline-none transition focus:border-zinc-950"
                onChange={(event) => setPoiSearchQuery(event.target.value)}
                placeholder="Search for a real venue by name or address"
                value={poiSearchQuery}
              />
              <button
                className="rounded-xl border border-zinc-950 px-4 py-3 text-sm font-medium text-zinc-950 transition hover:bg-zinc-950 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-300 disabled:text-zinc-400"
                disabled={poiSearchLoading}
                onClick={() => void searchGooglePois()}
                type="button"
              >
                {poiSearchLoading ? 'Searching...' : 'Search Google'}
              </button>
            </div>
            <p className="mt-2 text-xs text-zinc-500">
              Use this to pull through a real place record, then fix your local matching tags where needed.
            </p>
            {poiResults.length > 0 ? (
              <div className="mt-4 space-y-3">
                {poiResults.map((result) => (
                  <div
                    className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3"
                    key={result.id}
                  >
                    <div>
                      <p className="text-sm font-medium text-zinc-950">{result.name}</p>
                      <p className="mt-1 text-xs text-zinc-600">
                        {result.formattedAddress ?? 'No formatted address'}
                      </p>
                      <p className="mt-1 text-xs text-zinc-600">
                        Rating {result.rating ?? '--'} ({result.userRatingCount ?? 0}) | Price{' '}
                        {result.priceLevel ?? '--'}
                      </p>
                    </div>
                    <button
                      className="rounded-xl bg-zinc-950 px-3 py-2 text-xs font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
                      disabled={poiImportLoadingId === result.id}
                      onClick={() => void importGooglePoi(result.id)}
                      type="button"
                    >
                      {poiImportLoadingId === result.id ? 'Importing...' : 'Import'}
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <label className="space-y-2">
            <span className="text-sm font-medium text-zinc-700">Restaurant name</span>
            <input
              className="w-full rounded-xl border border-zinc-300 px-4 py-3 outline-none transition focus:border-zinc-950"
              onChange={(nextEvent) => setRestaurantName(nextEvent.target.value)}
              placeholder="L'Artusi"
              required
              value={restaurantName}
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-zinc-700">Subregion</span>
            <select
              className="w-full rounded-xl border border-zinc-300 px-4 py-3 outline-none transition focus:border-zinc-950"
              onChange={(nextEvent) =>
                setRestaurantSubregion(
                  nextEvent.target.value as (typeof MANHATTAN_SUBREGIONS)[number]
                )
              }
              value={restaurantSubregion}
            >
              {MANHATTAN_SUBREGIONS.map((subregion) => (
                <option key={subregion} value={subregion}>
                  {subregion}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-zinc-700">Neighbourhood</span>
            <input
              className="w-full rounded-xl border border-zinc-300 px-4 py-3 outline-none transition focus:border-zinc-950"
              onChange={(nextEvent) => setRestaurantNeighbourhood(nextEvent.target.value)}
              placeholder="West Village"
              value={restaurantNeighbourhood}
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-zinc-700">Venue energy</span>
            <select
              className="w-full rounded-xl border border-zinc-300 px-4 py-3 outline-none transition focus:border-zinc-950"
              onChange={(nextEvent) =>
                setVenueEnergy(nextEvent.target.value as (typeof ENERGY_LEVELS)[number])
              }
              value={venueEnergy}
            >
              {ENERGY_LEVELS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-zinc-700">Price band</span>
            <select
              className="w-full rounded-xl border border-zinc-300 px-4 py-3 outline-none transition focus:border-zinc-950"
              onChange={(nextEvent) =>
                setVenuePrice(nextEvent.target.value as (typeof PRICE_TAGS)[number])
              }
              value={venuePrice}
            >
              {PRICE_TAGS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <LocationSearchField
            description="Search the venue street address or neighborhood. Selecting a result fills coordinates and local area."
            label="Venue address search"
            onPick={applyVenueAddressSuggestion}
            placeholder="11 Madison Ave, Flatiron"
            query={venueAddressQuery}
            setQuery={setVenueAddressQuery}
          />

          <label className="space-y-2">
            <span className="text-sm font-medium text-zinc-700">Venue latitude</span>
            <input
              className="w-full rounded-xl border border-zinc-300 px-4 py-3 outline-none transition focus:border-zinc-950"
              onChange={(nextEvent) => setVenueLatitude(nextEvent.target.value)}
              placeholder="40.7321"
              required
              step="any"
              type="number"
              value={venueLatitude}
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-zinc-700">Venue longitude</span>
            <input
              className="w-full rounded-xl border border-zinc-300 px-4 py-3 outline-none transition focus:border-zinc-950"
              onChange={(nextEvent) => setVenueLongitude(nextEvent.target.value)}
              placeholder="-73.9988"
              required
              step="any"
              type="number"
              value={venueLongitude}
            />
          </label>

          <div className="sm:col-span-2">
            <TagPicker
              label="Scene tags"
              onToggle={(value) => setVenueScene((current) => toggleValue(current, value))}
              options={SCENE_TAGS}
              selected={venueScene}
            />
          </div>

          <div className="sm:col-span-2">
            <TagPicker
              label="Crowd tags"
              onToggle={(value) => setVenueCrowd((current) => toggleValue(current, value))}
              options={CROWD_TAGS}
              selected={venueCrowd}
            />
          </div>

          <div className="sm:col-span-2">
            <TagPicker
              label="Music tags"
              onToggle={(value) => setVenueMusic((current) => toggleValue(current, value))}
              options={MUSIC_TAGS}
              selected={venueMusic}
            />
          </div>

          <div className="sm:col-span-2">
            <TagPicker
              label="Setting tags"
              onToggle={(value) => setVenueSetting((current) => toggleValue(current, value))}
              options={SETTING_TAGS}
              selected={venueSetting}
            />
          </div>

          <label className="space-y-2 sm:col-span-2">
            <span className="text-sm font-medium text-zinc-700">Cuisine tags</span>
            <input
              className="w-full rounded-xl border border-zinc-300 px-4 py-3 outline-none transition focus:border-zinc-950"
              onChange={(nextEvent) => setRestaurantCuisines(nextEvent.target.value)}
              placeholder="Italian, Pasta, Wine bar"
              value={restaurantCuisines}
            />
          </label>

          <label className="space-y-2 sm:col-span-2">
            <span className="text-sm font-medium text-zinc-700">Formatted address</span>
            <input
              className="w-full rounded-xl border border-zinc-300 px-4 py-3 outline-none transition focus:border-zinc-950"
              onChange={(event) => setFormattedAddress(event.target.value)}
              placeholder="228 W 10th St, New York, NY 10014, USA"
              value={formattedAddress}
            />
          </label>

          <div className="grid gap-4 sm:col-span-2 sm:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-medium text-zinc-700">Google place ID</span>
              <input
                className="w-full rounded-xl border border-zinc-300 px-4 py-3 outline-none transition focus:border-zinc-950"
                onChange={(event) => setGooglePlaceId(event.target.value)}
                placeholder="ChIJ..."
                value={googlePlaceId}
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-zinc-700">Google Maps URL</span>
              <input
                className="w-full rounded-xl border border-zinc-300 px-4 py-3 outline-none transition focus:border-zinc-950"
                onChange={(event) => setGoogleMapsUri(event.target.value)}
                placeholder="https://maps.google.com/..."
                value={googleMapsUri}
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-zinc-700">Google rating</span>
              <input
                className="w-full rounded-xl border border-zinc-300 px-4 py-3 outline-none transition focus:border-zinc-950"
                onChange={(event) => setGoogleRating(event.target.value)}
                placeholder="4.6"
                step="0.1"
                type="number"
                value={googleRating}
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-zinc-700">Google review count</span>
              <input
                className="w-full rounded-xl border border-zinc-300 px-4 py-3 outline-none transition focus:border-zinc-950"
                onChange={(event) => setGoogleUserRatingsTotal(event.target.value)}
                placeholder="1278"
                type="number"
                value={googleUserRatingsTotal}
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-zinc-700">Google price level</span>
              <input
                className="w-full rounded-xl border border-zinc-300 px-4 py-3 outline-none transition focus:border-zinc-950"
                onChange={(event) => setGooglePriceLevel(event.target.value)}
                placeholder="PRICE_LEVEL_MODERATE"
                value={googlePriceLevel}
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-zinc-700">Phone</span>
              <input
                className="w-full rounded-xl border border-zinc-300 px-4 py-3 outline-none transition focus:border-zinc-950"
                onChange={(event) => setGooglePhoneNumber(event.target.value)}
                placeholder="(212) 555-0100"
                value={googlePhoneNumber}
              />
            </label>
            <label className="space-y-2 sm:col-span-2">
              <span className="text-sm font-medium text-zinc-700">Website</span>
              <input
                className="w-full rounded-xl border border-zinc-300 px-4 py-3 outline-none transition focus:border-zinc-950"
                onChange={(event) => setGoogleWebsiteUri(event.target.value)}
                placeholder="https://..."
                value={googleWebsiteUri}
              />
            </label>
          </div>

          <label className="space-y-2 sm:col-span-2">
            <span className="text-sm font-medium text-zinc-700">Google editorial summary</span>
            <textarea
              className="min-h-24 w-full rounded-xl border border-zinc-300 px-4 py-3 outline-none transition focus:border-zinc-950"
              onChange={(event) => setGoogleEditorialSummary(event.target.value)}
              placeholder="Imported summary from Google"
              value={googleEditorialSummary}
            />
          </label>

          <div className="flex flex-wrap gap-3 sm:col-span-2">
            <button
              className="rounded-xl bg-zinc-950 px-5 py-3 font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
              disabled={restaurantSubmitting}
              type="submit"
            >
              {restaurantSubmitting
                ? editingRestaurantId
                  ? 'Updating restaurant...'
                  : 'Creating restaurant...'
                : editingRestaurantId
                  ? 'Update restaurant'
                  : 'Add restaurant'}
            </button>
            {editingRestaurantId ? (
              <button
                className="rounded-xl border border-zinc-950 px-5 py-3 font-medium text-zinc-950 transition hover:bg-zinc-950 hover:text-white"
                onClick={resetRestaurantForm}
                type="button"
              >
                Cancel edit
              </button>
            ) : null}
            <button
              className="rounded-xl border border-zinc-950 px-5 py-3 font-medium text-zinc-950 transition hover:bg-zinc-950 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-300 disabled:text-zinc-400"
              disabled={retryingEmails}
              onClick={() => void retryFailedEmails()}
              type="button"
            >
              {retryingEmails ? 'Retrying emails...' : 'Retry failed emails'}
            </button>
            <button
              className="rounded-xl border border-zinc-950 px-5 py-3 font-medium text-zinc-950 transition hover:bg-zinc-950 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-300 disabled:text-zinc-400"
              disabled={runningAutomation}
              onClick={() => void runAutomation()}
              type="button"
            >
              {runningAutomation ? 'Running automation...' : 'Run reminders now'}
            </button>
          </div>
        </form>

        <div className="mt-6 grid gap-4">
          {visibleRestaurants.length > 0 ? (
            visibleRestaurants.map((restaurant) => (
              <article
                className="rounded-[1.5rem] border border-zinc-200 bg-white p-5"
                key={restaurant.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-zinc-950">{restaurant.name}</h3>
                    <p className="mt-1 text-sm text-zinc-700">
                      {restaurant.subregion}
                      {restaurant.neighbourhood ? `, ${restaurant.neighbourhood}` : ''}
                    </p>
                    <p className="mt-1 text-sm text-zinc-600">
                      Energy {restaurant.venue_energy ?? '--'} | Price {restaurant.venue_price ?? '--'}
                    </p>
                    <p className="mt-1 text-sm text-zinc-600">
                      Scene {restaurant.venue_scene.join(', ')} | Crowd {restaurant.venue_crowd.join(', ')}
                    </p>
                    <p className="mt-1 text-sm text-zinc-600">
                      Music {restaurant.venue_music.join(', ')} | Setting {restaurant.venue_setting.join(', ')}
                    </p>
                    {restaurant.cuisines.length ? (
                      <p className="mt-1 text-sm text-zinc-600">
                        Cuisine {restaurant.cuisines.join(', ')}
                      </p>
                    ) : null}
                    {restaurant.google_rating !== null ? (
                      <p className="mt-1 text-sm text-zinc-600">
                        Google rating {restaurant.google_rating} ({restaurant.google_user_ratings_total ?? 0} reviews)
                      </p>
                    ) : null}
                    {restaurant.formatted_address ? (
                      <p className="mt-1 text-sm text-zinc-600">
                        {restaurant.formatted_address}
                      </p>
                    ) : null}
                    {restaurant.archived_at ? (
                      <p className="mt-1 text-sm font-medium text-zinc-950">
                        Archived from scheduling
                      </p>
                    ) : null}
                  </div>
                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
                    <p>Total events: {restaurant.eventCount}</p>
                    <p className="mt-1">Upcoming: {restaurant.upcomingEventCount}</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    className="rounded-xl border border-zinc-950 px-3 py-2 text-xs font-medium text-zinc-950 transition hover:bg-zinc-950 hover:text-white"
                    onClick={() => loadRestaurantForEdit(restaurant)}
                    type="button"
                  >
                    Edit
                  </button>
                  {restaurant.archived_at ? (
                    <button
                      className="rounded-xl border border-zinc-950 px-3 py-2 text-xs font-medium text-zinc-950 transition hover:bg-zinc-950 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-300 disabled:text-zinc-400"
                      disabled={restaurantActionLoadingId === restaurant.id}
                      onClick={() => void runRestaurantAction(restaurant.id, 'unarchive')}
                      type="button"
                    >
                      {restaurantActionLoadingId === restaurant.id ? 'Working...' : 'Restore'}
                    </button>
                  ) : (
                    <button
                      className="rounded-xl border border-zinc-950 px-3 py-2 text-xs font-medium text-zinc-950 transition hover:bg-zinc-950 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-300 disabled:text-zinc-400"
                      disabled={restaurantActionLoadingId === restaurant.id}
                      onClick={() => void runRestaurantAction(restaurant.id, 'archive')}
                      type="button"
                    >
                      {restaurantActionLoadingId === restaurant.id ? 'Working...' : 'Archive'}
                    </button>
                  )}
                  <button
                    className="rounded-xl border border-red-300 px-3 py-2 text-xs font-medium text-red-700 transition hover:bg-red-600 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-300 disabled:text-zinc-400"
                    disabled={restaurantActionLoadingId === restaurant.id}
                    onClick={() => void deleteRestaurant(restaurant)}
                    type="button"
                  >
                    {restaurantActionLoadingId === restaurant.id ? 'Working...' : 'Delete'}
                  </button>
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-[1.5rem] border border-zinc-200 bg-white p-6 text-sm text-zinc-600">
              No restaurants yet. Build the venue library first.
            </div>
          )}
        </div>
      </section>

      <section className="mt-8 rounded-[1.75rem] border border-zinc-200 bg-zinc-50 p-6">
        <h2 className="text-xl font-semibold text-zinc-950">
          {editingEventId ? 'Edit event' : 'Schedule event'}
        </h2>
        <p className="mt-1 text-sm text-zinc-600">
          Events are now scheduled from restaurant records. The event stores a snapshot of the selected venue tags so later restaurant edits do not rewrite past match logic.
        </p>
        <form className="mt-5 grid gap-4 sm:grid-cols-2" onSubmit={createOrUpdateEvent}>
          <label className="space-y-2 sm:col-span-2">
            <span className="text-sm font-medium text-zinc-700">Restaurant</span>
            <select
              className="w-full rounded-xl border border-zinc-300 px-4 py-3 outline-none transition focus:border-zinc-950"
              onChange={(nextEvent) => setSelectedRestaurantId(nextEvent.target.value)}
              required
              value={selectedRestaurantId}
            >
              <option value="">Select a restaurant</option>
              {restaurants
                .filter(
                  (restaurant) =>
                    restaurant.archived_at === null || restaurant.id === Number(selectedRestaurantId)
                )
                .map((restaurant) => (
                  <option key={restaurant.id} value={restaurant.id}>
                    {restaurant.name} - {restaurant.subregion}
                    {restaurant.neighbourhood ? `, ${restaurant.neighbourhood}` : ''}
                  </option>
                ))}
            </select>
          </label>

          {selectedRestaurant ? (
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 sm:col-span-2">
              <p className="text-sm font-medium text-zinc-950">{selectedRestaurant.name}</p>
              <p className="mt-1 text-sm text-zinc-600">
                {selectedRestaurant.subregion}
                {selectedRestaurant.neighbourhood
                  ? `, ${selectedRestaurant.neighbourhood}`
                  : ''}
              </p>
              <p className="mt-2 text-sm text-zinc-600">
                Energy {selectedRestaurant.venue_energy ?? '--'} | Price{' '}
                {selectedRestaurant.venue_price ?? '--'}
              </p>
              <p className="mt-1 text-sm text-zinc-600">
                Scene {selectedRestaurant.venue_scene.join(', ')} | Crowd{' '}
                {selectedRestaurant.venue_crowd.join(', ')}
              </p>
              <p className="mt-1 text-sm text-zinc-600">
                Music {selectedRestaurant.venue_music.join(', ')} | Setting{' '}
                {selectedRestaurant.venue_setting.join(', ')}
              </p>
            </div>
          ) : null}

          <label className="space-y-2 sm:col-span-2">
            <span className="text-sm font-medium text-zinc-700">Event title</span>
            <input
              className="w-full rounded-xl border border-zinc-300 px-4 py-3 outline-none transition focus:border-zinc-950"
              onChange={(nextEvent) => setTitle(nextEvent.target.value)}
              placeholder="Wednesday West Village Supper Club"
              required
              value={title}
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-zinc-700">Intent</span>
            <select
              className="w-full rounded-xl border border-zinc-300 px-4 py-3 outline-none transition focus:border-zinc-950"
              onChange={(nextEvent) => setIntent(nextEvent.target.value as EventIntent)}
              value={intent}
            >
              <option value="dating">Dating</option>
              <option value="friendship">Friendship</option>
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-zinc-700">Starts at</span>
            <input
              className="w-full rounded-xl border border-zinc-300 px-4 py-3 outline-none transition focus:border-zinc-950"
              onChange={(nextEvent) => setStartsAt(nextEvent.target.value)}
              required
              type="datetime-local"
              value={startsAt}
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-zinc-700">Capacity</span>
            <input
              className="w-full rounded-xl border border-zinc-300 px-4 py-3 outline-none transition focus:border-zinc-950"
              min={2}
              onChange={(nextEvent) => setCapacity(nextEvent.target.value)}
              required
              type="number"
              value={capacity}
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-zinc-700">Minimum viable attendees</span>
            <input
              className="w-full rounded-xl border border-zinc-300 px-4 py-3 outline-none transition focus:border-zinc-950"
              min={2}
              onChange={(nextEvent) => setMinimumViableAttendees(nextEvent.target.value)}
              required
              type="number"
              value={minimumViableAttendees}
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-zinc-700">Duration</span>
            <input
              className="w-full rounded-xl border border-zinc-300 px-4 py-3 outline-none transition focus:border-zinc-950"
              max={360}
              min={30}
              onChange={(nextEvent) => setDurationMinutes(nextEvent.target.value)}
              required
              type="number"
              value={durationMinutes}
            />
          </label>

          <label className="space-y-2 sm:col-span-2">
            <span className="text-sm font-medium text-zinc-700">Description</span>
            <textarea
              className="min-h-24 w-full rounded-xl border border-zinc-300 px-4 py-3 outline-none transition focus:border-zinc-950"
              onChange={(nextEvent) => setDescription(nextEvent.target.value)}
              placeholder="Optional context shown on the dashboard."
              value={description}
            />
          </label>

          <div className="flex flex-wrap gap-3 sm:col-span-2">
            <button
              className="rounded-xl bg-zinc-950 px-5 py-3 font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
              disabled={submitting}
              type="submit"
            >
              {submitting
                ? editingEventId
                  ? 'Updating event...'
                  : 'Creating event...'
                : editingEventId
                  ? 'Update event'
                  : 'Create event'}
            </button>
            {editingEventId ? (
              <button
                className="rounded-xl border border-zinc-950 px-5 py-3 font-medium text-zinc-950 transition hover:bg-zinc-950 hover:text-white"
                onClick={resetEventForm}
                type="button"
              >
                Cancel edit
              </button>
            ) : null}
          </div>
        </form>
      </section>

      <section className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-zinc-500">
              {showArchived ? 'All events' : 'Active events'}
            </p>
            <p className="mt-1 text-sm text-zinc-600">
              Archived past events are hidden from this list by default.
            </p>
          </div>
          <button
            className="rounded-xl border border-zinc-950 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-zinc-950 hover:text-white"
            onClick={() => setShowArchived((current) => !current)}
            type="button"
          >
            {showArchived ? 'Hide archived' : 'Show archived'}
          </button>
        </div>
        <div className="mt-4 grid gap-4">
          {events.length > 0 ? (
            events.map((event) => (
              <article
                className="rounded-[1.5rem] border border-zinc-200 bg-zinc-50 p-6"
                key={event.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-sm uppercase tracking-[0.2em] text-zinc-500">
                      {formatIntent(event.intent)}
                    </p>
                    <h3 className="mt-2 text-2xl font-semibold text-zinc-950">
                      {event.title}
                    </h3>
                    <p className="mt-2 text-sm text-zinc-700">
                      {event.restaurant_name} - {event.restaurant_subregion}
                      {event.restaurant_neighbourhood
                        ? `, ${event.restaurant_neighbourhood}`
                        : ''}
                    </p>
                    <p className="mt-1 text-sm text-zinc-700">
                      {formatEventDate(event.starts_at)}
                    </p>
                    <p className="mt-1 text-sm text-zinc-600">
                      Duration: {event.duration_minutes} minutes
                    </p>
                    <p className="mt-1 text-sm text-zinc-600">
                      Energy {event.venue_energy ?? '--'} | Price {event.venue_price ?? '--'}
                    </p>
                    <p className="mt-1 text-sm text-zinc-600">
                      Scene {event.venue_scene.join(', ')} | Crowd {event.venue_crowd.join(', ')}
                    </p>
                    <p className="mt-1 text-sm text-zinc-600">
                      Music {event.venue_music.join(', ')} | Setting {event.venue_setting.join(', ')}
                    </p>
                    {event.archived_at ? (
                      <p className="mt-1 text-sm font-medium text-zinc-950">
                        Archived {formatEventDate(event.archived_at)}
                      </p>
                    ) : null}
                    {event.restaurant_cuisines?.length ? (
                      <p className="mt-1 text-sm text-zinc-600">
                        {event.restaurant_cuisines.join(', ')}
                      </p>
                    ) : null}
                  </div>
                  <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700">
                    <p>
                      Attendees:{' '}
                      <span className="font-medium text-zinc-950">
                        {event.attendeeCount}/{event.capacity}
                      </span>
                    </p>
                    <p className="mt-1">
                      Status:{' '}
                      <span className="font-medium text-zinc-950">{event.status}</span>
                    </p>
                    <p className="mt-1">
                      Archive:{' '}
                      <span className="font-medium text-zinc-950">
                        {event.archived_at ? 'Archived' : 'Visible'}
                      </span>
                    </p>
                    <p className="mt-1">
                      Waitlist:{' '}
                      <span className="font-medium text-zinc-950">{event.waitlistCount}</span>
                    </p>
                    <p className="mt-1">
                      Today confirmed:{' '}
                      <span className="font-medium text-zinc-950">
                        {event.confirmedTodayCount}/{event.minimum_viable_attendees}
                      </span>
                    </p>
                    <p className="mt-1">
                      Health:{' '}
                      <span className="font-medium text-zinc-950">
                        {formatViabilityStatus(event.viability_status)}
                      </span>
                    </p>
                  </div>
                </div>
                {event.description ? (
                  <p className="mt-4 text-sm leading-7 text-zinc-600">
                    {event.description}
                  </p>
                ) : null}
                {event.viability_status === 'at_risk' ? (
                  <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                    This event is below its same-day viable threshold. Decide whether to
                    force it through or kill it cleanly rather than letting people guess.
                  </div>
                ) : null}
                <div className="mt-4 grid gap-3 md:grid-cols-6">
                  <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700">
                    <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">
                      Confirmed
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-zinc-950">
                      {event.attendeeCount}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700">
                    <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">
                      Waitlist
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-zinc-950">
                      {event.waitlistCount}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700">
                    <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">
                      Confirmed today
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-zinc-950">
                      {event.confirmedTodayCount}/{event.minimum_viable_attendees}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700">
                    <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">
                      Attended / no-show
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-zinc-950">
                      {event.attendedCount} / {event.noShowCount}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700">
                    <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">
                      Dropped
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-zinc-950">
                      {event.dropoffCount}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700">
                    <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">
                      Feedback
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-zinc-950">
                      {event.feedback_count}
                    </p>
                    <p className="mt-1 text-xs text-zinc-600">
                      Venue {event.average_venue_rating ?? '--'} / Group{' '}
                      {event.average_group_rating ?? '--'}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    className="rounded-xl border border-zinc-950 px-3 py-2 text-xs font-medium text-zinc-950 transition hover:bg-zinc-950 hover:text-white"
                    onClick={() => loadEventForEdit(event)}
                    type="button"
                  >
                    Edit
                  </button>
                  {event.status === 'open' ? (
                    <>
                      <button
                        className="rounded-xl border border-zinc-950 px-3 py-2 text-xs font-medium text-zinc-950 transition hover:bg-zinc-950 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-300 disabled:text-zinc-400"
                        disabled={eventActionLoadingId === event.id}
                        onClick={() => void runEventAction(event.id, 'close')}
                        type="button"
                      >
                        {eventActionLoadingId === event.id ? 'Working...' : 'Close'}
                      </button>
                      <button
                        className="rounded-xl border border-red-300 px-3 py-2 text-xs font-medium text-red-700 transition hover:bg-red-600 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-300 disabled:text-zinc-400"
                        disabled={eventActionLoadingId === event.id}
                        onClick={() => void runEventAction(event.id, 'cancel')}
                        type="button"
                      >
                        {eventActionLoadingId === event.id ? 'Working...' : 'Cancel'}
                      </button>
                      <button
                        className="rounded-xl border border-amber-300 px-3 py-2 text-xs font-medium text-amber-800 transition hover:bg-amber-600 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-300 disabled:text-zinc-400"
                        disabled={eventActionLoadingId === event.id}
                        onClick={() => void runEventAction(event.id, 'force-proceed')}
                        type="button"
                      >
                        {eventActionLoadingId === event.id ? 'Working...' : 'Force proceed'}
                      </button>
                      <button
                        className="rounded-xl border border-red-300 px-3 py-2 text-xs font-medium text-red-700 transition hover:bg-red-600 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-300 disabled:text-zinc-400"
                        disabled={eventActionLoadingId === event.id}
                        onClick={() =>
                          void runEventAction(event.id, 'cancel-low-confirmation')
                        }
                        type="button"
                      >
                        {eventActionLoadingId === event.id
                          ? 'Working...'
                          : 'Cancel for low confirmations'}
                      </button>
                    </>
                  ) : (
                    <button
                      className="rounded-xl border border-zinc-950 px-3 py-2 text-xs font-medium text-zinc-950 transition hover:bg-zinc-950 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-300 disabled:text-zinc-400"
                      disabled={eventActionLoadingId === event.id}
                      onClick={() => void runEventAction(event.id, 'reopen')}
                      type="button"
                    >
                      {eventActionLoadingId === event.id ? 'Working...' : 'Reopen'}
                    </button>
                  )}
                  {hasAdminEventEnded(event) ? (
                    event.archived_at ? (
                      <button
                        className="rounded-xl border border-zinc-950 px-3 py-2 text-xs font-medium text-zinc-950 transition hover:bg-zinc-950 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-300 disabled:text-zinc-400"
                        disabled={eventActionLoadingId === event.id}
                        onClick={() => void runEventAction(event.id, 'unarchive')}
                        type="button"
                      >
                        {eventActionLoadingId === event.id
                          ? 'Working...'
                          : 'Restore from archive'}
                      </button>
                    ) : (
                      <button
                        className="rounded-xl border border-zinc-950 px-3 py-2 text-xs font-medium text-zinc-950 transition hover:bg-zinc-950 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-300 disabled:text-zinc-400"
                        disabled={eventActionLoadingId === event.id}
                        onClick={() => void runEventAction(event.id, 'archive')}
                        type="button"
                      >
                        {eventActionLoadingId === event.id ? 'Working...' : 'Archive'}
                      </button>
                    )
                  ) : null}
                  {hasAdminEventEnded(event) ? (
                    <button
                      className="rounded-xl border border-red-300 px-3 py-2 text-xs font-medium text-red-700 transition hover:bg-red-600 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-300 disabled:text-zinc-400"
                      disabled={eventActionLoadingId === event.id}
                      onClick={() => void deleteEvent(event)}
                      type="button"
                    >
                      {eventActionLoadingId === event.id ? 'Working...' : 'Delete'}
                    </button>
                  ) : null}
                </div>
                <div className="mt-5 rounded-2xl border border-zinc-200 bg-white p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                    Attendee roster
                  </p>
                  <p className="mt-2 text-sm text-zinc-600">
                    Same-day confirmations are visible here. If confirmed today drops
                    below the viable threshold, remaining attendees can still choose to
                    leave from their dashboard.
                  </p>
                  <div className="mt-3 space-y-3">
                    {event.attendees.length > 0 ? (
                      event.attendees.map((attendee) => (
                        <div
                          className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4"
                          key={attendee.user_id}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-zinc-950">
                                {attendee.display_name ?? 'Unnamed user'}
                              </p>
                              <p className="mt-1 text-sm text-zinc-600">
                                {attendee.subregion ?? 'Unknown area'}
                                {attendee.neighbourhood
                                  ? `, ${attendee.neighbourhood}`
                                  : ''}
                              </p>
                              <p className="mt-1 text-xs text-zinc-500">
                                {attendee.email ?? 'No email'}
                              </p>
                            </div>
                            <div className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-700">
                              <p>
                                Status:{' '}
                                <span className="font-medium text-zinc-950">
                                  {formatSignupStatus(attendee.signup_status)}
                                </span>
                              </p>
                              <p className="mt-1">
                                Day-of:{' '}
                                <span className="font-medium text-zinc-950">
                                  {formatDayConfirmationStatus(
                                    attendee.day_of_confirmation_status
                                  )}
                                </span>
                              </p>
                              <p className="mt-1">
                                Restaurant score:{' '}
                                <span className="font-medium text-zinc-950">
                                  {attendee.restaurant_match_score}
                                </span>
                              </p>
                              <p className="mt-1">
                                Personal score:{' '}
                                <span className="font-medium text-zinc-950">
                                  {attendee.personal_match_score}
                                </span>
                              </p>
                            </div>
                          </div>
                          {attendee.cuisine_preferences?.length ? (
                            <p className="mt-3 text-sm text-zinc-600">
                              Cuisine prefs: {attendee.cuisine_preferences.join(', ')}
                            </p>
                          ) : null}
                          {attendee.personal_match_summary ? (
                            <p className="mt-2 text-sm text-zinc-600">
                              {attendee.personal_match_summary}
                            </p>
                          ) : null}
                          <div className="mt-3 flex flex-wrap gap-2">
                            {['going', 'waitlisted'].includes(attendee.signup_status) ? (
                              <>
                                {hasEventStarted(event.starts_at) ? (
                                  attendee.signup_status === 'going' ? (
                                    <>
                                      <button
                                        className="rounded-xl border border-zinc-950 px-3 py-2 text-xs font-medium text-zinc-950 transition hover:bg-zinc-950 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-300 disabled:text-zinc-400"
                                        disabled={
                                          attendeeActionKey ===
                                          `${event.id}:${attendee.user_id}:mark-attended`
                                        }
                                        onClick={() =>
                                          void runAttendeeAction(
                                            event.id,
                                            attendee.user_id,
                                            'mark-attended'
                                          )
                                        }
                                        type="button"
                                      >
                                        {attendeeActionKey ===
                                        `${event.id}:${attendee.user_id}:mark-attended`
                                          ? 'Working...'
                                          : 'Mark attended'}
                                      </button>
                                      <button
                                        className="rounded-xl border border-zinc-950 px-3 py-2 text-xs font-medium text-zinc-950 transition hover:bg-zinc-950 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-300 disabled:text-zinc-400"
                                        disabled={
                                          attendeeActionKey ===
                                          `${event.id}:${attendee.user_id}:mark-no-show`
                                        }
                                        onClick={() =>
                                          void runAttendeeAction(
                                            event.id,
                                            attendee.user_id,
                                            'mark-no-show'
                                          )
                                        }
                                        type="button"
                                      >
                                        {attendeeActionKey ===
                                        `${event.id}:${attendee.user_id}:mark-no-show`
                                          ? 'Working...'
                                          : 'Mark no-show'}
                                      </button>
                                    </>
                                  ) : null
                                ) : null}
                                <button
                                  className="rounded-xl border border-red-300 px-3 py-2 text-xs font-medium text-red-700 transition hover:bg-red-600 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-300 disabled:text-zinc-400"
                                  disabled={
                                    attendeeActionKey ===
                                    `${event.id}:${attendee.user_id}:remove`
                                  }
                                  onClick={() =>
                                    void runAttendeeAction(
                                      event.id,
                                      attendee.user_id,
                                      'remove'
                                    )
                                  }
                                  type="button"
                                >
                                  {attendeeActionKey ===
                                  `${event.id}:${attendee.user_id}:remove`
                                    ? 'Working...'
                                    : 'Remove'}
                                </button>
                              </>
                            ) : attendee.signup_status !== 'attended' ? (
                              <button
                                className="rounded-xl border border-zinc-950 px-3 py-2 text-xs font-medium text-zinc-950 transition hover:bg-zinc-950 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-300 disabled:text-zinc-400"
                                disabled={
                                  attendeeActionKey ===
                                  `${event.id}:${attendee.user_id}:restore`
                                }
                                onClick={() =>
                                  void runAttendeeAction(
                                    event.id,
                                    attendee.user_id,
                                    'restore'
                                  )
                                }
                                type="button"
                              >
                                {attendeeActionKey ===
                                `${event.id}:${attendee.user_id}:restore`
                                  ? 'Working...'
                                  : 'Reinstate'}
                              </button>
                            ) : null}
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-zinc-600">No attendees yet.</p>
                    )}
                  </div>
                </div>
                <div className="mt-5 rounded-2xl border border-zinc-200 bg-white p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                    Feedback summary
                  </p>
                  <p className="mt-2 text-sm text-zinc-600">
                    Venue score: <span className="font-medium text-zinc-950">
                      {event.average_venue_rating ?? '--'}
                    </span>{' '}
                    | Group score:{' '}
                    <span className="font-medium text-zinc-950">
                      {event.average_group_rating ?? '--'}
                    </span>{' '}
                    | Would join again:{' '}
                    <span className="font-medium text-zinc-950">
                      {event.feedback_count > 0
                        ? `${event.would_join_again_count}/${event.feedback_count}`
                        : '--'}
                    </span>
                  </p>
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-[1.5rem] border border-zinc-200 bg-zinc-50 p-6 text-sm text-zinc-600">
              No events yet. Schedule one from the restaurant library.
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
