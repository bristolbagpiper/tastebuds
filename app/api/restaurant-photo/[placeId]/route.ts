import { NextResponse } from 'next/server'

import { getRestaurantPlacePhoto } from '@/lib/google-places'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ placeId: string }> }
) {
  try {
    const { placeId } = await params
    const normalizedPlaceId = placeId.trim()

    if (!normalizedPlaceId) {
      return NextResponse.json({ error: 'placeId is required.' }, { status: 400 })
    }

    const photo = await getRestaurantPlacePhoto(normalizedPlaceId, 1200)

    return NextResponse.json({
      ok: true,
      photo,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to load restaurant photo.',
      },
      { status: 500 }
    )
  }
}
