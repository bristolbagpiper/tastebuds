import { NextResponse } from 'next/server'

import {
  getRestaurantPoiDetails,
  searchRestaurantPois,
} from '@/lib/google-places'
import { requireAdminOrCron } from '@/lib/request-auth'

export async function GET(request: Request) {
  const adminCheck = await requireAdminOrCron(request, {
    allowAdmin: true,
    allowCron: false,
  })

  if ('error' in adminCheck) {
    return adminCheck.error
  }

  const query = new URL(request.url).searchParams.get('q')?.trim() ?? ''

  if (query.length < 3) {
    return NextResponse.json({ ok: true, results: [] })
  }

  try {
    const results = await searchRestaurantPois(query)
    return NextResponse.json({ ok: true, results })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to search restaurant POIs.',
      },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  const adminCheck = await requireAdminOrCron(request, {
    allowAdmin: true,
    allowCron: false,
  })

  if ('error' in adminCheck) {
    return adminCheck.error
  }

  try {
    const body = (await request.json()) as { placeId?: string }
    const placeId = body.placeId?.trim()

    if (!placeId) {
      return NextResponse.json({ error: 'placeId is required.' }, { status: 400 })
    }

    const details = await getRestaurantPoiDetails(placeId)
    return NextResponse.json({ ok: true, details })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to load restaurant POI details.',
      },
      { status: 500 }
    )
  }
}
