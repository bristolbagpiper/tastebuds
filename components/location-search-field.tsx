'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

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
  const [searchEnabled, setSearchEnabled] = useState(false)
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([])
  const inputRef = useRef<HTMLInputElement | null>(null)
  const committedQueryRef = useRef<string | null>(null)
  const trimmedQuery = query.trim()
  const selectionCommitted =
    committedQueryRef.current !== null &&
    trimmedQuery.length > 0 &&
    trimmedQuery === committedQueryRef.current
  const showSuggestions = providerConfigured && searchEnabled && suggestions.length > 0

  useEffect(() => {
    if (selectionCommitted) {
      setLoading(false)
      setError('')
      setSuggestions([])
      return
    }

    if (!searchEnabled) {
      setLoading(false)
      setError('')
      setSuggestions([])
      return
    }

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
  }, [searchEnabled, selectionCommitted, trimmedQuery])

  const helperText = useMemo(() => {
    if (!providerConfigured) {
      return 'Set GOOGLE_MAPS_API_KEY on the server to enable address lookup.'
    }

    if (error) {
      return error
    }

    if (loading) {
      return 'Searching Manhattan addresses...'
    }

    if (selectionCommitted) {
      return description
    }

    if (trimmedQuery.length >= 3 && suggestions.length === 0) {
      return 'No Manhattan matches found. Try a fuller street address or neighborhood.'
    }

    return description
  }, [description, error, loading, providerConfigured, selectionCommitted, suggestions.length, trimmedQuery.length])

  return (
    <div className="space-y-2 sm:col-span-2">
      <span className="text-sm font-medium text-[color:var(--foreground)]">{label}</span>
      <input
        className="tb-input"
        onChange={(event) => {
          const nextValue = event.target.value
          const nextTrimmedValue = nextValue.trim()

          if (
            committedQueryRef.current !== null &&
            nextTrimmedValue !== committedQueryRef.current
          ) {
            committedQueryRef.current = null
          }

          setSearchEnabled(true)
          setQuery(nextValue)
        }}
        placeholder={placeholder}
        ref={inputRef}
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
        <div className="overflow-hidden rounded-[1.5rem] border border-[color:var(--border-soft)] bg-white shadow-[0_10px_40px_-10px_rgba(113,92,0,0.08)]">
          {suggestions.map((suggestion) => (
            <button
              className="flex w-full items-start justify-between gap-4 border-b border-[color:var(--border-soft)] px-4 py-3 text-left transition last:border-b-0 hover:bg-[#f7f5f0]"
              key={`${suggestion.label}:${suggestion.latitude}:${suggestion.longitude}`}
              onClick={() => {
                committedQueryRef.current = suggestion.label.trim()
                onPick(suggestion)
                setLoading(false)
                setError('')
                setSearchEnabled(false)
                setSuggestions([])
                inputRef.current?.blur()
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
