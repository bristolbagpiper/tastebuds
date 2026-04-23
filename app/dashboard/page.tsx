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

type Profile = {
  bio: string | null
  display_name: string | null
  intent: string | null
  max_travel_minutes: number | null
  neighbourhood: string | null
  subregion: string | null
}

type Availability = {
  available: boolean
  intent: MatchIntent
}

type MatchResponseStatus = 'pending' | 'accepted' | 'declined'
type MatchStatus = 'proposed' | 'mutual' | 'declined'

type MatchSummary = {
  currentUserResponse: MatchResponseStatus
  id: number
  partnerBio: string | null
  partnerName: string | null
  partnerNeighbourhood: string | null
  partnerResponse: MatchResponseStatus
  partnerSubregion: string | null
  rationale: string | null
  score: number
  status: MatchStatus
}

type NotificationSummary = {
  body: string
  created_at: string
  id: number
  read_at: string | null
  title: string
  type: string
}

function getMatchStateHeading(match: MatchSummary) {
  if (match.status === 'mutual') {
    return 'Confirmed match'
  }

  if (match.status === 'declined') {
    return 'Match closed'
  }

  if (match.currentUserResponse === 'accepted') {
    return 'Waiting for them'
  }

  if (match.partnerResponse === 'accepted') {
    return 'They accepted. Your move.'
  }

  return 'Proposed match'
}

function getMatchStateCopy(match: MatchSummary) {
  if (match.status === 'mutual') {
    return 'Both of you accepted. This is now a confirmed match for the current round.'
  }

  if (match.status === 'declined') {
    return 'One of you declined, so this match is closed for this round.'
  }

  if (match.currentUserResponse === 'accepted') {
    return 'You accepted this match. It only becomes confirmed if they accept too.'
  }

  if (match.partnerResponse === 'accepted') {
    return 'They have already accepted. Accept if you want to confirm the match.'
  }

  return 'Review the match and accept or decline it. Nothing is confirmed until both people accept.'
}

function getResponseLabel(response: MatchResponseStatus) {
  if (response === 'accepted') {
    return 'Accepted'
  }

  if (response === 'declined') {
    return 'Declined'
  }

  return 'Waiting'
}

function getMeetAreaSuggestion(profile: Profile | null, match: MatchSummary) {
  const ownSubregion = profile?.subregion
  const partnerSubregion = match.partnerSubregion
  const ownNeighbourhood = profile?.neighbourhood?.trim()
  const partnerNeighbourhood = match.partnerNeighbourhood?.trim()

  if (
    ownNeighbourhood &&
    partnerNeighbourhood &&
    ownNeighbourhood.toLowerCase() === partnerNeighbourhood.toLowerCase()
  ) {
    return ownNeighbourhood
  }

  if (ownSubregion && partnerSubregion && ownSubregion === partnerSubregion) {
    return `${ownSubregion}, near a subway-friendly cafe or bar`
  }

  const subregions = new Set([ownSubregion, partnerSubregion])

  if (subregions.has('Uptown') && subregions.has('Midtown')) {
    return 'Upper Midtown, around Columbus Circle or Lincoln Center'
  }

  if (subregions.has('Midtown') && subregions.has('Downtown')) {
    return 'Flatiron or Union Square'
  }

  if (subregions.has('Uptown') && subregions.has('Downtown')) {
    return 'Midtown, around Bryant Park or Grand Central'
  }

  return 'A central Manhattan spot with easy subway access'
}

