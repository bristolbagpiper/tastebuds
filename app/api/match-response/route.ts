import { NextResponse } from 'next/server'

import { queueNotifications } from '@/lib/notifications'
import {
  createServerSupabaseAdminClient,
  getUserFromAccessToken,
} from '@/lib/supabase/server'

type MatchResponsePayload = {
  matchId?: number
  response?: 'accepted' | 'declined'
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get('authorization')

  if (!authorization?.startsWith('Bearer ')) {
    return null
  }

  return authorization.slice('Bearer '.length)
}

export async function POST(request: Request) {
  const token = getBearerToken(request)

  if (!token) {
    return NextResponse.json({ error: 'Missing bearer token.' }, { status: 401 })
  }

  let body: MatchResponsePayload

  try {
    body = (await request.json()) as MatchResponsePayload
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  if (!body.matchId || !body.response) {
    return NextResponse.json(
      { error: 'matchId and response are required.' },
      { status: 400 }
    )
  }

  try {
    const user = await getUserFromAccessToken(token)
    const adminClient = createServerSupabaseAdminClient()

    const { data: match, error: matchError } = await adminClient
      .from('matches')
      .select('id, user_a, user_b, user_a_response, user_b_response')
      .eq('id', body.matchId)
      .maybeSingle<{
        id: number
        user_a: string
        user_b: string
        user_a_response: 'pending' | 'accepted' | 'declined'
        user_b_response: 'pending' | 'accepted' | 'declined'
      }>()

    if (matchError || !match) {
      return NextResponse.json({ error: 'Match not found.' }, { status: 404 })
    }

    const isUserA = match.user_a === user.id
    const isUserB = match.user_b === user.id

    if (!isUserA && !isUserB) {
      return NextResponse.json({ error: 'Not your match.' }, { status: 403 })
    }

    const nextUserAResponse = isUserA ? body.response : match.user_a_response
    const nextUserBResponse = isUserB ? body.response : match.user_b_response

    let status: 'proposed' | 'mutual' | 'declined' = 'proposed'

    if (
      nextUserAResponse === 'declined' ||
      nextUserBResponse === 'declined'
    ) {
      status = 'declined'
    } else if (
      nextUserAResponse === 'accepted' &&
      nextUserBResponse === 'accepted'
    ) {
      status = 'mutual'
    }

    const { error: updateError } = await adminClient
      .from('matches')
      .update({
        status,
        user_a_response: nextUserAResponse,
        user_b_response: nextUserBResponse,
      })
      .eq('id', body.matchId)

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      )
    }

    const currentUserResponse = isUserA ? nextUserAResponse : nextUserBResponse
    const partnerResponse = isUserA ? nextUserBResponse : nextUserAResponse
    const partnerId = isUserA ? match.user_b : match.user_a

    if (status === 'mutual') {
      await queueNotifications([
        {
          body: 'Both of you accepted. Check your dashboard for the suggested meet area.',
          matchId: match.id,
          title: 'Match confirmed',
          type: 'match_confirmed',
          userId: match.user_a,
        },
        {
          body: 'Both of you accepted. Check your dashboard for the suggested meet area.',
          matchId: match.id,
          title: 'Match confirmed',
          type: 'match_confirmed',
          userId: match.user_b,
        },
      ])
    } else if (status === 'declined') {
      await queueNotifications([
        {
          body: 'This proposed match was declined, so it is closed for this round.',
          matchId: match.id,
          title: 'Match closed',
          type: 'match_declined',
          userId: match.user_a,
        },
        {
          body: 'This proposed match was declined, so it is closed for this round.',
          matchId: match.id,
          title: 'Match closed',
          type: 'match_declined',
          userId: match.user_b,
        },
      ])
    } else if (body.response === 'accepted') {
      await queueNotifications([
        {
          body: 'Your match accepted. Accept too if you want to confirm it.',
          matchId: match.id,
          title: 'Your match accepted',
          type: 'match_accepted',
          userId: partnerId,
        },
      ])
    }

    return NextResponse.json({
      currentUserResponse,
      ok: true,
      partnerResponse,
      status,
      user_a_response: nextUserAResponse,
      user_b_response: nextUserBResponse,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to update match.',
      },
      { status: 401 }
    )
  }
}
