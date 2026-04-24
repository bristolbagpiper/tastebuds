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
      <span className="text-sm font-medium text-[color:var(--foreground)]">{label}</span>
      <input
        className="tb-input"
        onChange={(event) => setQuery(event.target.value)}
        placeholder={placeholder}
        value={query}
      />
      <p
        className={`text-xs ${
          error
            ? 'text-[color:var(--accent-strong)]'
            : providerConfigured
              ? 'tb-label'
              : 'text-[color:var(--accent-strong)]'
        }`}
      >
        {helperText}
      </p>
      {showSuggestions ? (
        <div className="tb-panel overflow-hidden rounded-3xl">
          {suggestions.map((suggestion) => (
            <button
              className="flex w-full items-start justify-between gap-4 border-b border-[color:var(--border-soft)] px-4 py-3 text-left transition last:border-b-0 hover:bg-[color:var(--surface-strong)]"
              key={`${suggestion.label}:${suggestion.latitude}:${suggestion.longitude}`}
              onClick={() => {
                onPick(suggestion)
                setSuggestions([])
              }}
              type="button"
            >
              <span>
                <span className="block text-sm font-medium text-[color:var(--foreground)]">
                  {suggestion.label}
                </span>
                <span className="tb-label mt-1 block text-xs">
                  {suggestion.secondaryLabel ?? 'Manhattan'}
                </span>
              </span>
              <span className="tb-label text-xs">{suggestion.subregion}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
