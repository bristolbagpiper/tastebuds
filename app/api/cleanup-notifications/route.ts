import { NextResponse } from 'next/server'

import { requireAdminOrCron } from '@/lib/request-auth'
import { createServerSupabaseAdminClient } from '@/lib/supabase/server'

type CleanupRequest = {
  days?: number
  limit?: number
}

type NotificationRow = {
  id: number
}

function parseDays(value: number | undefined) {
  return Math.min(Math.max(value ?? 30, 1), 365)
}

function parseLimit(value: number | undefined) {
  return Math.min(Math.max(value ?? 200, 1), 1000)
}

async function cleanupReadNotifications(days: number, limit: number) {
  const adminClient = createServerSupabaseAdminClient()
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  const { data: candidates, error: selectError } = await adminClient
    .from('notifications')
    .select('id')
    .not('read_at', 'is', null)
    .lt('read_at', cutoff)
    .order('read_at', { ascending: true })
    .limit(limit)
    .returns<NotificationRow[]>()

  if (selectError) {
    throw new Error(selectError.message)
  }

  const ids = (candidates ?? []).map((row) => row.id)

  if (ids.length === 0) {
    return {
      cutoff,
      days,
      deleted: 0,
      limit,
      ok: true,
    }
  }

  const { error: deleteError } = await adminClient
    .from('notifications')
    .delete()
    .in('id', ids)

  if (deleteError) {
    throw new Error(deleteError.message)
  }

  return {
    cutoff,
    days,
    deleted: ids.length,
    limit,
    ok: true,
  }
}

export async function GET(request: Request) {
  const auth = await requireAdminOrCron(request, {
    allowAdmin: true,
    allowCron: true,
  })

  if ('error' in auth) {
    return auth.error
  }

  const { searchParams } = new URL(request.url)
  const rawDays = searchParams.get('days')
  const rawLimit = searchParams.get('limit')

  const days = parseDays(rawDays ? Number(rawDays) : undefined)
  const limit = parseLimit(rawLimit ? Number(rawLimit) : undefined)

  try {
    const result = await cleanupReadNotifications(days, limit)
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to clean up notifications.',
      },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  const auth = await requireAdminOrCron(request, {
    allowAdmin: true,
    allowCron: true,
  })

  if ('error' in auth) {
    return auth.error
  }

  let body: CleanupRequest = {}

  try {
    body = (await request.json()) as CleanupRequest
  } catch {
    body = {}
  }

  const days = parseDays(body.days)
  const limit = parseLimit(body.limit)

  try {
    const result = await cleanupReadNotifications(days, limit)
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to clean up notifications.',
      },
      { status: 500 }
    )
  }
}
