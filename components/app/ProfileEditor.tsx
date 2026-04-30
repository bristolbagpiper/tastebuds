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
  AGE_RANGE_COMFORT_TAGS,
  CROWD_TAGS,
  CONVERSATION_ACTIVITY_TAGS,
  DIETARY_RESTRICTION_TAGS,
  DRINKING_PREFERENCE_TAGS,
  ENERGY_LEVELS,
  GROUP_SIZE_COMFORT_TAGS,
  MUSIC_TAGS,
  PRICE_TAGS,
  SCENE_TAGS,
  SETTING_TAGS,
  VIBE_TAGS,
  normalizeAgeRangeComfortList,
  normalizeConversationPreferenceList,
  normalizeCrowdList,
  normalizeDietaryRestrictionList,
  normalizeDrinkingPreferenceList,
  normalizeEnergyList,
  normalizeGroupSizeComfortList,
  normalizeMusicList,
  normalizePriceList,
  normalizeSceneList,
  normalizeSettingList,
  normalizeVibeList,
  parseCuisinePreferenceInput,
} from '@/lib/events'
import { supabase } from '@/lib/supabase/client'

const SUBREGIONS = ['Uptown', 'Midtown', 'Downtown'] as const
const TRAVEL_WINDOWS = [15, 30, 45] as const

function normalizeSavedNeighbourhood(value: string | null | undefined) {
  const normalized = value?.trim() || ''

  if (['manhattan', 'new york', 'new york county'].includes(normalized.toLowerCase())) {
    return ''
  }

  return normalized
}

