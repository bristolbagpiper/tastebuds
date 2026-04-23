import { NextResponse } from 'next/server'

import { buildMatches, buildPairKey } from '@/lib/matching'
import { queueNotifications } from '@/lib/notifications'
import { getUpcomingWednesdayDate, type MatchIntent } from '@/lib/rounds'
import {
  createServerSupabaseAdminClient,
  createServerSupabaseAuthClient,
} from '@/lib/supabase/server'

const ADMIN_REGION = 'Manhattan'
const RECENT_ROUND_LOOKBACK = 6

type AvailabilityRow = {
  user_id: string
}

type ProfileRow = {
  display_name: string | null
  id: string
  intent: MatchIntent | null
  max_travel_minutes: number | null
  neighbourhood: string | null
  subregion: string | null
}

type MatchRequest = {
  intent?: MatchIntent | 'all'
  roundDate?: string
}

type MatchRoundRow = {
  id: number
}

type HistoricMatchRow = {
  user_a: string
  user_b: string
}

type InsertedMatchRow = {
  id: number
  user_a: string
  user_b: string
}

type RoundMatchSummary = {
  id: number
  rationale: string | null
  score: number
  status: string
  userAName: string | null
  userBName: string | null
}

type RoundParticipantSummary = {
  displayName: string | null
  id: string
  neighbourhood: string | null
  subregion: string | null
}

async function requireAdmin(request: Request) {
  const authorization = request.headers.get('authorization')
  const token = authorization?.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length)
    : null

  if (!token) {
    return {
      error: NextResponse.json({ error: 'Missing bearer token.' }, { status: 401 }),
    }
  }

  const adminEmail = process.env.ADMIN_EMAIL

  if (!adminEmail) {
    return {
      error: NextResponse.json(
        {
          error:
            'Missing ADMIN_EMAIL. Set ADMIN_EMAIL and SUPABASE_SERVICE_ROLE_KEY in .env.local and your deployment environment.',
        },
        { status: 500 }
      ),
    }
  }

  const authClient = createServerSupabaseAuthClient()
  const {
    data: { user },
    error,
  } = await authClient.auth.getUser(token)

  if (error || !user) {
    return {
      error: NextResponse.json({ error: 'Invalid session.' }, { status: 401 }),
    }
  }

  if (user.email?.toLowerCase() !== adminEmail.toLowerCase()) {
    return {
      error: NextResponse.json({ error: 'Admin access only.' }, { status: 403 }),
    }
  }

  return { user }
}

async function loadBlockedPairKeys(
  roundDate: string,
  intent: MatchIntent
) {
  const adminClient = createServerSupabaseAdminClient()
  const { data: previousRounds, error: previousRoundsError } = await adminClient
    .from('match_rounds')
    .select('id')
    .eq('region', ADMIN_REGION)
    .eq('intent', intent)
    .lt('round_date', roundDate)
    .order('round_date', { ascending: false })
    .limit(RECENT_ROUND_LOOKBACK)
    .returns<MatchRoundRow[]>()

  if (previousRoundsError) {
    throw new Error(previousRoundsError.message)
  }

  const previousRoundIds = previousRounds?.map((round) => round.id) ?? []

  if (previousRoundIds.length === 0) {
    return new Set<string>()
  }

  const { data: historicMatches, error: historicMatchesError } = await adminClient
    .from('matches')
    .select('user_a, user_b')
    .in('round_id', previousRoundIds)
    .returns<HistoricMatchRow[]>()

  if (historicMatchesError) {
    throw new Error(historicMatchesError.message)
  }

  return new Set(
    (historicMatches ?? []).map((match) => buildPairKey(match.user_a, match.user_b))
  )
}

function countRelevantBlockedPairs(
  blockedPairKeys: Set<string>,
  candidateIds: string[]
) {
  const candidateIdSet = new Set(candidateIds)

  return Array.from(blockedPairKeys).filter((pairKey) => {
    const [userA, userB] = pairKey.split('::')

    return candidateIdSet.has(userA) && candidateIdSet.has(userB)
  }).length
}

