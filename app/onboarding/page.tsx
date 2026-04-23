'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { getUpcomingWednesdayDate } from '@/lib/rounds'
import { supabase } from '@/lib/supabase/client'

const SUBREGIONS = ['Uptown', 'Midtown', 'Downtown'] as const
const TRAVEL_WINDOWS = [15, 30, 45] as const
const INTENTS = ['dating', 'friendship'] as const

type Profile = {
  bio: string | null
  display_name: string | null
  intent: string | null
  max_travel_minutes: number | null
  neighbourhood: string | null
  subregion: string | null
}

export default function OnboardingPage() {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [subregion, setSubregion] =
    useState<(typeof SUBREGIONS)[number]>('Midtown')
  const [neighbourhood, setNeighbourhood] = useState('')
  const [intent, setIntent] = useState<(typeof INTENTS)[number]>('dating')
  const [maxTravelMinutes, setMaxTravelMinutes] =
    useState<(typeof TRAVEL_WINDOWS)[number]>(30)
  const [bio, setBio] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const roundDate = getUpcomingWednesdayDate()

  useEffect(() => {
    let active = true

    async function loadProfile() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!active) {
        return
      }

      if (!user) {
        router.replace('/login')
        return
      }

      setUserId(user.id)

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select(
          'bio, display_name, intent, max_travel_minutes, neighbourhood, subregion'
        )
        .eq('id', user.id)
        .maybeSingle()

      if (!active) {
        return
      }

      if (profileError) {
        setError(
          'The profiles table is missing. Run supabase/schema.sql in the Supabase SQL editor first.'
        )
        setLoading(false)
        return
      }

      if (profile) {
        hydrateForm(profile)
      }

      setLoading(false)
    }

    function hydrateForm(profile: Profile) {
      setDisplayName(profile.display_name ?? '')
      setSubregion(
        profile.subregion && SUBREGIONS.includes(profile.subregion as (typeof SUBREGIONS)[number])
          ? (profile.subregion as (typeof SUBREGIONS)[number])
          : 'Midtown'
      )
      setNeighbourhood(profile.neighbourhood ?? '')
      setIntent(
        profile.intent && INTENTS.includes(profile.intent as (typeof INTENTS)[number])
          ? (profile.intent as (typeof INTENTS)[number])
          : 'dating'
      )
      setMaxTravelMinutes(
        profile.max_travel_minutes &&
          TRAVEL_WINDOWS.includes(
            profile.max_travel_minutes as (typeof TRAVEL_WINDOWS)[number]
          )
          ? (profile.max_travel_minutes as (typeof TRAVEL_WINDOWS)[number])
          : 30
      )
      setBio(profile.bio ?? '')
    }

    void loadProfile()

    return () => {
      active = false
    }
  }, [router])

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!userId) {
      setError('You need to be logged in before saving a profile.')
      return
    }

    setSaving(true)
    setError('')

    const { error: upsertError } = await supabase.from('profiles').upsert({
      id: userId,
      bio: bio.trim() || null,
      city: 'New York City',
      display_name: displayName.trim(),
      intent,
      max_travel_minutes: maxTravelMinutes,
      neighbourhood: neighbourhood.trim() || null,
      region: 'Manhattan',
      subregion,
    })

    setSaving(false)

    if (upsertError) {
      setError(upsertError.message)
      return
    }

    const { data: currentAvailability } = await supabase
      .from('availability')
      .select('available')
      .eq('user_id', userId)
      .eq('round_date', roundDate)
      .maybeSingle<{ available: boolean }>()

    if (currentAvailability) {
      const { error: availabilitySyncError } = await supabase
        .from('availability')
        .upsert(
          {
            available: currentAvailability.available,
            intent,
            round_date: roundDate,
            user_id: userId,
          },
          {
            onConflict: 'user_id,round_date',
          }
        )

      if (availabilitySyncError) {
        setSaving(false)
        setError(availabilitySyncError.message)
        return
      }
    }

    router.replace('/dashboard')
  }

  if (loading) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-8">
        <p className="text-sm text-zinc-600">Loading your profile...</p>
      </main>
    )
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-8 py-16">
      <div className="max-w-2xl">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-zinc-500">
          Onboarding
        </p>
        <h1 className="mt-3 text-4xl font-semibold text-zinc-950">
          Set up your Manhattan profile
        </h1>
        <p className="mt-4 text-base text-zinc-600">
          Keep this lean. The point is to capture useful match constraints, not
          invent personality theatre before the basics exist.
        </p>
      </div>

      <form onSubmit={handleSave} className="mt-10 space-y-8">
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-zinc-700">Display name</span>
            <input
              className="w-full rounded-xl border border-zinc-300 px-4 py-3 outline-none transition focus:border-zinc-950"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Alex"
              required
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-zinc-700">Subregion</span>
            <select
              className="w-full rounded-xl border border-zinc-300 px-4 py-3 outline-none transition focus:border-zinc-950"
              value={subregion}
              onChange={(event) =>
                setSubregion(event.target.value as (typeof SUBREGIONS)[number])
              }
            >
              {SUBREGIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-zinc-700">
              Neighbourhood
            </span>
            <input
              className="w-full rounded-xl border border-zinc-300 px-4 py-3 outline-none transition focus:border-zinc-950"
              value={neighbourhood}
              onChange={(event) => setNeighbourhood(event.target.value)}
              placeholder="Lower East Side"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-zinc-700">Intent</span>
            <select
              className="w-full rounded-xl border border-zinc-300 px-4 py-3 outline-none transition focus:border-zinc-950"
              value={intent}
              onChange={(event) =>
                setIntent(event.target.value as (typeof INTENTS)[number])
              }
            >
              {INTENTS.map((option) => (
                <option key={option} value={option}>
                  {option[0].toUpperCase() + option.slice(1)}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-2 sm:col-span-2">
            <span className="text-sm font-medium text-zinc-700">
              Max travel time
            </span>
            <select
              className="w-full rounded-xl border border-zinc-300 px-4 py-3 outline-none transition focus:border-zinc-950"
              value={maxTravelMinutes}
              onChange={(event) =>
                setMaxTravelMinutes(Number(event.target.value) as (typeof TRAVEL_WINDOWS)[number])
              }
            >
              {TRAVEL_WINDOWS.map((minutes) => (
                <option key={minutes} value={minutes}>
                  {minutes} minutes
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-zinc-700">Short bio</span>
          <textarea
            className="min-h-36 w-full rounded-[1.25rem] border border-zinc-300 px-4 py-3 outline-none transition focus:border-zinc-950"
            value={bio}
            onChange={(event) => setBio(event.target.value)}
            placeholder="A few lines on how you like to spend a Wednesday evening."
          />
        </label>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <button
            className="rounded-xl bg-zinc-950 px-5 py-3 font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
            type="submit"
            disabled={saving}
          >
            {saving ? 'Saving profile...' : 'Save profile'}
          </button>
          <Link
            className="rounded-xl border border-zinc-300 px-5 py-3 font-medium text-zinc-950 transition hover:border-zinc-950"
            href="/dashboard"
          >
            Back to dashboard
          </Link>
        </div>
      </form>
    </main>
  )
}