function getSavedHomeAreaLabel(
  neighbourhood: string | null | undefined,
  subregion: string | null | undefined
) {
  const normalizedNeighbourhood = normalizeSavedNeighbourhood(neighbourhood)

  if (normalizedNeighbourhood) {
    return normalizedNeighbourhood
  }

  if (subregion) {
    return `${subregion}, Manhattan`
  }

  return ''
}

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
      <p className="text-sm font-semibold text-[color:var(--foreground)]">{label}</p>
      {description ? <p className="tb-copy text-sm">{description}</p> : null}
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const active = selected.includes(option)

          return (
            <button
              className={
                active
                  ? 'rounded-full border border-[color:var(--accent)] bg-[color:var(--accent)] px-3 py-2 text-sm font-semibold text-[color:var(--accent-text)] shadow-[0_10px_20px_rgba(245,158,11,0.3)] transition'
                  : 'rounded-full border border-[color:var(--border-soft)] bg-white px-3 py-2 text-sm font-medium text-[color:var(--text-muted)] transition hover:border-[color:var(--accent)] hover:text-[color:var(--foreground)]'
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
  const [preferredVibes, setPreferredVibes] = useState<string[]>([])
  const [drinkingPreferences, setDrinkingPreferences] = useState<string[]>([])
  const [dietaryRestrictions, setDietaryRestrictions] = useState<string[]>([])
  const [conversationPreference, setConversationPreference] = useState<string[]>([])
  const [ageRangeComfort, setAgeRangeComfort] = useState<string[]>([])
  const [groupSizeComfort, setGroupSizeComfort] = useState<string[]>([])
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
        setNeighbourhood(normalizeSavedNeighbourhood(profile.neighbourhood))
        setHomeAnchorQuery(getSavedHomeAreaLabel(profile.neighbourhood, profile.subregion))
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
        setPreferredVibes(normalizeVibeList(profile.preferred_vibes))
        setDrinkingPreferences(normalizeDrinkingPreferenceList(profile.drinking_preferences))
        setDietaryRestrictions(normalizeDietaryRestrictionList(profile.dietary_restrictions))
        setConversationPreference(
          normalizeConversationPreferenceList(profile.conversation_preference)
        )
        setAgeRangeComfort(normalizeAgeRangeComfortList(profile.age_range_comfort))
        setGroupSizeComfort(normalizeGroupSizeComfortList(profile.group_size_comfort))
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
      setError('Choose a valid home area from the location search before saving.')
      return
    }

    setSaving(true)
    setError('')

    const { error: upsertError } = await supabase.from('profiles').upsert({
      age_range_comfort: ageRangeComfort,
      id: userId,
      bio: bio.trim() || null,
      city: 'New York City',
      conversation_preference: conversationPreference,
      cuisine_preferences: parseCuisinePreferenceInput(cuisinePreferences),
      dietary_restrictions: dietaryRestrictions,
      display_name: displayName.trim(),
      drinking_preferences: drinkingPreferences,
      group_size_comfort: groupSizeComfort,
      home_latitude: parsedHomeLatitude,
      home_longitude: parsedHomeLongitude,
      intent: 'friendship',
      max_travel_minutes: maxTravelMinutes,
      neighbourhood: neighbourhood.trim() || null,
      preferred_crowd: preferredCrowd,
      preferred_energy: preferredEnergy,
      preferred_music: preferredMusic,
      preferred_price: preferredPrice,
      preferred_scene: preferredScene,
      preferred_setting: preferredSetting,
      preferred_vibes: preferredVibes,
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
        <p className="tb-label text-sm font-semibold uppercase tracking-[0.2em]">{eyebrow}</p>
        <h1 className="mt-3 text-[2.5rem] font-bold leading-none tracking-[-0.04em] text-[color:var(--foreground)] sm:text-[3.25rem]">
          {title}
        </h1>
        <p className="tb-copy mt-4 max-w-2xl text-base leading-7">{description}</p>
      </div>

      <form className="mt-10 space-y-8" onSubmit={handleSave}>
        <section className="rounded-[2rem] border border-[color:var(--border-soft)] bg-white p-6 shadow-[0_10px_40px_-10px_rgba(113,92,0,0.08)]">
          <h2 className="text-2xl font-semibold tracking-tight text-[color:var(--foreground)]">Basics</h2>
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

            <div className="block space-y-2">
              <span className="text-sm font-medium text-[color:var(--foreground)]">Current mode</span>
              <div className="tb-input flex items-center bg-[color:var(--surface-soft)] text-[color:var(--foreground)]">
                Friendship
              </div>
            </div>

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

        <section className="rounded-[2rem] border border-[color:var(--border-soft)] bg-white p-6 shadow-[0_10px_40px_-10px_rgba(113,92,0,0.08)]">
          <h2 className="text-2xl font-semibold tracking-tight text-[color:var(--foreground)]">Location and travel</h2>
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
          </div>
        </section>

        <section className="rounded-[2rem] border border-[color:var(--border-soft)] bg-white p-6 shadow-[0_10px_40px_-10px_rgba(113,92,0,0.08)]">
          <h2 className="text-2xl font-semibold tracking-tight text-[color:var(--foreground)]">Food preferences</h2>
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

        <section className="rounded-[2rem] border border-[color:var(--border-soft)] bg-white p-6 shadow-[0_10px_40px_-10px_rgba(113,92,0,0.08)]">
          <h2 className="text-2xl font-semibold tracking-tight text-[color:var(--foreground)]">Dinner vibe</h2>
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
            <PreferenceGroup
              description="The softer, richer feel of the room once food, style and crowd all come together."
              label="Vibe"
              onToggle={(value) => setPreferredVibes((current) => toggleValue(current, value))}
              options={VIBE_TAGS}
              selected={preferredVibes}
            />
          </div>
        </section>

        <section className="rounded-[2rem] border border-[color:var(--border-soft)] bg-white p-6 shadow-[0_10px_40px_-10px_rgba(113,92,0,0.08)]">
          <h2 className="text-2xl font-semibold tracking-tight text-[color:var(--foreground)]">Social preferences</h2>
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
            <PreferenceGroup
              description="Whether the night should be built around conversation or something more active."
              label="Conversation vs activity"
              onToggle={(value) => setConversationPreference((current) => toggleValue(current, value))}
              options={CONVERSATION_ACTIVITY_TAGS}
              selected={conversationPreference}
            />
            <PreferenceGroup
              description="What kind of table size usually feels right for you."
              label="Group size comfort"
              onToggle={(value) => setGroupSizeComfort((current) => toggleValue(current, value))}
              options={GROUP_SIZE_COMFORT_TAGS}
              selected={groupSizeComfort}
            />
            <PreferenceGroup
              description="Keep this broad. It should guide recommendations, not create artificial precision."
              label="Age range comfort"
              onToggle={(value) => setAgeRangeComfort((current) => toggleValue(current, value))}
              options={AGE_RANGE_COMFORT_TAGS}
              selected={ageRangeComfort}
            />
          </div>
        </section>

        <section className="rounded-[2rem] border border-[color:var(--border-soft)] bg-white p-6 shadow-[0_10px_40px_-10px_rgba(113,92,0,0.08)]">
          <h2 className="text-2xl font-semibold tracking-tight text-[color:var(--foreground)]">Drinks and dietary</h2>
          <p className="tb-copy mt-2 text-sm leading-6">
            These preferences help separate a good place from a merely convenient one.
          </p>
          <div className="mt-6 grid gap-6">
            <PreferenceGroup
              description="Pick what you actually enjoy around the table."
              label="Drinking preference"
              onToggle={(value) => setDrinkingPreferences((current) => toggleValue(current, value))}
              options={DRINKING_PREFERENCE_TAGS}
              selected={drinkingPreferences}
            />
            <PreferenceGroup
              description="Add any dietary needs that should materially affect the shortlist."
              label="Dietary restrictions"
              onToggle={(value) => setDietaryRestrictions((current) => toggleValue(current, value))}
              options={DIETARY_RESTRICTION_TAGS}
              selected={dietaryRestrictions}
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
    <div className="mx-auto w-full max-w-5xl">{content}</div>
  ) : (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-8 py-16">{content}</main>
  )
}