async function runIntentRound(roundDate: string, intent: MatchIntent) {
  const adminClient = createServerSupabaseAdminClient()
  const blockedPairKeys = await loadBlockedPairKeys(roundDate, intent)

  const { data: roundData, error: roundError } = await adminClient
    .from('match_rounds')
    .upsert(
      {
        completed_at: null,
        intent,
        match_count: 0,
        participant_count: 0,
        region: ADMIN_REGION,
        round_date: roundDate,
        status: 'pending',
      },
      { onConflict: 'region,round_date,intent' }
    )
    .select('id')
    .single<{ id: number }>()

  if (roundError || !roundData) {
    throw new Error(roundError?.message ?? 'Failed to create match round.')
  }

  const roundId = roundData.id

  const { error: deleteError } = await adminClient
    .from('matches')
    .delete()
    .eq('round_id', roundId)

  if (deleteError) {
    throw new Error(deleteError.message)
  }

  const { data: availabilityRows, error: availabilityError } = await adminClient
    .from('availability')
    .select('user_id')
    .eq('round_date', roundDate)
    .eq('intent', intent)
    .eq('available', true)
    .returns<AvailabilityRow[]>()

  if (availabilityError) {
    throw new Error(availabilityError.message)
  }

  const userIds = availabilityRows?.map((row) => row.user_id) ?? []

  if (userIds.length === 0) {
    const { error: finalizeError } = await adminClient
      .from('match_rounds')
      .update({
        completed_at: new Date().toISOString(),
        match_count: 0,
        participant_count: 0,
        status: 'completed',
      })
      .eq('id', roundId)

    if (finalizeError) {
      throw new Error(finalizeError.message)
    }

    return {
      blockedPairCount: blockedPairKeys.size,
      intent,
      matchCount: 0,
      participantCount: 0,
      roundId,
    }
  }

  const { data: profiles, error: profileError } = await adminClient
    .from('profiles')
    .select(
      'display_name, id, intent, max_travel_minutes, neighbourhood, subregion'
    )
    .eq('region', ADMIN_REGION)
    .eq('intent', intent)
    .in('id', userIds)
    .returns<ProfileRow[]>()

  if (profileError) {
    throw new Error(profileError.message)
  }

  const candidates =
    profiles?.filter(
      (profile) =>
        Boolean(profile.id) &&
        Boolean(profile.subregion) &&
        profile.max_travel_minutes !== null
    ) ?? []
  const blockedPairCount = countRelevantBlockedPairs(
    blockedPairKeys,
    candidates.map((candidate) => candidate.id)
  )

  const matches = buildMatches(candidates, intent, {
    blockedPairKeys,
  })

  if (matches.length > 0) {
    const { data: insertedMatches, error: insertError } = await adminClient
      .from('matches')
      .insert(
        matches.map((match) => ({
          intent,
          rationale: match.rationale,
          round_id: roundId,
          score: match.score,
          status: 'proposed',
          user_a_response: 'pending',
          user_b_response: 'pending',
          user_a: match.userA.id,
          user_b: match.userB.id,
        }))
      )
      .select('id, user_a, user_b')
      .returns<InsertedMatchRow[]>()

    if (insertError) {
      throw new Error(insertError.message)
    }

    await queueNotifications(
      (insertedMatches ?? []).flatMap((match) => [
        {
          body: `You have a proposed ${intent} match for this Wednesday. Review it and accept or decline.`,
          matchId: match.id,
          title: 'New match proposed',
          type: 'match_proposed',
          userId: match.user_a,
        },
        {
          body: `You have a proposed ${intent} match for this Wednesday. Review it and accept or decline.`,
          matchId: match.id,
          title: 'New match proposed',
          type: 'match_proposed',
          userId: match.user_b,
        },
      ])
    )
  }

  const { error: finalizeError } = await adminClient
    .from('match_rounds')
    .update({
      completed_at: new Date().toISOString(),
      match_count: matches.length,
      participant_count: candidates.length,
      status: 'completed',
    })
    .eq('id', roundId)

  if (finalizeError) {
    throw new Error(finalizeError.message)
  }

  return {
    blockedPairCount,
    intent,
    matchCount: matches.length,
    participantCount: candidates.length,
    roundId,
  }
}

