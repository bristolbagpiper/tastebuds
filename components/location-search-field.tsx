'use client'

import { useEffect, useMemo, useState } from 'react'

import type { ManhattanSubregion } from '@/lib/events'

export type LocationSuggestion = {
  featureType: string
  label: string
  latitude: number
  longitude: number
  neighbourhood: string | null
  secondaryLabel: string | null
  subregion: ManhattanSubregion
}

type LocationSearchFieldProps = {
  description: string
  label: string
  onPick: (suggestion: LocationSuggestion) => void
  placeholder: string
  query: string
  setQuery: (value: string) => void
}

type LocationSearchResponse = {
  error?: string
  providerConfigured: boolean
  suggestions: LocationSuggestion[]
}

export function LocationSearchField({
  description,
  label,
  onPick,
  placeholder,
  query,
  setQuery,
}: LocationSearchFieldProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [providerConfigured, setProviderConfigured] = useState(true)
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([])
  const trimmedQuery = query.trim()
  const showSuggestions = providerConfigured && suggestions.length > 0

  useEffect(() => {
    if (trimmedQuery.length < 3) {
      setLoading(false)
      setError('')
      setSuggestions([])
      return
    }

    const controller = new AbortController()
    const timeoutId = window.setTimeout(async () => {
      setLoading(true)
      setError('')

      try {
        const response = await fetch(
          `/api/location-search?q=${encodeURIComponent(trimmedQuery)}`,
          {
            signal: controller.signal,
          }
        )
        const payload = (await response.json()) as LocationSearchResponse

        setProviderConfigured(payload.providerConfigured)

        if (!response.ok || payload.error) {
          setSuggestions([])
          setError(payload.error ?? 'Location search failed.')
          return
        }

        setSuggestions(payload.suggestions)
      } catch (nextError) {
        if (controller.signal.aborted) {
          return
        }

        setSuggestions([])
        setError(
          nextError instanceof Error ? nextError.message : 'Location search failed.'
        )
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }, 300)

    return () => {
      controller.abort()
      window.clearTimeout(timeoutId)
    }
  }, [trimmedQuery])

  const helperText = useMemo(() => {
    if (!providerConfigured) {
      return 'Set MAPBOX_ACCESS_TOKEN on the server to enable address lookup.'
    }

    if (error) {
      return error
    }

    if (loading) {
      return 'Searching Manhattan addresses...'
    }

    if (trimmedQuery.length >= 3 && suggestions.length === 0) {
      return 'No Manhattan matches found. Try a fuller street address or neighborhood.'
    }

    return description
  }, [description, error, loading, providerConfigured, suggestions.length, trimmedQuery.length])

  return (
    <div className="space-y-2 sm:col-span-2">
      <span className="text-sm font-medium text-zinc-700">{label}</span>
      <input
        className="w-full rounded-xl border border-zinc-300 px-4 py-3 outline-none transition focus:border-zinc-950"
        onChange={(event) => setQuery(event.target.value)}
        placeholder={placeholder}
        value={query}
      />
      <p
        className={`text-xs ${
          error ? 'text-red-600' : providerConfigured ? 'text-zinc-500' : 'text-amber-700'
        }`}
      >
        {helperText}
      </p>
      {showSuggestions ? (
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
          {suggestions.map((suggestion) => (
            <button
              className="flex w-full items-start justify-between gap-4 border-b border-zinc-200 px-4 py-3 text-left transition last:border-b-0 hover:bg-zinc-50"
              key={`${suggestion.label}:${suggestion.latitude}:${suggestion.longitude}`}
              onClick={() => {
                onPick(suggestion)
                setSuggestions([])
              }}
              type="button"
            >
              <span>
                <span className="block text-sm font-medium text-zinc-950">
                  {suggestion.label}
                </span>
                <span className="mt-1 block text-xs text-zinc-500">
                  {suggestion.secondaryLabel ?? 'Manhattan'}
                </span>
              </span>
              <span className="text-xs text-zinc-500">{suggestion.subregion}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
