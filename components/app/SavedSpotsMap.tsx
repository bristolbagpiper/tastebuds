'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

import type { DashboardRestaurant } from '@/lib/app/types'

type GoogleMapsApi = {
  maps: {
    InfoWindow: new () => GoogleInfoWindow
    LatLngBounds: new () => GoogleLatLngBounds
    Map: new (
      element: HTMLElement,
      options: Record<string, unknown>
    ) => GoogleMap
    Marker: new (options: Record<string, unknown>) => GoogleMarker
    SymbolPath: {
      CIRCLE: unknown
    }
  }
}

type GoogleInfoWindow = {
  addListener: (eventName: string, handler: () => void) => void
  close: () => void
  open: (options: Record<string, unknown>) => void
  setContent: (content: string) => void
}

type GoogleLatLngBounds = {
  extend: (position: { lat: number; lng: number }) => void
  getCenter: () => unknown
}

type GoogleMap = {
  addListener: (eventName: string, handler: () => void) => void
  fitBounds: (bounds: GoogleLatLngBounds, padding?: number) => void
  panTo: (position: { lat: number; lng: number }) => void
  setCenter: (center: unknown) => void
  setZoom: (zoom: number) => void
}

type GoogleMarker = {
  addListener: (eventName: string, handler: () => void) => void
  setMap: (map: GoogleMap | null) => void
}

declare global {
  interface Window {
    google?: GoogleMapsApi
    __tastebudsGoogleMapsPromise?: Promise<GoogleMapsApi>
  }
}

const FALLBACK_CENTER = { lat: 40.758, lng: -73.9855 }

