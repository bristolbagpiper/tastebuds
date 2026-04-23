import { NextResponse } from 'next/server'

import { queueDueEventNotifications } from '@/lib/event-operations'
import { requireAdminOrCron } from '@/lib/request-auth'
import { createServerSupabaseAdminClient } from '@/lib/supabase/server'

async function runAutomation(request: Request) {
  const auth = await requireAdminOrCron(request, {
    allowAdmin: true,
    allowCron: true,
  })

  if ('error' in auth) {
    return auth.error
  }

  try {
    const adminClient = createServerSupabaseAdminClient()
    const summary = await queueDueEventNotifications(adminClient)

    return NextResponse.json({
      ok: true,
      ...summary,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to run event automation.',
      },
      { status: 500 }
    )
  }
}

export async function GET(request: Request) {
  return runAutomation(request)
}

export async function POST(request: Request) {
  return runAutomation(request)
}
