import { NextResponse } from 'next/server'

import { getUpcomingWednesdayDate } from '@/lib/rounds'
import {
  createServerSupabaseAdminClient,
  getUserFromAccessToken,
} from '@/lib/supabase/server'

function getBearerToken(request: Request) {
  const authorization = request.headers.get('authorization')

  if (!authorization?.startsWith('Bearer ')) {
    return null
  }

  return authorization.slice('Bearer '.length)
}

export async function GET(request: Request) {
  const token = getBearerToken(request)

  if (!token) {
    return NextResponse.json({ error: 'Missing bearer token.' }, { status: 401 })
  }

  try {
    const user = await getUserFromAccessToken(token)
    const adminClient = createServerSupabaseAdminClient()
    const roundDate = getUpcomingWednesdayDate()

    const { data: profile } = await adminClient
      .from('profiles')
      .select('intent')
      .eq('id', user.id)
      .maybeSingle<{ intent: 'dating' | 'friendship' | null }>()

    const intent = profile?.intent

    if (!intent) {
      return NextResponse.json({ match: null })
    }

    const { data: round } = await adminClient
      .from('match_rounds')
      .select('id')
      .eq('region', 'Manhattan')
      .eq('round_date', roundDate)
      .eq('intent', intent)
      .maybeSingle<{ id: number }>()

    if (!round?.id) {
      return NextResponse.json({ match: null })
    }

    const { data: match } = await adminClient
      .from('matches')
      .select(
        'id, rationale, score, status, user_a, user_b, user_a_response, user_b_response'
      )
      .eq('round_id', round.id)
      .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
      .maybeSingle<{
        id: number
        rationale: string | null
        score: number
        status: string
        user_a: string
        user_b: string
        user_a_response: 'pending' | 'accepted' | 'declined'
        user_b_response: 'pending' | 'accepted' | 'declined'
      }>()

    if (!match) {
      return NextResponse.json({ match: null })
    }

    const partnerId = match.user_a === user.id ? match.user_b : match.user_a
    const currentUserResponse =
      match.user_a === user.id ? match.user_a_response : match.user_b_response
    const partnerResponse =
      match.user_a === user.id ? match.user_b_response : match.user_a_response

    const { data: partnerProfile } = await adminClient
      .from('profiles')
      .select('bio, display_name, neighbourhood, subregion')
      .eq('id', partnerId)
      .maybeSingle<{
        bio: string | null
        display_name: string | null
        neighbourhood: string | null
        subregion: string | null
      }>()

    return NextResponse.json({
      match: {
        currentUserResponse,
        id: match.id,
        partnerBio: partnerProfile?.bio ?? null,
        partnerName: partnerProfile?.display_name ?? 'Someone in your round',
        partnerNeighbourhood: partnerProfile?.neighbourhood ?? null,
        partnerResponse,
        partnerSubregion: partnerProfile?.subregion ?? null,
        rationale: match.rationale,
        score: match.score,
        status: match.status,
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to load match.',
      },
      { status: 401 }
    )
  }
}
