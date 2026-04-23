'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { formatRoundDate, getUpcomingWednesdayDate } from '@/lib/rounds'
import { supabase } from '@/lib/supabase/client'

type RunIntent = 'all' | 'dating' | 'friendship'

type MatchRunResult = {
  blockedPairCount: number
  intent: 'dating' | 'friendship'
  matchCount: number
  participantCount: number
  roundId: number
}

type RoundParticipantSummary = {
  displayName: string | null
  id: string
  neighbourhood: string | null
  subregion: string | null
}

type RoundMatchSummary = {
  id: number
  rationale: string | null
  score: number
  status: string
  userAName: string | null
  userBName: string | null
}

type AdminRoundSummary = {
  blockedHistoricalPairCount: number
  intent: 'dating' | 'friendship'
  matches: RoundMatchSummary[]
  participantCount: number
  participants: RoundParticipantSummary[]
  roundId: number | null
  status: string
  storedMatchCount: number
}

type EmailDeliveryResult = {
  failed: number
  failures: {
    error: string
    notificationId: number
    recipient: string | null
  }[]
  processed: number
  sent: number
  skipped: number
}

export default function AdminPage() {
  const router = useRouter()
  const [email, setEmail] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [emailDeliveryResult, setEmailDeliveryResult] =
    useState<EmailDeliveryResult | null>(null)
  const [emailSending, setEmailSending] = useState(false)
  const [running, setRunning] = useState<RunIntent | null>(null)
  const [error, setError] = useState('')
  const [results, setResults] = useState<MatchRunResult[] | null>(null)
  const [summaries, setSummaries] = useState<AdminRoundSummary[] | null>(null)
  const roundDate = getUpcomingWednesdayDate()
  const formattedRoundDate = formatRoundDate(roundDate)

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

      setEmail(user.email ?? null)

      const {
        data: { session },
      } = await supabase.auth.getSession()

      const accessToken = session?.access_token

      if (accessToken) {
        const response = await fetch(`/api/run-weekly-match?roundDate=${roundDate}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        })

        const payload = (await response.json()) as {
          error?: string
          summaries?: AdminRoundSummary[]
        }

        if (!active) {
          return
        }

        if (response.ok) {
          setSummaries(payload.summaries ?? null)
        } else {
          setError(payload.error ?? 'Failed to load round summaries.')
        }
      }

      setLoading(false)
    }

    void loadUser()

    return () => {
      active = false
    }
  }, [roundDate, router])

  async function runRound(intent: RunIntent) {
    setRunning(intent)
    setError('')
    setResults(null)

    const {
      data: { session },
    } = await supabase.auth.getSession()

    const accessToken = session?.access_token

    if (!accessToken) {
      setError('Missing active session. Log in again before running matches.')
      setRunning(null)
      return
    }

    const response = await fetch('/api/run-weekly-match', {
      body: JSON.stringify({
        intent,
        roundDate,
      }),
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      method: 'POST',
    })

    const payload = (await response.json()) as {
      error?: string
      results?: MatchRunResult[]
    }

    if (!response.ok || payload.error) {
      setError(payload.error ?? 'Failed to run the weekly match.')
      setRunning(null)
      return
    }

    setResults(payload.results ?? null)

    const summaryResponse = await fetch(`/api/run-weekly-match?roundDate=${roundDate}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    const summaryPayload = (await summaryResponse.json()) as {
      error?: string
      summaries?: AdminRoundSummary[]
    }

    if (summaryResponse.ok) {
      setSummaries(summaryPayload.summaries ?? null)
    }

    setRunning(null)
  }

  async function sendPendingEmails() {
    setEmailSending(true)
    setEmailDeliveryResult(null)
    setError('')

    const {
      data: { session },
    } = await supabase.auth.getSession()

    const accessToken = session?.access_token

    if (!accessToken) {
      setError('Missing active session. Log in again before sending emails.')
      setEmailSending(false)
      return
    }

    const response = await fetch('/api/send-notification-emails', {
      body: JSON.stringify({ limit: 20 }),
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      method: 'POST',
    })

    const payload = (await response.json()) as {
      error?: string
    } & Partial<EmailDeliveryResult>

    if (!response.ok || payload.error) {
      setError(payload.error ?? 'Failed to send pending notification emails.')
      setEmailSending(false)
      return
    }

    setEmailDeliveryResult({
      failed: payload.failed ?? 0,
      failures: payload.failures ?? [],
      processed: payload.processed ?? 0,
      sent: payload.sent ?? 0,
      skipped: payload.skipped ?? 0,
    })
    setEmailSending(false)
  }

  if (loading) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-4xl items-center px-8">
        <p className="text-sm text-zinc-600">Checking admin access...</p>
      </main>
    )
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl px-8 py-16">
      <div className="max-w-2xl">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-zinc-500">
          Admin
        </p>
        <h1 className="mt-3 text-4xl font-semibold text-zinc-950">
          Run the {formattedRoundDate} match rounds
        </h1>
        <p className="mt-4 text-base text-zinc-600">
          Logged in as <span className="font-medium text-zinc-950">{email}</span>.
          This only works when `ADMIN_EMAIL` and `SUPABASE_SERVICE_ROLE_KEY` are
          configured. Without that, you do not have an admin system, you have a
          demo button.
        </p>
      </div>

      <div className="mt-10 flex flex-wrap gap-3">
        <button
          className="rounded-xl bg-zinc-950 px-5 py-3 font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
          disabled={running !== null}
          onClick={() => void runRound('all')}
          type="button"
        >
          {running === 'all' ? 'Running all rounds...' : 'Run all'}
        </button>
        <button
          className="rounded-xl border border-zinc-950 px-5 py-3 font-medium text-zinc-950 transition hover:bg-zinc-950 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-300 disabled:text-zinc-400"
          disabled={running !== null}
          onClick={() => void runRound('dating')}
          type="button"
        >
          {running === 'dating' ? 'Running dating...' : 'Run dating'}
        </button>
        <button
          className="rounded-xl border border-zinc-950 px-5 py-3 font-medium text-zinc-950 transition hover:bg-zinc-950 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-300 disabled:text-zinc-400"
          disabled={running !== null}
          onClick={() => void runRound('friendship')}
          type="button"
        >
          {running === 'friendship'
            ? 'Running friendship...'
            : 'Run friendship'}
        </button>
        <button
          className="rounded-xl border border-zinc-950 px-5 py-3 font-medium text-zinc-950 transition hover:bg-zinc-950 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-300 disabled:text-zinc-400"
          disabled={emailSending || running !== null}
          onClick={() => void sendPendingEmails()}
          type="button"
        >
          {emailSending ? 'Sending emails...' : 'Send pending emails'}
        </button>
      </div>

      {error ? (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {emailDeliveryResult ? (
        <div className="mt-6 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
          Email run processed {emailDeliveryResult.processed} notification
          {emailDeliveryResult.processed === 1 ? '' : 's'}: sent{' '}
          {emailDeliveryResult.sent}, failed {emailDeliveryResult.failed},
          skipped {emailDeliveryResult.skipped}.
          {emailDeliveryResult.failures.length > 0 ? (
            <ul className="mt-3 space-y-2 text-red-700">
              {emailDeliveryResult.failures.map((failure) => (
                <li key={failure.notificationId}>
                  Notification {failure.notificationId}
                  {failure.recipient ? ` to ${failure.recipient}` : ''}:{' '}
                  {failure.error}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {results ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {results.map((result) => (
            <div
              key={result.intent}
              className="rounded-[1.5rem] border border-zinc-200 bg-zinc-50 p-6"
            >
              <p className="text-sm uppercase tracking-[0.2em] text-zinc-500">
                {result.intent}
              </p>
              <p className="mt-3 text-2xl font-semibold text-zinc-950">
                {result.matchCount} matches
              </p>
              <p className="mt-2 text-sm text-zinc-600">
                {result.participantCount} eligible participants in round{' '}
                {result.roundId}
              </p>
              <p className="mt-2 text-sm text-zinc-600">
                {result.blockedPairCount} prior pair
                {result.blockedPairCount === 1 ? '' : 's'} blocked from rematch
              </p>
            </div>
          ))}
        </div>
      ) : null}

      {summaries ? (
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          {summaries.map((summary) => (
            <section
              key={summary.intent}
              className="rounded-[1.5rem] border border-zinc-200 bg-zinc-50 p-6"
            >
              <p className="text-sm uppercase tracking-[0.2em] text-zinc-500">
                {summary.intent} round detail
              </p>
              <p className="mt-3 text-base text-zinc-700">
                Round ID:{' '}
                <span className="font-medium text-zinc-950">
                  {summary.roundId ?? 'not created'}
                </span>
              </p>
              <p className="mt-2 text-base text-zinc-700">
                Status:{' '}
                <span className="font-medium text-zinc-950">{summary.status}</span>
              </p>
              <p className="mt-2 text-base text-zinc-700">
                Participants:{' '}
                <span className="font-medium text-zinc-950">
                  {summary.participantCount}
                </span>
              </p>
              <p className="mt-2 text-base text-zinc-700">
                Stored matches:{' '}
                <span className="font-medium text-zinc-950">
                  {summary.storedMatchCount}
                </span>
              </p>
              <p className="mt-2 text-base text-zinc-700">
                Prior pairs blocked:{' '}
                <span className="font-medium text-zinc-950">
                  {summary.blockedHistoricalPairCount}
                </span>
              </p>

              <div className="mt-5">
                <p className="text-sm uppercase tracking-[0.2em] text-zinc-500">
                  Eligible participants
                </p>
                {summary.participants.length > 0 ? (
                  <ul className="mt-3 space-y-2 text-sm text-zinc-700">
                    {summary.participants.map((participant) => (
                      <li key={participant.id}>
                        {(participant.displayName ?? 'Unnamed user') +
                          (participant.subregion ? `, ${participant.subregion}` : '') +
                          (participant.neighbourhood
                            ? `, ${participant.neighbourhood}`
                            : '')}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-zinc-600">
                    No eligible participants.
                  </p>
                )}
              </div>

              <div className="mt-5">
                <p className="text-sm uppercase tracking-[0.2em] text-zinc-500">
                  Created matches
                </p>
                {summary.matches.length > 0 ? (
                  <ul className="mt-3 space-y-3 text-sm text-zinc-700">
                    {summary.matches.map((match) => (
                      <li key={match.id}>
                        <span className="font-medium text-zinc-950">
                          {match.userAName ?? 'Unknown'} x {match.userBName ?? 'Unknown'}
                        </span>{' '}
                        ({match.status}, score {match.score})
                        {match.rationale ? `: ${match.rationale}` : ''}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-zinc-600">No matches created.</p>
                )}
              </div>
            </section>
          ))}
        </div>
      ) : null}
    </main>
  )
}