async function loadIntentRoundSummary(roundDate: string, intent: MatchIntent) {
  const adminClient = createServerSupabaseAdminClient()
  const blockedPairKeys = await loadBlockedPairKeys(roundDate, intent)

  const { data: round } = await adminClient
    .from('match_rounds')
    .select('id, match_count, participant_count, status')
    .eq('region', ADMIN_REGION)
    .eq('round_date', roundDate)
    .eq('intent', intent)
    .maybeSingle<{
      id: number
      match_count: number
      participant_count: number
      status: string
    }>()

  const { data: participants } = await adminClient
    .from('profiles')
    .select('display_name, id, neighbourhood, subregion')
    .eq('region', ADMIN_REGION)
    .eq('intent', intent)
    .in(
      'id',
      (
        (
          await adminClient
            .from('availability')
            .select('user_id')
            .eq('round_date', roundDate)
            .eq('intent', intent)
            .eq('available', true)
        ).data ?? []
      ).map((row) => row.user_id)
    )
    .returns<RoundParticipantSummary[]>()

  let matches: RoundMatchSummary[] = []

  if (round?.id) {
    const { data: rawMatches } = await adminClient
      .from('matches')
      .select('id, rationale, score, status, user_a, user_b')
      .eq('round_id', round.id)
      .returns<
        {
          id: number
          rationale: string | null
          score: number
          status: string
          user_a: string
          user_b: string
        }[]
      >()

    if (rawMatches?.length) {
      const userIds = Array.from(
        new Set(rawMatches.flatMap((match) => [match.user_a, match.user_b]))
      )

      const { data: matchProfiles } = await adminClient
        .from('profiles')
        .select('display_name, id')
        .in('id', userIds)
        .returns<{ display_name: string | null; id: string }[]>()

      const profileNameById = new Map(
        (matchProfiles ?? []).map((profile) => [profile.id, profile.display_name])
      )

      matches = rawMatches.map((match) => ({
        id: match.id,
        rationale: match.rationale,
        score: match.score,
        status: match.status,
        userAName: profileNameById.get(match.user_a) ?? null,
        userBName: profileNameById.get(match.user_b) ?? null,
      }))
    }
  }

  return {
    blockedHistoricalPairCount: countRelevantBlockedPairs(
      blockedPairKeys,
      (participants ?? []).map((participant) => participant.id)
    ),
    intent,
    matches,
    participantCount: round?.participant_count ?? participants?.length ?? 0,
    participants: participants ?? [],
    roundId: round?.id ?? null,
    status: round?.status ?? 'pending',
    storedMatchCount: round?.match_count ?? 0,
  }
}

export async function POST(request: Request) {
  const adminCheck = await requireAdmin(request)

  if ('error' in adminCheck) {
    return adminCheck.error
  }

  let body: MatchRequest = {}

  try {
    body = (await request.json()) as MatchRequest
  } catch {
    body = {}
  }

  const roundDate = body.roundDate ?? getUpcomingWednesdayDate()
  const requestedIntent = body.intent ?? 'all'
  const intents: MatchIntent[] =
    requestedIntent === 'all' ? ['dating', 'friendship'] : [requestedIntent]

  try {
    const results = []

    for (const intent of intents) {
      results.push(await runIntentRound(roundDate, intent))
    }

    return NextResponse.json({
      ok: true,
      results,
      roundDate,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Match run failed.',
      },
      { status: 500 }
    )
  }
}

export async function GET(request: Request) {
  const adminCheck = await requireAdmin(request)

  if ('error' in adminCheck) {
    return adminCheck.error
  }

  const url = new URL(request.url)
  const roundDate = url.searchParams.get('roundDate') ?? getUpcomingWednesdayDate()
  const requestedIntent = url.searchParams.get('intent') as MatchIntent | 'all' | null
  const intents: MatchIntent[] =
    !requestedIntent || requestedIntent === 'all'
      ? ['dating', 'friendship']
      : [requestedIntent]

  const summaries = []

  for (const intent of intents) {
    summaries.push(await loadIntentRoundSummary(roundDate, intent))
  }

  return NextResponse.json({
    ok: true,
    roundDate,
    summaries,
  })
}
