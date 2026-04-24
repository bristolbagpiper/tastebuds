'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { Button } from '@/components/app/Button'
import {
  LocationSearchField,
  type LocationSuggestion,
} from '@/components/location-search-field'
import { clearAppBootstrapCache, getAppBootstrap } from '@/lib/app/client'
import {
  CROWD_TAGS,
  ENERGY_LEVELS,
  MUSIC_TAGS,
  PRICE_TAGS,
  SCENE_TAGS,
  SETTING_TAGS,
  normalizeCrowdList,
  normalizeEnergyList,
  normalizeMusicList,
  normalizePriceList,
  normalizeSceneList,
  normalizeSettingList,
  parseCuisinePreferenceInput,
} from '@/lib/events'
import { supabase } from '@/lib/supabase/client'

const SUBREGIONS = ['Uptown', 'Midtown', 'Downtown'] as const
const TRAVEL_WINDOWS = [15, 30, 45] as const
const INTENTS = ['dating', 'friendship'] as const

function toggleValue(current: string[], value: string) {
  return current.includes(value)
    ? current.filter((entry) => entry !== value)
    : [...current, value]
}

function PreferenceGroup({
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
    <div className="space-y-3">
      <p className="text-sm font-medium text-[color:var(--foreground)]">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const active = selected.includes(option)

          return (
            <button
              className={
                active
                  ? 'rounded-2xl border border-[color:var(--accent)] bg-[color:var(--accent)] px-3 py-2 text-sm font-medium text-white shadow-[0_10px_24px_rgba(199,106,74,0.18)] transition'
                  : 'rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface)] px-3 py-2 text-sm font-medium text-[color:var(--text-muted)] transition hover:border-[color:var(--accent)] hover:text-[color:var(--foreground)]'
              }
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

export function ProfileEditor({
  backHref,
  backLabel,
  description,
  eyebrow,
  redirectTo,
  title,
}: {
  backHref: string
  backLabel: string
  description: string
  eyebrow: string
  redirectTo: string
  title: string
}) {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [subregion, setSubregion] =
    useState<(typeof SUBREGIONS)[number]>('Midtown')
  const [neighbourhood, setNeighbourhood] = useState('')
  const [intent, setIntent] = useState<(typeof INTENTS)[number]>('friendship')
  const [maxTravelMinutes, setMaxTravelMinutes] =
    useState<(typeof TRAVEL_WINDOWS)[number]>(30)
  const [homeAnchorQuery, setHomeAnchorQuery] = useState('')
  const [homeLatitude, setHomeLatitude] = useState('')
  const [homeLongitude, setHomeLongitude] = useState('')
  const [preferredEnergy, setPreferredEnergy] = useState<string[]>([])
  const [preferredScene, setPreferredScene] = useState<string[]>([])
  const [preferredCrowd, setPreferredCrowd] = useState<string[]>([])
  const [preferredMusic, setPreferredMusic] = useState<string[]>([])
  const [preferredSetting, setPreferredSetting] = useState<string[]>([])
  const [preferredPrice, setPreferredPrice] = useState<string[]>([])
  const [cuisinePreferences, setCuisinePreferences] = useState('')
  const [bio, setBio] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    async function loadProfile() {
      let bootstrap

      try {
        bootstrap = await getAppBootstrap()
      } catch {
        if (active) {
          router.replace('/login')
        }
        return
      }

      if (!active) {
        return
      }

      setUserId(bootstrap.userId)

      const profile = bootstrap.profile
      if (profile) {
        setDisplayName(profile.display_name ?? '')
        setSubregion(
          profile.subregion && SUBREGIONS.includes(profile.subregion as (typeof SUBREGIONS)[number])
            ? (profile.subregion as (typeof SUBREGIONS)[number])
            : 'Midtown'
        )
        setNeighbourhood(profile.neighbourhood ?? '')
        setHomeAnchorQuery(profile.neighbourhood ?? '')
        setIntent(
          profile.intent && INTENTS.includes(profile.intent as (typeof INTENTS)[number])
            ? (profile.intent as (typeof INTENTS)[number])
            : 'friendship'
        )
        setHomeLatitude(
          profile.home_latitude === null || profile.home_latitude === undefined
            ? ''
            : String(profile.home_latitude)
        )
        setHomeLongitude(
          profile.home_longitude === null || profile.home_longitude === undefined
            ? ''
            : String(profile.home_longitude)
        )
        setMaxTravelMinutes(
          profile.max_travel_minutes &&
            TRAVEL_WINDOWS.includes(
              profile.max_travel_minutes as (typeof TRAVEL_WINDOWS)[number]
            )
            ? (profile.max_travel_minutes as (typeof TRAVEL_WINDOWS)[number])
            : 30
        )
        setPreferredEnergy(normalizeEnergyList(profile.preferred_energy))
        setPreferredScene(normalizeSceneList(profile.preferred_scene))
        setPreferredCrowd(normalizeCrowdList(profile.preferred_crowd))
        setPreferredMusic(normalizeMusicList(profile.preferred_music))
        setPreferredSetting(normalizeSettingList(profile.preferred_setting))
        setPreferredPrice(normalizePriceList(profile.preferred_price))
        setCuisinePreferences((profile.cuisine_preferences ?? []).join(', '))
        setBio(profile.bio ?? '')
      }

      setLoading(false)
    }

    void loadProfile()

    return () => {
      active = false
    }
  }, [router])

  function applyHomeAnchorSuggestion(suggestion: LocationSuggestion) {
    setHomeAnchorQuery(suggestion.label)
    setHomeLatitude(String(suggestion.latitude))
    setHomeLongitude(String(suggestion.longitude))
    setNeighbourhood(suggestion.neighbourhood ?? '')
    setSubregion(suggestion.subregion)
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!userId) {
      setError('You need to be logged in before saving a profile.')
      return
    }

    if (
      preferredEnergy.length === 0 ||
      preferredScene.length === 0 ||
      preferredCrowd.length === 0 ||
      preferredMusic.length === 0 ||
      preferredSetting.length === 0 ||
      preferredPrice.length === 0
    ) {
      setError('Complete the night-preference sections before continuing.')
      return
    }

    const parsedHomeLatitude = Number(homeLatitude)
    const parsedHomeLongitude = Number(homeLongitude)

    if (
      !Number.isFinite(parsedHomeLatitude) ||
      parsedHomeLatitude < -90 ||
      parsedHomeLatitude > 90 ||
      !Number.isFinite(parsedHomeLongitude) ||
      parsedHomeLongitude < -180 ||
      parsedHomeLongitude > 180
    ) {
      setError('Enter a valid home latitude and longitude for proximity scoring.')
      return
    }

    setSaving(true)
    setError('')

    const { error: upsertError } = await supabase.from('profiles').upsert({
      id: userId,
      bio: bio.trim() || null,
      city: 'New York City',
      cuisine_preferences: parseCuisinePreferenceInput(cuisinePreferences),
      display_name: displayName.trim(),
      home_latitude: parsedHomeLatitude,
      home_longitude: parsedHomeLongitude,
      intent,
      max_travel_minutes: maxTravelMinutes,
      neighbourhood: neighbourhood.trim() || null,
      preferred_crowd: preferredCrowd,
      preferred_energy: preferredEnergy,
      preferred_music: preferredMusic,
      preferred_price: preferredPrice,
      preferred_scene: preferredScene,
      preferred_setting: preferredSetting,
      region: 'Manhattan',
      subregion,
    })

    setSaving(false)

    if (upsertError) {
      setError(upsertError.message)
      return
    }

    clearAppBootstrapCache()
    router.replace(redirectTo)
  }

  if (loading) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-8">
        <p className="tb-copy text-sm">Loading your profile...</p>
      </main>
    )
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl px-8 py-16">
      <div className="max-w-3xl">
        <p className="tb-label text-sm font-medium uppercase tracking-[0.2em]">{eyebrow}</p>
        <h1 className="mt-3 text-4xl font-semibold text-[color:var(--foreground)]">{title}</h1>
        <p className="tb-copy mt-4 max-w-2xl text-base leading-7">{description}</p>
      </div>

      <form className="mt-10 space-y-8" onSubmit={handleSave}>
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-[color:var(--foreground)]">Display name</span>
            <input
              className="tb-input"
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Alex"
              required
              value={displayName}
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-[color:var(--foreground)]">Subregion</span>
            <select
              className="tb-input"
              onChange={(event) =>
                setSubregion(event.target.value as (typeof SUBREGIONS)[number])
              }
              value={subregion}
            >
              {SUBREGIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-[color:var(--foreground)]">Neighbourhood</span>
            <input
              className="tb-input"
              onChange={(event) => setNeighbourhood(event.target.value)}
              placeholder="Lower East Side"
              value={neighbourhood}
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-[color:var(--foreground)]">Connection mode</span>
            <select
              className="tb-input"
              onChange={(event) =>
                setIntent(event.target.value as (typeof INTENTS)[number])
              }
              value={intent}
            >
              {INTENTS.map((option) => (
                <option key={option} value={option}>
                  {option[0].toUpperCase() + option.slice(1)}
                </option>
              ))}
            </select>
          </label>

          <LocationSearchField
            description="Search a Manhattan address or neighborhood. Selecting a result fills your anchor coordinates and nearby area."
            label="Home anchor search"
            onPick={applyHomeAnchorSuggestion}
            placeholder="77 Bedford St, West Village"
            query={homeAnchorQuery}
            setQuery={setHomeAnchorQuery}
          />

          <label className="block space-y-2">
            <span className="text-sm font-medium text-[color:var(--foreground)]">Home latitude</span>
            <input
              className="tb-input"
              onChange={(event) => setHomeLatitude(event.target.value)}
              placeholder="40.7306"
              required
              step="any"
              type="number"
              value={homeLatitude}
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-[color:var(--foreground)]">Home longitude</span>
            <input
              className="tb-input"
              onChange={(event) => setHomeLongitude(event.target.value)}
              placeholder="-73.9866"
              required
              step="any"
              type="number"
              value={homeLongitude}
            />
          </label>

          <label className="block space-y-2 sm:col-span-2">
            <span className="text-sm font-medium text-[color:var(--foreground)]">Max travel time</span>
            <select
              className="tb-input"
              onChange={(event) =>
                setMaxTravelMinutes(
                  Number(event.target.value) as (typeof TRAVEL_WINDOWS)[number]
                )
              }
              value={maxTravelMinutes}
            >
              {TRAVEL_WINDOWS.map((minutes) => (
                <option key={minutes} value={minutes}>
                  {minutes} minutes
                </option>
              ))}
            </select>
          </label>
        </div>

        <section className="tb-panel-soft rounded-3xl p-6">
          <h2 className="text-lg font-semibold text-[color:var(--foreground)]">Night preferences</h2>
          <p className="tb-copy mt-2 text-sm leading-6">
            Pick the kinds of venues you actually want matched with. Broad picks
            are fine, but leaving sections blank just weakens the model.
          </p>
          <div className="mt-6 grid gap-6">
            <PreferenceGroup
              label="Energy"
              onToggle={(value) => setPreferredEnergy((current) => toggleValue(current, value))}
              options={ENERGY_LEVELS}
              selected={preferredEnergy}
            />
            <PreferenceGroup
              label="Scene"
              onToggle={(value) => setPreferredScene((current) => toggleValue(current, value))}
              options={SCENE_TAGS}
              selected={preferredScene}
            />
            <PreferenceGroup
              label="Crowd"
              onToggle={(value) => setPreferredCrowd((current) => toggleValue(current, value))}
              options={CROWD_TAGS}
              selected={preferredCrowd}
            />
            <PreferenceGroup
              label="Music"
              onToggle={(value) => setPreferredMusic((current) => toggleValue(current, value))}
              options={MUSIC_TAGS}
              selected={preferredMusic}
            />
            <PreferenceGroup
              label="Setting"
              onToggle={(value) => setPreferredSetting((current) => toggleValue(current, value))}
              options={SETTING_TAGS}
              selected={preferredSetting}
            />
            <PreferenceGroup
              label="Price"
              onToggle={(value) => setPreferredPrice((current) => toggleValue(current, value))}
              options={PRICE_TAGS}
              selected={preferredPrice}
            />
          </div>
        </section>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-[color:var(--foreground)]">Cuisine preferences</span>
          <input
            className="tb-input"
            onChange={(event) => setCuisinePreferences(event.target.value)}
            placeholder="Italian, Japanese, Thai"
            value={cuisinePreferences}
          />
          <span className="tb-label text-xs">
            Optional, comma-separated. Used as a secondary tie-breaker after the
            weighted venue model.
          </span>
        </label>

        <p className="tb-label text-xs">
          Use a rough home anchor, not your exact front door. Search is faster,
          but the coordinates remain editable because geocoders are not magic.
        </p>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-[color:var(--foreground)]">Short bio</span>
          <textarea
            className="tb-input min-h-32 rounded-3xl"
            onChange={(event) => setBio(event.target.value)}
            placeholder="What makes a good night out for you?"
            value={bio}
          />
        </label>

        {error ? (
          <div className="rounded-3xl border border-[color:color-mix(in_srgb,var(--accent)_28%,white)] bg-[color:color-mix(in_srgb,var(--accent)_10%,var(--surface))] p-4 text-sm text-[color:var(--accent-strong)]">
            {error}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <Button disabled={saving} type="submit">
            {saving ? 'Saving profile...' : 'Save profile'}
          </Button>
          <Button href={backHref} variant="secondary">
            {backLabel}
          </Button>
        </div>
      </form>
    </main>
  )
}
