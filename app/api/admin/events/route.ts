import { NextResponse } from 'next/server'

import {
  MANHATTAN_SUBREGIONS,
  type EventIntent,
  type ManhattanSubregion,
  normalizeCuisineList,
} from '@/lib/events'
import {
  createServerSupabaseAdminClient,
  createServerSupabaseAuthClient,
} from '@/lib/supabase/server'

type CreateEventRequest = {
  capacity?: number
  description?: string
  intent?: EventIntent
  restaurantCuisines?: string[]
  restaurantName?: string
  restaurantNeighbourhood?: string
  restaurantSubregion?: string
  startsAt?: string
  title?: string
}

type EventSummary = {
  attendeeCount: number
  capacity: number
  created_at: string
  description: string | null
  id: number
  intent: EventIntent
  restaurant_cuisines: string[]
  restaurant_name: string
  restaurant_neighbourhood: string | null
  restaurant_subregion: string
  starts_at: string
  status: 'open' | 'closed' | 'cancelled'
  title: string
}

function parseBearerToken(request: Request) {
  const authorization = request.headers.get('authorization')

  if (!authorization?.startsWith('Bearer ')) {
    return null
  }

  return authorization.slice('Bearer '.length)
}

async function requireAdmin(request: Request) {
  const token = parseBearerToken(request)

  if (!token) {
    return {
      error: NextResponse.json({ error: 'Missing bearer token.' }, { status: 401 }),
    }
  }

  const adminEmail = process.env.ADMIN_EMAIL

  if (!adminEmail) {
    return {
      error: NextResponse.json(
        { error: 'Missing ADMIN_EMAIL in environment.' },
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

async function fetchEvents() {
  const adminClient = createServerSupabaseAdminClient()
  const { data: events, error } = await adminClient
    .from('events')
    .select(
      'capacity, created_at, description, id, intent, restaurant_cuisines, restaurant_name, restaurant_neighbourhood, restaurant_subregion, starts_at, status, title'
    )
    .order('starts_at', { ascending: true })
    .limit(60)
    .returns<EventSummary[]>()

  if (error) {
    throw new Error(error.message)
  }

  const eventIds = (events ?? []).map((event) => event.id)

  if (eventIds.length === 0) {
    return [] as EventSummary[]
  }

  const { data: signups, error: signupsError } = await adminClient
    .from('event_signups')
    .select('event_id')
    .eq('status', 'going')
    .in('event_id', eventIds)
    .returns<{ event_id: number }[]>()

  if (signupsError) {
    throw new Error(signupsError.message)
  }

  const attendeeCountByEvent = new Map<number, number>()

  for (const signup of signups ?? []) {
    attendeeCountByEvent.set(
      signup.event_id,
      (attendeeCountByEvent.get(signup.event_id) ?? 0) + 1
    )
  }

  return (events ?? []).map((event) => ({
    ...event,
    attendeeCount: attendeeCountByEvent.get(event.id) ?? 0,
  }))
}

export async function GET(request: Request) {
  const adminCheck = await requireAdmin(request)

  if ('error' in adminCheck) {
    return adminCheck.error
  }

  try {
    const events = await fetchEvents()

    return NextResponse.json({
      events,
      ok: true,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to load admin events.',
      },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  const adminCheck = await requireAdmin(request)

  if ('error' in adminCheck) {
    return adminCheck.error
  }

  let body: CreateEventRequest = {}

  try {
    body = (await request.json()) as CreateEventRequest
  } catch {
    body = {}
  }

  const title = body.title?.trim()
  const restaurantName = body.restaurantName?.trim()
  const restaurantSubregion = body.restaurantSubregion?.trim() ?? ''
  const restaurantNeighbourhood = body.restaurantNeighbourhood?.trim() ?? ''
  const intent = body.intent
  const startsAt = body.startsAt
  const description = body.description?.trim() ?? ''
  const capacity = Number(body.capacity ?? 0)
  const cuisines = normalizeCuisineList(body.restaurantCuisines ?? [])

  if (!title || !restaurantName || !intent || !startsAt) {
    return NextResponse.json(
      {
        error: 'title, intent, startsAt, and restaurantName are required.',
      },
      { status: 400 }
    )
  }

  if (
    !MANHATTAN_SUBREGIONS.includes(
      restaurantSubregion as ManhattanSubregion
    )
  ) {
    return NextResponse.json(
      {
        error: 'restaurantSubregion must be Uptown, Midtown, or Downtown.',
      },
      { status: 400 }
    )
  }

  if (!Number.isFinite(capacity) || capacity < 2 || capacity > 200) {
    return NextResponse.json(
      {
        error: 'capacity must be a number between 2 and 200.',
      },
      { status: 400 }
    )
  }

  const startsAtDate = new Date(startsAt)

  if (Number.isNaN(startsAtDate.getTime())) {
    return NextResponse.json(
      {
        error: 'startsAt must be a valid datetime.',
      },
      { status: 400 }
    )
  }

  try {
    const adminClient = createServerSupabaseAdminClient()
    const { data: insertedEvent, error } = await adminClient
      .from('events')
      .insert({
        capacity,
        created_by: adminCheck.user.id,
        description: description || null,
        intent,
        restaurant_cuisines: cuisines,
        restaurant_name: restaurantName,
        restaurant_neighbourhood: restaurantNeighbourhood || null,
        restaurant_subregion: restaurantSubregion,
        starts_at: startsAtDate.toISOString(),
        title,
      })
      .select(
        'capacity, created_at, description, id, intent, restaurant_cuisines, restaurant_name, restaurant_neighbourhood, restaurant_subregion, starts_at, status, title'
      )
      .single<EventSummary>()

    if (error || !insertedEvent) {
      throw new Error(error?.message ?? 'Failed to create event.')
    }

    return NextResponse.json({
      event: {
        ...insertedEvent,
        attendeeCount: 0,
      },
      ok: true,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to create event.',
      },
      { status: 500 }
    )
  }
}
