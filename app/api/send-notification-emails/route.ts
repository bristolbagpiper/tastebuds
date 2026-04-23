import { NextResponse } from 'next/server'

import { sendNotificationEmail } from '@/lib/email'
import { requireAdminOrCron } from '@/lib/request-auth'
import { createServerSupabaseAdminClient } from '@/lib/supabase/server'

type PendingNotification = {
  body: string
  id: number
  title: string
  user_id: string
}

type SendEmailRequest = {
  limit?: number
}

type EmailFailure = {
  error: string
  notificationId: number
  recipient: string | null
}

function maskEmail(email: string) {
  const [name, domain] = email.split('@')

  if (!name || !domain) {
    return email
  }

  return `${name.slice(0, 2)}***@${domain}`
}

function parseLimit(limit: number | undefined) {
  return Math.min(Math.max(limit ?? 20, 1), 100)
}

async function processPendingNotificationEmails(limit: number) {
  const adminClient = createServerSupabaseAdminClient()

  const { data: notifications, error } = await adminClient
    .from('notifications')
    .select('body, id, title, user_id')
    .is('email_sent_at', null)
    .neq('email_status', 'skipped')
    .order('created_at', { ascending: true })
    .limit(limit)
    .returns<PendingNotification[]>()

  if (error) {
    throw new Error(error.message)
  }

  let failed = 0
  const failures: EmailFailure[] = []
  let sent = 0
  let skipped = 0

  for (const notification of notifications ?? []) {
    const { data: userData, error: userError } =
      await adminClient.auth.admin.getUserById(notification.user_id)
    const email = userData.user?.email

    if (userError || !email) {
      const errorMessage = userError?.message ?? 'User has no email address.'
      skipped += 1
      failures.push({
        error: errorMessage,
        notificationId: notification.id,
        recipient: null,
      })
      await adminClient
        .from('notifications')
        .update({
          email_attempted_at: new Date().toISOString(),
          email_error: errorMessage,
          email_status: 'skipped',
        })
        .eq('id', notification.id)
      continue
    }

    try {
      const result = await sendNotificationEmail({
        body: notification.body,
        notificationId: notification.id,
        subject: notification.title,
        to: email,
      })

      sent += 1
      await adminClient
        .from('notifications')
        .update({
          email_attempted_at: new Date().toISOString(),
          email_error: null,
          email_provider_id: result.providerId,
          email_sent_at: new Date().toISOString(),
          email_status: 'sent',
        })
        .eq('id', notification.id)
    } catch (sendError) {
      const errorMessage =
        sendError instanceof Error ? sendError.message : 'Email delivery failed.'
      failed += 1
      failures.push({
        error: errorMessage,
        notificationId: notification.id,
        recipient: maskEmail(email),
      })
      await adminClient
        .from('notifications')
        .update({
          email_attempted_at: new Date().toISOString(),
          email_error: errorMessage,
          email_status: 'failed',
        })
        .eq('id', notification.id)
    }
  }

  return {
    failed,
    failures: failures.slice(0, 5),
    ok: true,
    processed: notifications?.length ?? 0,
    sent,
    skipped,
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
  const rawLimit = searchParams.get('limit')
  const limit = parseLimit(rawLimit ? Number(rawLimit) : undefined)

  try {
    const result = await processPendingNotificationEmails(limit)
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to send notification emails.',
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

  let body: SendEmailRequest = {}

  try {
    body = (await request.json()) as SendEmailRequest
  } catch {
    body = {}
  }

  const limit = parseLimit(body.limit)

  try {
    const result = await processPendingNotificationEmails(limit)
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to send notification emails.',
      },
      { status: 500 }
    )
  }
}
