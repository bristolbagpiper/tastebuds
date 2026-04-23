import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json(
    {
      error:
        'Current-match endpoint is retired. Use /api/events for event-based signup.',
    },
    { status: 410 }
  )
}
