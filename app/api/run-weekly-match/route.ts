import { NextResponse } from 'next/server'

const RETIRED_MESSAGE =
  'Weekly user-to-user matching is retired. Use /api/admin/events and /api/events/signup instead.'

export async function GET() {
  return NextResponse.json({ error: RETIRED_MESSAGE }, { status: 410 })
}

export async function POST() {
  return NextResponse.json({ error: RETIRED_MESSAGE }, { status: 410 })
}
