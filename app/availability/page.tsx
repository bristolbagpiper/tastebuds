'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import {
  formatRoundDate,
  getIntentRoundLabel,
  getUpcomingWednesdayDate,
  type MatchIntent,
} from '@/lib/rounds'
import { supabase } from '@/lib/supabase/client'

type AvailabilityRow = {
  available: boolean
  intent: MatchIntent
}

type ProfileRow = {
  display_name: string | null
  intent: MatchIntent | null
}

export default function AvailabilityPage() {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [displayName, setDisplayName] = useState<string | null>(null)
  const [available, setAvailable] = useState(false)
  const [intent, setIntent] = useState<MatchIntent>('dating')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const roundDate = getUpcomingWednesdayDate()
  const formattedRoundDate = formatRoundDate(roundDate)
  const eventLabel = getIntentRoundLabel(intent)

  useEffect(() => {
    let active = true

    async function loadAvailability() {
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

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('display_name, intent')
        .eq('id', user.id)
        .maybeSingle<ProfileRow>()

      if (!active) {
        return
      }

      if (profileError) {
        setError(
          'The profiles table is not ready yet. Run supabase/schema.sql in the Supabase SQL editor first.'
        )
        setLoading(false)
        return
      }

      if (!profileData?.display_name) {
        router.replace('/onboarding')
        return
      }

      setDisplayName(profileData.display_name)
      const profileIntent = profileData.intent ?? 'dating'
      setIntent(profileIntent)

      const { data: availabilityData, error: availabilityError } = await supabase
        .from('availability')
        .select('available, intent')
        .eq('user_id', user.id)
        .eq('round_date', roundDate)
        .maybeSingle<AvailabilityRow>()

      if (!active) {
        return
      }

      if (availabilityError) {
        setError(
          'The availability table is missing. Run the updated supabase/schema.sql in the Supabase SQL editor.'
        )
        setLoading(false)
        return
      }

      if (availabilityData) {
        setAvailable(availabilityData.available)

        if (availabilityData.intent !== profileIntent) {
          const { error: syncError } = await supabase.from('availability').upsert(
            {
              available: availabilityData.available,
              intent: profileIntent,
              round_date: roundDate,
              user_id: user.id,
            },
            {
              onConflict: 'user_id,round_date',
            }
          )

          if (!active) {
            return
          }

          if (syncError) {
            setError(syncError.message)
            setLoading(false)
            return
          }
        }
      } else {
        setAvailable(false)
      }
      setLoading(false)
    }

    void loadAvailability()

    return () => {
      active = false
    }
  }, [roundDate, router])

  async function setRoundAvailability(nextValue: boolean) {
    if (!userId) {
      setError('You need to be logged in before updating availability.')
      return
    }

    setSaving(true)
    setError('')

    const { error: upsertError } = await supabase.from('availability').upsert(
      {
        available: nextValue,
        intent,
        round_date: roundDate,
        user_id: userId,
      },
      {
        onConflict: 'user_id,round_date',
      }
    )

    setSaving(false)

    if (upsertError) {
      setError(upsertError.message)
      return
    }

    setAvailable(nextValue)
  }

  if (loading) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-8">
        <p className="text-sm text-zinc-600">Loading round availability...</p>
      </main>
    )
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-8 py-16">
      <div className="max-w-2xl">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-zinc-500">
          Availability
        </p>
        <h1 className="mt-3 text-4xl font-semibold text-zinc-950">
          Opt in for the {eventLabel} on {formattedRoundDate}
        </h1>
        <p className="mt-4 text-base text-zinc-600">
          {displayName
            ? `${displayName}, this is the bare minimum the product needs before matching.`
            : 'This is the bare minimum the product needs before matching.'}{' '}
          Your profile intent decides whether you are entering the friendship or
          dating event stream. If the app cannot tell who is in which round, the
          rest is fiction.
        </p>
      </div>

      <div className="mt-10 rounded-[1.75rem] border border-zinc-200 bg-zinc-50 p-6">
        <p className="text-sm uppercase tracking-[0.2em] text-zinc-500">
          Next Manhattan {eventLabel}
        </p>
        <p className="mt-3 text-2xl font-semibold text-zinc-950">
          {formattedRoundDate}
        </p>
        <p className="mt-4 text-base text-zinc-700">
          Event type: <span className="font-medium text-zinc-950">{eventLabel}</span>
        </p>
        <p className="mt-4 text-base text-zinc-700">
          Status:{' '}
          <span className="font-medium text-zinc-950">
            {available
              ? `You are opted into the ${eventLabel.toLowerCase()}`
              : `You are not in this ${eventLabel.toLowerCase()} yet`}
          </span>
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            className="rounded-xl bg-zinc-950 px-5 py-3 font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
            disabled={saving || available}
            onClick={() => void setRoundAvailability(true)}
            type="button"
          >
            {saving && !available ? 'Saving...' : 'Opt in'}
          </button>
          <button
            className="rounded-xl border border-zinc-300 px-5 py-3 font-medium text-zinc-950 transition hover:border-zinc-950 disabled:cursor-not-allowed disabled:text-zinc-400"
            disabled={saving || !available}
            onClick={() => void setRoundAvailability(false)}
            type="button"
          >
            {saving && available ? 'Saving...' : 'Opt out'}
          </button>
          <Link
            className="rounded-xl border border-zinc-300 px-5 py-3 font-medium text-zinc-950 transition hover:border-zinc-950"
            href="/dashboard"
          >
            Back to dashboard
          </Link>
        </div>
      </div>

      {error ? (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}
    </main>
  )
}
