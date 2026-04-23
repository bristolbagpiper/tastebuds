import { NextResponse } from 'next/server'

import { sendNotificationEmail } from '@/lib/email'
import {
  createServerSupabaseAdminClient,
  createServerSupabaseAuthClient,
} from '@/lib/supabase/server'

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

async function requireAdmin(request: Request) {
  const authorization = request.headers.get('authorization')
  const token = authorization?.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length)
    : null

  if (!token) {
    return {
      error: NextResponse.json({ error: 'Missing bearer token.' }, { status: 401 }),
    }
  }

  const adminEmail = process.env.ADMIN_EMAIL

  if (!adminEmail) {
    return {
      error: NextResponse.json(
        { error: 'Missing ADMIN_EMAIL in your environment.' },
        { status: 500 }
      ),
    }
  }

  const authClient = createServerSupabaseAuthClient()
  const {
    data: { user },
    error,
  } = await authClient.auth.getUser(token)

  if (error || !user) {
    return {
      error: NextResponse.json({ error: 'Invalid session.' }, { status: 401 }),
    }
  }

  if (user.email?.toLowerCase() !== adminEmail.toLowerCase()) {
    return {
      error: NextResponse.json({ error: 'Admin access only.' }, { status: 403 }),
    }
  }

  return { user }
}

export async function POST(request: Request) {
  const adminCheck = await requireAdmin(request)

  if ('error' in adminCheck) {
    return adminCheck.error
  }

  let body: SendEmailRequest = {}

  try {
    body = (await request.json()) as SendEmailRequest
  } catch {
    body = {}
  }

  const limit = Math.min(Math.max(body.limit ?? 20, 1), 50)
  const adminClient = createServerSupabaseAdminClient()

  try {
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
          sendError instanceof Error
            ? sendError.message
            : 'Email delivery failed.'
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

    return NextResponse.json({
      failed,
      failures: failures.slice(0, 5),
      ok: true,
      processed: notifications?.length ?? 0,
      sent,
      skipped,
    })
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
