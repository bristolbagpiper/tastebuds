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
  description,
  label,
  onToggle,
  options,
  selected,
}: {
  description?: string
  label: string
  onToggle: (value: string) => void
  options: readonly string[]
  selected: string[]
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-[color:var(--foreground)]">{label}</p>
      {description ? <p className="tb-copy text-sm">{description}</p> : null}
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
  embedded = false,
  eyebrow,
  redirectTo,
  title,
}: {
  backHref: string
  backLabel: string
  description: string
  embedded?: boolean
  eyebrow: string
  redirectTo: string
  title: string
}) {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [subregion, setSubregion] = useState<(typeof SUBREGIONS)[number]>('Midtown')
  const [neighbourhood, setNeighbourhood] = useState('')
  const [intent, setIntent] = useState<(typeof INTENTS)[number]>('friendship')
  const [maxTravelMinutes, setMaxTravelMinutes] = useState<(typeof TRAVEL_WINDOWS)[number]>(30)
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
            TRAVEL_WINDOWS.includes(profile.max_travel_minutes as (typeof TRAVEL_WINDOWS)[number])
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
      setError('Complete each section before saving your taste profile.')
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
      setError('Enter a valid latitude and longitude for your home area.')
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

  const content = (
    <>
      <div className="max-w-3xl">
        <p className="tb-label text-sm font-medium uppercase tracking-[0.2em]">{eyebrow}</p>
        <h1 className="mt-3 text-4xl font-semibold text-[color:var(--foreground)]">{title}</h1>
        <p className="tb-copy mt-4 max-w-2xl text-base leading-7">{description}</p>
      </div>

      <form className="mt-10 space-y-8" onSubmit={handleSave}>
        <section className="tb-panel-soft rounded-[2rem] p-6">
          <h2 className="text-xl font-semibold text-[color:var(--foreground)]">Basics</h2>
          <p className="tb-copy mt-2 text-sm leading-6">
            A few basics so your recommendations feel personal.
          </p>
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-[color:var(--foreground)]">First name or display name</span>
              <input
                className="tb-input"
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Alex"
                required
                value={displayName}
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-[color:var(--foreground)]">What are you open to?</span>
              <select
                className="tb-input"
                onChange={(event) => setIntent(event.target.value as (typeof INTENTS)[number])}
                value={intent}
              >
                {INTENTS.map((option) => (
                  <option key={option} value={option}>
                    {option[0].toUpperCase() + option.slice(1)}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-2 sm:col-span-2">
              <span className="text-sm font-medium text-[color:var(--foreground)]">A quick line about your ideal night</span>
              <textarea
                className="tb-input min-h-32 rounded-3xl"
                onChange={(event) => setBio(event.target.value)}
                placeholder="Think warm room, easy conversation, good pasta and a table that does not feel too loud."
                value={bio}
              />
            </label>
          </div>
        </section>

        <section className="tb-panel-soft rounded-[2rem] p-6">
          <h2 className="text-xl font-semibold text-[color:var(--foreground)]">Location and travel</h2>
          <p className="tb-copy mt-2 text-sm leading-6">
            Use a rough home area so nearby tables are weighted properly.
          </p>
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <LocationSearchField
              description="Search a Manhattan address or neighbourhood. Picking a result fills the nearby area and map point."
              label="Home area"
              onPick={applyHomeAnchorSuggestion}
              placeholder="77 Bedford St, West Village"
              query={homeAnchorQuery}
              setQuery={setHomeAnchorQuery}
            />

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
              <span className="text-sm font-medium text-[color:var(--foreground)]">Part of Manhattan</span>
              <select
                className="tb-input"
                onChange={(event) => setSubregion(event.target.value as (typeof SUBREGIONS)[number])}
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
              <span className="text-sm font-medium text-[color:var(--foreground)]">How far are you happy to travel?</span>
              <select
                className="tb-input"
                onChange={(event) =>
                  setMaxTravelMinutes(Number(event.target.value) as (typeof TRAVEL_WINDOWS)[number])
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

            <label className="block space-y-2">
              <span className="text-sm font-medium text-[color:var(--foreground)]">Latitude</span>
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
              <span className="text-sm font-medium text-[color:var(--foreground)]">Longitude</span>
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
          </div>
          <p className="tb-label mt-4 text-xs">
            Use a rough home location, not your exact front door.
          </p>
        </section>

        <section className="tb-panel-soft rounded-[2rem] p-6">
          <h2 className="text-xl font-semibold text-[color:var(--foreground)]">Food preferences</h2>
          <p className="tb-copy mt-2 text-sm leading-6">
            Tell us what you actually like eating and what you want to spend.
          </p>
          <div className="mt-6 space-y-6">
            <PreferenceGroup
              description="Pick one or more price bands that feel comfortable for a weeknight or weekend dinner."
              label="Budget"
              onToggle={(value) => setPreferredPrice((current) => toggleValue(current, value))}
              options={PRICE_TAGS}
              selected={preferredPrice}
            />

            <label className="block space-y-2">
              <span className="text-sm font-medium text-[color:var(--foreground)]">Favourite cuisines</span>
              <input
                className="tb-input"
                onChange={(event) => setCuisinePreferences(event.target.value)}
                placeholder="Italian, Japanese, Thai"
                value={cuisinePreferences}
              />
              <span className="tb-label text-xs">
                Optional. Add a few cuisines you would genuinely be happy to book.
              </span>
            </label>
          </div>
        </section>

        <section className="tb-panel-soft rounded-[2rem] p-6">
          <h2 className="text-xl font-semibold text-[color:var(--foreground)]">Dinner vibe</h2>
          <p className="tb-copy mt-2 text-sm leading-6">
            These choices shape the mood of the room more than the menu.
          </p>
          <div className="mt-6 grid gap-6">
            <PreferenceGroup
              description="Quiet catch-up, lively dinner, or something in between."
              label="Energy"
              onToggle={(value) => setPreferredEnergy((current) => toggleValue(current, value))}
              options={ENERGY_LEVELS}
              selected={preferredEnergy}
            />
            <PreferenceGroup
              description="What kind of night are you after?"
              label="Scene"
              onToggle={(value) => setPreferredScene((current) => toggleValue(current, value))}
              options={SCENE_TAGS}
              selected={preferredScene}
            />
            <PreferenceGroup
              description="How much music do you want around the table?"
              label="Music"
              onToggle={(value) => setPreferredMusic((current) => toggleValue(current, value))}
              options={MUSIC_TAGS}
              selected={preferredMusic}
            />
            <PreferenceGroup
              description="Pick the kinds of spaces that usually suit you."
              label="Setting"
              onToggle={(value) => setPreferredSetting((current) => toggleValue(current, value))}
              options={SETTING_TAGS}
              selected={preferredSetting}
            />
          </div>
        </section>

        <section className="tb-panel-soft rounded-[2rem] p-6">
          <h2 className="text-xl font-semibold text-[color:var(--foreground)]">Social preferences</h2>
          <p className="tb-copy mt-2 text-sm leading-6">
            The point is a table that feels comfortable, not just a good address.
          </p>
          <div className="mt-6 grid gap-6">
            <PreferenceGroup
              description="Choose the kinds of rooms and groups you tend to enjoy most."
              label="Crowd"
              onToggle={(value) => setPreferredCrowd((current) => toggleValue(current, value))}
              options={CROWD_TAGS}
              selected={preferredCrowd}
            />
          </div>
        </section>

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
    </>
  )

  return embedded ? (
    <div className="mx-auto w-full max-w-4xl">{content}</div>
  ) : (
    <main className="mx-auto min-h-screen w-full max-w-4xl px-8 py-16">{content}</main>
  )
}