const MAP_STYLES = [
  { elementType: 'geometry', stylers: [{ color: '#f5f1e6' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#72675a' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#f9f9f7' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#b9d4da' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#e8f0f0' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#d8e9ed' }] },
]

function loadGoogleMaps(apiKey: string) {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Google Maps can only load in the browser.'))
  }

  if (window.google?.maps) {
    return Promise.resolve(window.google)
  }

  if (window.__tastebudsGoogleMapsPromise) {
    return window.__tastebudsGoogleMapsPromise
  }

  window.__tastebudsGoogleMapsPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[data-tastebuds-google-maps="true"]'
    )

    if (existingScript) {
      existingScript.addEventListener('load', () => {
        if (window.google?.maps) {
          resolve(window.google)
        } else {
          reject(new Error('Google Maps failed to initialize.'))
        }
      })
      existingScript.addEventListener('error', () => reject(new Error('Google Maps failed to load.')))
      return
    }

    const script = document.createElement('script')
    script.async = true
    script.dataset.tastebudsGoogleMaps = 'true'
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`
    script.onload = () => {
      if (window.google?.maps) {
        resolve(window.google)
      } else {
        reject(new Error('Google Maps failed to initialize.'))
      }
    }
    script.onerror = () => reject(new Error('Google Maps failed to load.'))
    document.head.appendChild(script)
  })

  return window.__tastebudsGoogleMapsPromise
}

function getMarkerIcon(googleApi: GoogleMapsApi, active: boolean) {
  return {
    fillColor: active ? '#ffd740' : '#ffd9e1',
    fillOpacity: 1,
    path: googleApi.maps.SymbolPath.CIRCLE,
    scale: active ? 11 : 9,
    strokeColor: '#ffffff',
    strokeOpacity: 1,
    strokeWeight: 3,
  }
}

function getRestaurantSubtitle(restaurant: DashboardRestaurant) {
  if (restaurant.restaurant_cuisines?.[0]) {
    return `${restaurant.restaurant_cuisines[0]} in ${restaurant.subregion}${
      restaurant.neighbourhood ? `, ${restaurant.neighbourhood}` : ''
    }`
  }

  return `${restaurant.subregion}${restaurant.neighbourhood ? `, ${restaurant.neighbourhood}` : ''}`
}

function getInfoWindowContent(restaurant: DashboardRestaurant) {
  return `
    <div style="font-family: Arial, sans-serif; padding: 4px 2px; max-width: 220px;">
      <div style="font-size: 16px; font-weight: 700; color: #1a1c1b;">${restaurant.name}</div>
      <div style="font-size: 13px; color: #6c6558; margin-top: 4px;">${getRestaurantSubtitle(restaurant)}</div>
      ${
        restaurant.googleRating !== null
          ? `<div style="font-size: 12px; color: #715c00; margin-top: 8px;">${restaurant.googleRating.toFixed(1)} on Google${
              restaurant.googleUserRatingsTotal
                ? ` (${restaurant.googleUserRatingsTotal} reviews)`
                : ''
            }</div>`
          : ''
      }
      ${
        restaurant.googleMapsUri
          ? `<a href="${restaurant.googleMapsUri}" target="_blank" rel="noreferrer" style="display:inline-block;margin-top:10px;font-size:12px;font-weight:600;color:#006685;text-decoration:none;">Open in Google Maps</a>`
          : ''
      }
    </div>
  `
}

export function SavedSpotsMap({
  restaurants,
  selectedRestaurantId,
  onSelectRestaurant,
}: {
  onSelectRestaurant?: (restaurantId: number | null) => void
  restaurants: DashboardRestaurant[]
  selectedRestaurantId?: number | null
}) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ''
  const mapElementRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<GoogleMap | null>(null)
  const markersRef = useRef<GoogleMarker[]>([])
  const infoWindowRef = useRef<GoogleInfoWindow | null>(null)
  const [mapError, setMapError] = useState('')

  const mappedRestaurants = useMemo(
    () =>
      restaurants.filter(
        (restaurant) =>
          restaurant.venue_latitude !== null && restaurant.venue_longitude !== null
      ),
    [restaurants]
  )

  useEffect(() => {
    if (!apiKey || !mapElementRef.current || mappedRestaurants.length === 0) {
      return
    }

    let cancelled = false

    async function initialiseMap() {
      try {
        const googleApi = await loadGoogleMaps(apiKey)

        if (cancelled || !mapElementRef.current) {
          return
        }

        const selectedRestaurant =
          mappedRestaurants.find((restaurant) => restaurant.id === selectedRestaurantId) ?? null

        const center = selectedRestaurant
          ? {
              lat: selectedRestaurant.venue_latitude ?? FALLBACK_CENTER.lat,
              lng: selectedRestaurant.venue_longitude ?? FALLBACK_CENTER.lng,
            }
          : FALLBACK_CENTER

        if (!mapRef.current) {
          mapRef.current = new googleApi.maps.Map(mapElementRef.current, {
            center,
            clickableIcons: false,
            disableDefaultUI: true,
            gestureHandling: 'cooperative',
            mapTypeControl: false,
            maxZoom: 16,
            minZoom: 11,
            styles: MAP_STYLES,
            zoom: 13,
          })
          infoWindowRef.current = new googleApi.maps.InfoWindow()
          mapRef.current.addListener('click', () => {
            onSelectRestaurant?.(null)
            infoWindowRef.current?.close()
          })
          infoWindowRef.current.addListener('closeclick', () => {
            onSelectRestaurant?.(null)
          })
        }

        const map = mapRef.current
        const infoWindow = infoWindowRef.current

        markersRef.current.forEach((marker) => marker.setMap(null))
        markersRef.current = []

        const bounds = new googleApi.maps.LatLngBounds()

        for (const restaurant of mappedRestaurants) {
          const position = {
            lat: restaurant.venue_latitude ?? FALLBACK_CENTER.lat,
            lng: restaurant.venue_longitude ?? FALLBACK_CENTER.lng,
          }

          bounds.extend(position)

          const marker = new googleApi.maps.Marker({
            icon: getMarkerIcon(googleApi, restaurant.id === selectedRestaurantId),
            map,
            position,
            title: restaurant.name,
          })

          marker.addListener('click', () => {
            onSelectRestaurant?.(restaurant.id)
            infoWindow?.setContent(getInfoWindowContent(restaurant))
            infoWindow?.open({ anchor: marker, map })
          })

          if (restaurant.id === selectedRestaurantId && infoWindow) {
            infoWindow.setContent(getInfoWindowContent(restaurant))
            infoWindow.open({ anchor: marker, map })
          }

          markersRef.current.push(marker)
        }

        if (mappedRestaurants.length === 1) {
          map.setCenter(bounds.getCenter())
          map.setZoom(14)
        } else {
          map.fitBounds(bounds, 64)
        }

        if (selectedRestaurant) {
          map.panTo({
            lat: selectedRestaurant.venue_latitude ?? FALLBACK_CENTER.lat,
            lng: selectedRestaurant.venue_longitude ?? FALLBACK_CENTER.lng,
          })
        } else if (infoWindow) {
          infoWindow.close()
        }

        setMapError('')
      } catch (error) {
        if (!cancelled) {
          setMapError(error instanceof Error ? error.message : 'Could not load map.')
        }
      }
    }

    void initialiseMap()

    return () => {
      cancelled = true
    }
  }, [apiKey, mappedRestaurants, onSelectRestaurant, selectedRestaurantId])

  if (!apiKey) {
    return (
      <div className="flex h-full min-h-[400px] flex-col items-center justify-center gap-3 rounded-3xl border border-[#d8e6e8] bg-[#dce9e8] p-6 text-center">
        <p className="text-base font-semibold text-[#1a1c1b]">Interactive map available</p>
        <p className="max-w-md text-sm leading-6 text-[#6f8f98]">
          Set <code>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> to enable the saved-spots map in the dashboard.
        </p>
      </div>
    )
  }

  if (mappedRestaurants.length === 0) {
    return (
      <div className="flex h-full min-h-[400px] flex-col items-center justify-center gap-3 rounded-3xl border border-[#d8e6e8] bg-[#dce9e8] p-6 text-center">
        <p className="text-base font-semibold text-[#1a1c1b]">No mapped restaurants yet</p>
        <p className="max-w-md text-sm leading-6 text-[#6f8f98]">
          Saved restaurants need venue coordinates before they can appear on the map.
        </p>
      </div>
    )
  }

  return (
    <div className="relative min-h-[400px] overflow-hidden rounded-3xl border border-[#d8e6e8] bg-[#dce9e8]">
      <div className="absolute inset-0" ref={mapElementRef} />
      {mapError ? (
        <div className="absolute inset-x-4 top-4 rounded-xl bg-white/95 p-3 text-sm text-[#8b0e45] shadow-lg">
          {mapError}
        </div>
      ) : null}
    </div>
  )
}
