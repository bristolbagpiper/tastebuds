import { type ManhattanSubregion } from '@/lib/events'

export const MIDTOWN_CUTOFF_LATITUDE = 40.7549
export const UPTOWN_CUTOFF_LATITUDE = 40.8012

const MANHATTAN_LOCATION_RESTRICTION = {
  rectangle: {
    high: {
      latitude: 40.882,
      longitude: -73.9067,
    },
    low: {
      latitude: 40.6829,
      longitude: -74.0479,
    },
  },
}

type GoogleAutocompleteSuggestion = {
  placePrediction?: {
    place?: string
    placeId?: string
    structuredFormat?: {
      mainText?: { text?: string }
      secondaryText?: { text?: string }
    }
    text?: {
      text?: string
    }
  }
}

type GoogleAutocompleteResponse = {
  suggestions?: GoogleAutocompleteSuggestion[]
}

type GooglePlaceDetailsResponse = {
  addressComponents?: {
    longText?: string
    shortText?: string
    types?: string[]
  }[]
  displayName?: { text?: string }
  formattedAddress?: string
  location?: {
    latitude?: number
    longitude?: number
  }
}

export type LocationSearchSuggestion = {
  featureType: string
  label: string
  latitude: number
  longitude: number
  neighbourhood: string | null
  secondaryLabel: string | null
  subregion: ManhattanSubregion
}

function normalizeText(value: string | null | undefined) {
  return value?.trim() || null
}

function normalizeNeighbourhood(value: string | null | undefined) {
  const normalized = normalizeText(value)

  if (!normalized) {
    return null
  }

  if (['manhattan', 'new york', 'new york county'].includes(normalized.toLowerCase())) {
    return null
  }

  return normalized
}

function getAddressTokens(components: GooglePlaceDetailsResponse['addressComponents']) {
  return new Set(
    (components ?? [])
      .flatMap((component) => [component.longText, component.shortText])
      .map((value) => value?.trim().toLowerCase())
      .filter((value): value is string => Boolean(value))
  )
}

function isManhattanPlace(placePayload: GooglePlaceDetailsResponse) {
  const tokens = getAddressTokens(placePayload.addressComponents)
  return tokens.has('manhattan') || tokens.has('new york county')
}

export function inferManhattanSubregion(latitude: number): ManhattanSubregion {
  if (latitude >= UPTOWN_CUTOFF_LATITUDE) {
    return 'Uptown'
  }

  if (latitude >= MIDTOWN_CUTOFF_LATITUDE) {
    return 'Midtown'
  }

  return 'Downtown'
}

function getGoogleMapsApiKey() {
  const value = process.env.GOOGLE_MAPS_API_KEY

  if (!value) {
    return null
  }

  return value
}

async function googleLocationFetch<T>(
  url: string,
  init: RequestInit & { fieldMask: string }
) {
  const apiKey = getGoogleMapsApiKey()

  if (!apiKey) {
    throw new Error('Missing required environment variable: GOOGLE_MAPS_API_KEY')
  }

  const response = await fetch(url, {
    ...init,
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': init.fieldMask,
      ...(init.headers ?? {}),
    },
  })

  const payload = (await response.json()) as T & { error?: { message?: string } }

  if (!response.ok) {
    throw new Error(payload.error?.message ?? 'Location search failed.')
  }

  return payload
}

export async function searchLocationSuggestions(query: string) {
  const payload = await googleLocationFetch<GoogleAutocompleteResponse>(
    'https://places.googleapis.com/v1/places:autocomplete',
    {
      body: JSON.stringify({
        includeQueryPredictions: false,
        includedRegionCodes: ['us'],
        input: query,
        languageCode: 'en',
        locationRestriction: MANHATTAN_LOCATION_RESTRICTION,
        regionCode: 'US',
      }),
      fieldMask:
        'suggestions.placePrediction.place,suggestions.placePrediction.placeId,suggestions.placePrediction.text.text,suggestions.placePrediction.structuredFormat.mainText.text,suggestions.placePrediction.structuredFormat.secondaryText.text',
      method: 'POST',
    }
  )

  const predictions = (payload.suggestions ?? [])
    .map((suggestion) => suggestion.placePrediction)
    .filter(
      (prediction): prediction is NonNullable<GoogleAutocompleteSuggestion['placePrediction']> =>
        Boolean(prediction?.placeId)
    )
    .slice(0, 5)

  const details = await Promise.all(
    predictions.map(async (prediction) => {
      const placeId = prediction.placeId as string
      const placePayload = await googleLocationFetch<GooglePlaceDetailsResponse>(
        `https://places.googleapis.com/v1/places/${placeId}`,
        {
          fieldMask:
            'displayName,formattedAddress,location,addressComponents',
          method: 'GET',
        }
      )

      const latitude = placePayload.location?.latitude
      const longitude = placePayload.location?.longitude

      if (
        typeof latitude !== 'number' ||
        !Number.isFinite(latitude) ||
        typeof longitude !== 'number' ||
        !Number.isFinite(longitude)
      ) {
        return null
      }

      if (!isManhattanPlace(placePayload)) {
        return null
      }

      const neighbourhood =
        placePayload.addressComponents?.find((component) =>
          component.types?.some((type) =>
            ['neighborhood', 'sublocality', 'sublocality_level_1'].includes(type)
          )
        )?.longText ?? null

      const label =
        normalizeText(placePayload.formattedAddress) ??
        normalizeText(prediction.text?.text) ??
        normalizeText(placePayload.displayName?.text)

      if (!label) {
        return null
      }

      return {
        featureType: 'place',
        label,
        latitude,
        longitude,
        neighbourhood: normalizeNeighbourhood(neighbourhood),
        secondaryLabel:
          normalizeText(prediction.structuredFormat?.secondaryText?.text) ??
          normalizeText(placePayload.displayName?.text),
        subregion: inferManhattanSubregion(latitude),
      } satisfies LocationSearchSuggestion
    })
  )

  return details.filter((suggestion): suggestion is LocationSearchSuggestion => suggestion !== null)
}
