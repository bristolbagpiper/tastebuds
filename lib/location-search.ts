import {
  type ManhattanSubregion,
} from '@/lib/events'

export const MANHATTAN_BBOX = '-74.0479,40.6829,-73.9067,40.8820'
export const MIDTOWN_CUTOFF_LATITUDE = 40.7549
export const UPTOWN_CUTOFF_LATITUDE = 40.8012

type MapboxContextEntry = {
  mapbox_id?: string
  name?: string
}

type MapboxFeature = {
  geometry?: {
    coordinates?: [number, number]
  }
  properties?: {
    context?: {
      locality?: MapboxContextEntry
      neighborhood?: MapboxContextEntry
      place?: MapboxContextEntry
      region?: MapboxContextEntry
      street?: MapboxContextEntry
    }
    coordinates?: {
      latitude?: number
      longitude?: number
    }
    feature_type?: string
    full_address?: string
    name?: string
    place_formatted?: string
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

export function inferManhattanSubregion(latitude: number): ManhattanSubregion {
  if (latitude >= UPTOWN_CUTOFF_LATITUDE) {
    return 'Uptown'
  }

  if (latitude >= MIDTOWN_CUTOFF_LATITUDE) {
    return 'Midtown'
  }

  return 'Downtown'
}

export function buildLocationSearchUrl(query: string, accessToken: string) {
  const url = new URL('https://api.mapbox.com/search/geocode/v6/forward')

  url.searchParams.set('access_token', accessToken)
  url.searchParams.set('autocomplete', 'true')
  url.searchParams.set('bbox', MANHATTAN_BBOX)
  url.searchParams.set('country', 'US')
  url.searchParams.set('format', 'geojson')
  url.searchParams.set('language', 'en')
  url.searchParams.set('limit', '5')
  url.searchParams.set('permanent', 'true')
  url.searchParams.set('proximity', '-73.9855,40.758')
  url.searchParams.set('q', query)
  url.searchParams.set('types', 'address,street,neighborhood,locality,place')

  return url
}

export function mapMapboxFeatureToSuggestion(
  feature: MapboxFeature
): LocationSearchSuggestion | null {
  const rawLongitude =
    feature.properties?.coordinates?.longitude ?? feature.geometry?.coordinates?.[0]
  const rawLatitude =
    feature.properties?.coordinates?.latitude ?? feature.geometry?.coordinates?.[1]

  if (
    typeof rawLongitude !== 'number' ||
    !Number.isFinite(rawLongitude) ||
    typeof rawLatitude !== 'number' ||
    !Number.isFinite(rawLatitude)
  ) {
    return null
  }

  const longitude = rawLongitude
  const latitude = rawLatitude

  const neighbourhood = normalizeText(
    feature.properties?.context?.neighborhood?.name ??
      feature.properties?.context?.locality?.name
  )
  const label =
    normalizeText(feature.properties?.full_address) ??
    normalizeText(feature.properties?.name) ??
    null

  if (!label) {
    return null
  }

  return {
    featureType: feature.properties?.feature_type ?? 'address',
    label,
    latitude,
    longitude,
    neighbourhood,
    secondaryLabel:
      normalizeText(feature.properties?.place_formatted) ??
      normalizeText(feature.properties?.context?.place?.name),
    subregion: inferManhattanSubregion(latitude),
  }
}
