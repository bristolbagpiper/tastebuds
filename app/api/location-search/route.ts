import { NextResponse } from 'next/server'

import {
  buildLocationSearchUrl,
  mapMapboxFeatureToSuggestion,
} from '@/lib/location-search'

type MapboxSearchResponse = {
  features?: unknown[]
  message?: string
}

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get('q')?.trim() ?? ''
  const accessToken = process.env.MAPBOX_ACCESS_TOKEN

  if (!accessToken) {
    return NextResponse.json({
      providerConfigured: false,
      suggestions: [],
    })
  }

  if (query.length < 3) {
    return NextResponse.json({
      providerConfigured: true,
      suggestions: [],
    })
  }

  try {
    const response = await fetch(buildLocationSearchUrl(query, accessToken), {
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
      },
    })
    const payload = (await response.json()) as MapboxSearchResponse

    if (!response.ok) {
      return NextResponse.json(
        {
          error: payload.message ?? 'Location search failed.',
          providerConfigured: true,
          suggestions: [],
        },
        { status: response.status }
      )
    }

    const suggestions = (payload.features ?? [])
      .map((feature) => mapMapboxFeatureToSuggestion(feature as never))
      .filter((suggestion) => suggestion !== null)

    return NextResponse.json({
      providerConfigured: true,
      suggestions,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Location search failed.',
        providerConfigured: true,
        suggestions: [],
      },
      { status: 500 }
    )
  }
}