export default function DashboardPage() {
  const router = useRouter()
  const [email, setEmail] = useState<string | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [availability, setAvailability] = useState<Availability | null>(null)
  const [matchSummary, setMatchSummary] = useState<MatchSummary | null>(null)
  const [notifications, setNotifications] = useState<NotificationSummary[]>([])
  const [matchActionLoading, setMatchActionLoading] = useState(false)
  const [notificationActionLoading, setNotificationActionLoading] =
    useState(false)
  const [loading, setLoading] = useState(true)
  const [setupError, setSetupError] = useState('')
  const roundDate = getUpcomingWednesdayDate()
  const formattedRoundDate = formatRoundDate(roundDate)
  const profileIntent = (profile?.intent as MatchIntent | null) ?? 'dating'
  const eventLabel = getIntentRoundLabel(profileIntent)

  useEffect(() => {
    let active = true

    async function loadUser() {
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

      const { data: profileData, error: profileError } = await supabase
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
        setSetupError(
          'The profiles table is not ready yet. Run the SQL in supabase/schema.sql in the Supabase SQL editor.'
        )
        setLoading(false)
        return
      }

      if (!profileData?.display_name || !profileData.subregion) {
        router.replace('/onboarding')
        return
      }

      const { data: availabilityData, error: availabilityError } = await supabase
        .from('availability')
        .select('available, intent')
        .eq('user_id', user.id)
        .eq('round_date', roundDate)
        .maybeSingle<Availability>()

      if (!active) {
        return
      }

      if (availabilityError) {
        setSetupError(
          'The availability table is not ready yet. Run the updated SQL in supabase/schema.sql in the Supabase SQL editor.'
        )
        setLoading(false)
        return
      }

      const nextAvailability =
        availabilityData && availabilityData.intent !== profileData.intent
          ? { ...availabilityData, intent: profileData.intent as MatchIntent }
          : availabilityData

      if (
        availabilityData &&
        profileData.intent &&
        availabilityData.intent !== profileData.intent
      ) {
        const { error: syncError } = await supabase.from('availability').upsert(
          {
            available: availabilityData.available,
            intent: profileData.intent,
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
          setSetupError(syncError.message)
          setLoading(false)
          return
        }
      }

      setEmail(user.email ?? null)
      setProfile(profileData)
      setAvailability(nextAvailability ?? null)

      const { data: notificationData, error: notificationError } = await supabase
        .from('notifications')
        .select('body, created_at, id, read_at, title, type')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5)
        .returns<NotificationSummary[]>()

      if (!active) {
        return
      }

      if (notificationError) {
        setSetupError(
          'The notifications table is not ready yet. Run npm run db:push, then refresh the dashboard.'
        )
        setLoading(false)
        return
      }

      setNotifications(notificationData ?? [])

      const {
        data: { session },
      } = await supabase.auth.getSession()

      const accessToken = session?.access_token

      if (accessToken) {
        const response = await fetch('/api/current-match', {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        })

        const payload = (await response.json()) as {
          error?: string
          match?: MatchSummary | null
        }

        if (!active) {
          return
        }

        if (response.ok && payload.match) {
          setMatchSummary(payload.match)
        } else if (!response.ok && payload.error) {
          setSetupError(payload.error)
        }
      }

      setLoading(false)
    }

    void loadUser()

    return () => {
      active = false
    }
  }, [roundDate, router])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  async function markNotificationsRead() {
    const unreadIds = notifications
      .filter((notification) => !notification.read_at)
      .map((notification) => notification.id)

    if (unreadIds.length === 0) {
      return
    }

    setNotificationActionLoading(true)

    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .in('id', unreadIds)

    if (error) {
      setSetupError(error.message)
      setNotificationActionLoading(false)
      return
    }

    const readAt = new Date().toISOString()

    setNotifications((current) =>
      current.map((notification) =>
        unreadIds.includes(notification.id)
          ? { ...notification, read_at: readAt }
          : notification
      )
    )
    setNotificationActionLoading(false)
  }

  async function respondToMatch(response: 'accepted' | 'declined') {
    if (!matchSummary) {
      return
    }

    setMatchActionLoading(true)

    const {
      data: { session },
    } = await supabase.auth.getSession()

    const accessToken = session?.access_token

    if (!accessToken) {
      setSetupError('Missing active session. Log in again before responding.')
      setMatchActionLoading(false)
      return
    }

    const result = await fetch('/api/match-response', {
      body: JSON.stringify({
        matchId: matchSummary.id,
        response,
      }),
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      method: 'POST',
    })

    const payload = (await result.json()) as {
      currentUserResponse?: MatchResponseStatus
      error?: string
      partnerResponse?: MatchResponseStatus
      status?: MatchStatus
      user_a_response?: MatchResponseStatus
      user_b_response?: MatchResponseStatus
    }

    if (!result.ok || payload.error) {
      setSetupError(payload.error ?? 'Failed to update the match response.')
      setMatchActionLoading(false)
      return
    }

    setMatchSummary((current) =>
      current
        ? {
            ...current,
            currentUserResponse: payload.currentUserResponse ?? response,
            partnerResponse: payload.partnerResponse ?? current.partnerResponse,
            status: payload.status ?? current.status,
          }
        : current
    )
    setMatchActionLoading(false)
  }

  if (loading) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-8">
        <p className="text-sm text-zinc-600">Checking your session...</p>
      </main>
    )
  }

  if (setupError) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center px-8 py-16">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-zinc-500">
          Dashboard
        </p>
        <h1 className="mt-3 text-4xl font-semibold text-zinc-950">
          Auth works. Data setup does not.
        </h1>
        <p className="mt-4 max-w-2xl text-base text-zinc-600">{setupError}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            className="rounded-xl border border-zinc-950 px-4 py-3 font-medium text-zinc-950 transition hover:bg-zinc-950 hover:text-white"
            href="/"
          >
            Back to home
          </Link>
          <button
            className="rounded-xl bg-zinc-950 px-4 py-3 font-medium text-white transition hover:bg-zinc-800"
            onClick={handleLogout}
            type="button"
          >
            Log out
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center px-8 py-16">
      <p className="text-sm font-medium uppercase tracking-[0.2em] text-zinc-500">
        Dashboard
      </p>
      <h1 className="mt-3 text-4xl font-semibold text-zinc-950">
        You&apos;re signed in.
      </h1>
      <p className="mt-4 max-w-2xl text-base text-zinc-600">
        Logged in as <span className="font-medium text-zinc-950">{email}</span>.
        The app now has a profile layer behind auth, which is the first actually
        useful step toward Wednesday match runs.
      </p>

      <div className="mt-8 rounded-[1.75rem] border border-zinc-200 bg-zinc-50 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-zinc-500">
              Notifications
            </p>
            <p className="mt-2 text-sm text-zinc-600">
              Match updates are stored here first. Email delivery comes later.
            </p>
          </div>
          <button
            className="rounded-xl border border-zinc-950 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-zinc-950 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-300 disabled:text-zinc-400"
            disabled={
              notificationActionLoading ||
              notifications.every((notification) => notification.read_at)
            }
            onClick={() => void markNotificationsRead()}
            type="button"
          >
            {notificationActionLoading ? 'Marking...' : 'Mark all read'}
          </button>
        </div>
        {notifications.length > 0 ? (
          <ul className="mt-5 space-y-3">
            {notifications.map((notification) => (
              <li
                className="rounded-2xl border border-zinc-200 bg-white p-4"
                key={notification.id}
              >
                <div className="flex flex-wrap items-center gap-2">
                  {!notification.read_at ? (
                    <span className="rounded-full bg-zinc-950 px-2 py-0.5 text-xs font-medium uppercase tracking-[0.12em] text-white">
                      New
                    </span>
                  ) : null}
                  <p className="text-sm font-semibold text-zinc-950">
                    {notification.title}
                  </p>
                </div>
                <p className="mt-2 text-sm leading-6 text-zinc-600">
                  {notification.body}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-5 text-sm text-zinc-600">
            No notifications yet. Run a round or respond to a match to create
            one.
          </p>
        )}
      </div>

      <div className="mt-8 grid gap-4 rounded-[1.75rem] border border-zinc-200 bg-zinc-50 p-6 sm:grid-cols-2">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-zinc-500">
            Profile
          </p>
          <p className="mt-3 text-2xl font-semibold text-zinc-950">
            {profile?.display_name}
          </p>
          <p className="mt-2 text-sm text-zinc-600">
            {profile?.subregion}
            {profile?.neighbourhood ? `, ${profile.neighbourhood}` : ''}
          </p>
        </div>
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-zinc-500">
            This round
          </p>
          <p className="mt-3 text-base text-zinc-700">{formattedRoundDate}</p>
          <p className="mt-2 text-base text-zinc-700">
            Event type:{' '}
            <span className="font-medium text-zinc-950">{eventLabel}</span>
          </p>
          <p className="mt-2 text-base text-zinc-700">
            Status:{' '}
            <span className="font-medium text-zinc-950">
              {availability?.available
                ? `Opted into the ${eventLabel.toLowerCase()}`
                : `Not opted into the ${eventLabel.toLowerCase()}`}
            </span>
          </p>
        </div>
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-zinc-500">
            Match settings
          </p>
          <p className="mt-3 text-base text-zinc-700">
            Intent: <span className="font-medium text-zinc-950">{profile?.intent}</span>
          </p>
          <p className="mt-2 text-base text-zinc-700">
            Max travel:{' '}
            <span className="font-medium text-zinc-950">
              {profile?.max_travel_minutes} minutes
            </span>
          </p>
        </div>
      </div>

      <div className="mt-6 rounded-[1.75rem] border border-zinc-200 bg-zinc-50 p-6">
        <p className="text-sm uppercase tracking-[0.2em] text-zinc-500">
          Current match
        </p>
        {matchSummary ? (
          <>
            <div className="mt-3 rounded-2xl border border-zinc-200 bg-white p-4">
              <p className="text-sm font-semibold text-zinc-950">
                {getMatchStateHeading(matchSummary)}
              </p>
              <p className="mt-2 text-sm leading-6 text-zinc-600">
                {getMatchStateCopy(matchSummary)}
              </p>
            </div>
            <p className="mt-3 text-2xl font-semibold text-zinc-950">
              {matchSummary.partnerName}
            </p>
            <p className="mt-2 text-sm text-zinc-600">
              {matchSummary.partnerSubregion}
              {matchSummary.partnerNeighbourhood
                ? `, ${matchSummary.partnerNeighbourhood}`
                : ''}
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-sm">
              <span className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-zinc-700">
                You: {getResponseLabel(matchSummary.currentUserResponse)}
              </span>
              <span className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-zinc-700">
                Them: {getResponseLabel(matchSummary.partnerResponse)}
              </span>
              <span className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-zinc-700">
                Score: {matchSummary.score}
              </span>
            </div>
            {matchSummary.rationale ? (
              <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-600">
                {matchSummary.rationale}
              </p>
            ) : null}
            {matchSummary.partnerBio ? (
              <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-600">
                {matchSummary.partnerBio}
              </p>
            ) : null}
            {matchSummary.status === 'mutual' ? (
              <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-800">
                  Suggested next step
                </p>
                <p className="mt-3 text-lg font-semibold text-emerald-950">
                  Meet near {getMeetAreaSuggestion(profile, matchSummary)}
                </p>
                <p className="mt-2 text-sm leading-6 text-emerald-900">
                  Use Wednesday evening as the default plan for now. Pick a
                  public venue, keep the first meet short, and agree the exact
                  time outside the app until messaging or email notifications are
                  added.
                </p>
              </div>
            ) : null}
            {matchSummary.status === 'proposed' &&
            matchSummary.currentUserResponse === 'pending' ? (
              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  className="rounded-xl bg-zinc-950 px-4 py-3 font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
                  disabled={matchActionLoading}
                  onClick={() => void respondToMatch('accepted')}
                  type="button"
                >
                  {matchActionLoading ? 'Saving...' : 'Accept match'}
                </button>
                <button
                  className="rounded-xl border border-zinc-950 px-4 py-3 font-medium text-zinc-950 transition hover:bg-zinc-950 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-300 disabled:text-zinc-400"
                  disabled={matchActionLoading}
                  onClick={() => void respondToMatch('declined')}
                  type="button"
                >
                  Decline match
                </button>
              </div>
            ) : null}
          </>
        ) : (
          <p className="mt-3 text-sm text-zinc-600">
            No match has been generated for your current event yet.
          </p>
        )}
      </div>

      {profile?.bio ? (
        <p className="mt-6 max-w-2xl text-sm leading-7 text-zinc-600">
          {profile.bio}
        </p>
      ) : null}

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          className="rounded-xl border border-zinc-950 px-4 py-3 font-medium text-zinc-950 transition hover:bg-zinc-950 hover:text-white"
          href="/admin"
        >
          Open admin
        </Link>
        <Link
          className="rounded-xl border border-zinc-950 px-4 py-3 font-medium text-zinc-950 transition hover:bg-zinc-950 hover:text-white"
          href="/availability"
        >
          {availability?.available
            ? `Update ${eventLabel.toLowerCase()}`
            : `Opt into ${eventLabel.toLowerCase()}`}
        </Link>
        <Link
          className="rounded-xl border border-zinc-950 px-4 py-3 font-medium text-zinc-950 transition hover:bg-zinc-950 hover:text-white"
          href="/onboarding"
        >
          Edit profile
        </Link>
        <Link
          className="rounded-xl border border-zinc-950 px-4 py-3 font-medium text-zinc-950 transition hover:bg-zinc-950 hover:text-white"
          href="/"
        >
          Back to home
        </Link>
        <button
          className="rounded-xl bg-zinc-950 px-4 py-3 font-medium text-white transition hover:bg-zinc-800"
          onClick={handleLogout}
          type="button"
        >
          Log out
        </button>
      </div>
    </main>
  )
}
