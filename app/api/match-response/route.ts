import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    {
      error:
        'Match-response endpoint is retired. Users now join specific events directly.',
    },
    { status: 410 }
  )
}
