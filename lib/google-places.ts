import 'server-only'

type GoogleTextSearchPlace = {
  displayName?: { text?: string }
  formattedAddress?: string
  googleMapsUri?: string
  id?: string
  location?: { latitude?: number; longitude?: number }
  nationalPhoneNumber?: string
  priceLevel?: string
  rating?: number
  regularOpeningHours?: {
    openNow?: boolean
    weekdayDescriptions?: string[]
  }
  userRatingCount?: number
  websiteUri?: string
}

type GoogleTextSearchResponse = {
  places?: GoogleTextSearchPlace[]
}

type GooglePlaceDetails = GoogleTextSearchPlace & {
  editorialSummary?: { text?: string }
  googleMapsUri?: string
}

function getGooglePlacesApiKey() {
  const value = process.env.GOOGLE_MAPS_API_KEY

  if (!value) {
    throw new Error('Missing required environment variable: GOOGLE_MAPS_API_KEY')
  }

  return value
}

async function googlePlacesFetch<T>(
  url: string,
  init: RequestInit & { fieldMask: string }
) {
  const response = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': getGooglePlacesApiKey(),
      'X-Goog-FieldMask': init.fieldMask,
      ...(init.headers ?? {}),
    },
    cache: 'no-store',
  })

  const payload = (await response.json()) as T & { error?: { message?: string } }

  if (!response.ok) {
    throw new Error(payload.error?.message ?? 'Google Places request failed.')
  }

  return payload
}

export type GooglePoiSearchSuggestion = {
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

export async function searchRestaurantPois(query: string) {
  const payload = await googlePlacesFetch<GoogleTextSearchResponse>(
    'https://places.googleapis.com/v1/places:searchText',
    {
      body: JSON.stringify({
        includedType: 'restaurant',
        languageCode: 'en',
        maxResultCount: 6,
        regionCode: 'US',
        textQuery: query,
      }),
      fieldMask:
        'places.id,places.displayName,places.formattedAddress,places.location,places.googleMapsUri,places.nationalPhoneNumber,places.priceLevel,places.rating,places.regularOpeningHours.openNow,places.userRatingCount,places.websiteUri',
      method: 'POST',
    }
  )

  return (payload.places ?? [])
    .filter((place) => place.id && place.displayName?.text)
    .map((place) => ({
      formattedAddress: place.formattedAddress ?? null,
      googleMapsUri: place.googleMapsUri ?? null,
      id: place.id as string,
      latitude: place.location?.latitude ?? null,
      longitude: place.location?.longitude ?? null,
      name: place.displayName?.text as string,
      openNow: place.regularOpeningHours?.openNow ?? null,
      phoneNumber: place.nationalPhoneNumber ?? null,
      priceLevel: place.priceLevel ?? null,
      rating: place.rating ?? null,
      userRatingCount: place.userRatingCount ?? null,
      websiteUri: place.websiteUri ?? null,
    }))
}

export async function getRestaurantPoiDetails(placeId: string) {
  const payload = await googlePlacesFetch<GooglePlaceDetails>(
    `https://places.googleapis.com/v1/places/${placeId}`,
    {
      fieldMask:
        'id,displayName,editorialSummary,formattedAddress,googleMapsUri,location,nationalPhoneNumber,priceLevel,rating,regularOpeningHours.openNow,regularOpeningHours.weekdayDescriptions,userRatingCount,websiteUri',
      method: 'GET',
    }
  )

  return {
    editorialSummary: payload.editorialSummary?.text ?? null,
    formattedAddress: payload.formattedAddress ?? null,
    googleMapsUri: payload.googleMapsUri ?? null,
    id: payload.id ?? placeId,
    latitude: payload.location?.latitude ?? null,
    longitude: payload.location?.longitude ?? null,
    name: payload.displayName?.text ?? null,
    openNow: payload.regularOpeningHours?.openNow ?? null,
    openingHours: payload.regularOpeningHours?.weekdayDescriptions ?? [],
    phoneNumber: payload.nationalPhoneNumber ?? null,
    priceLevel: payload.priceLevel ?? null,
    rating: payload.rating ?? null,
    userRatingCount: payload.userRatingCount ?? null,
    websiteUri: payload.websiteUri ?? null,
  }
}
