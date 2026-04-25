import { NextResponse } from 'next/server'

import { searchLocationSuggestions } from '@/lib/location-search'

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get('q')?.trim() ?? ''
  const accessToken = process.env.GOOGLE_MAPS_API_KEY

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
    const suggestions = await searchLocationSuggestions(query)

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
