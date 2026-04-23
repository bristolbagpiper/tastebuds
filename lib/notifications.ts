import 'server-only'

import { sendNotificationEmail } from '@/lib/email'
import { createServerSupabaseAdminClient } from '@/lib/supabase/server'

export type NotificationType =
  | 'event_reminder'
  | 'event_signup'
  | 'event_update'
  | 'match_accepted'
  | 'match_confirmed'
  | 'match_declined'
  | 'match_proposed'

type NotificationInput = {
  body: string
  eventId?: number | null
  matchId?: number | null
  title: string
  type: NotificationType
  userId: string
}

type QueuedNotificationRow = {
  body: string
  id: number
  title: string
  user_id: string
}

async function markNotificationEmailSkipped(
  notificationId: number,
  errorMessage: string
) {
  const adminClient = createServerSupabaseAdminClient()

  await adminClient
    .from('notifications')
    .update({
      email_attempted_at: new Date().toISOString(),
      email_error: errorMessage,
      email_status: 'skipped',
    })
    .eq('id', notificationId)
}

async function sendQueuedNotificationEmails(
  queuedNotifications: QueuedNotificationRow[]
) {
  if (queuedNotifications.length === 0) {
    return
  }

  const resendApiKey = process.env.RESEND_API_KEY
  const emailFrom = process.env.EMAIL_FROM

  if (!resendApiKey || !emailFrom) {
    await Promise.all(
      queuedNotifications.map((notification) =>
        markNotificationEmailSkipped(
          notification.id,
          'Email delivery is disabled. Configure RESEND_API_KEY and EMAIL_FROM.'
        )
      )
    )
    return
  }

  const adminClient = createServerSupabaseAdminClient()

  for (const notification of queuedNotifications) {
    const { data: userData, error: userError } =
      await adminClient.auth.admin.getUserById(notification.user_id)
    const email = userData.user?.email

    if (userError || !email) {
      await adminClient
        .from('notifications')
        .update({
          email_attempted_at: new Date().toISOString(),
          email_error: userError?.message ?? 'User has no email address.',
          email_status: 'skipped',
        })
        .eq('id', notification.id)
      continue
    }

    try {
      const delivery = await sendNotificationEmail({
        body: notification.body,
        notificationId: notification.id,
        subject: notification.title,
        to: email,
      })

      await adminClient
        .from('notifications')
        .update({
          email_attempted_at: new Date().toISOString(),
          email_error: null,
          email_provider_id: delivery.providerId,
          email_sent_at: new Date().toISOString(),
          email_status: 'sent',
        })
        .eq('id', notification.id)
    } catch (error) {
      await adminClient
        .from('notifications')
        .update({
          email_attempted_at: new Date().toISOString(),
          email_error:
            error instanceof Error ? error.message : 'Email delivery failed.',
          email_status: 'failed',
        })
        .eq('id', notification.id)
    }
  }
}

export async function queueNotifications(notifications: NotificationInput[]) {
  if (notifications.length === 0) {
    return
  }

  const adminClient = createServerSupabaseAdminClient()
  const queuedNotifications: QueuedNotificationRow[] = []

  for (const notification of notifications) {
    const { data, error } = await adminClient
      .from('notifications')
      .insert({
        body: notification.body,
        event_id: notification.eventId ?? null,
        match_id: notification.matchId ?? null,
        title: notification.title,
        type: notification.type,
        user_id: notification.userId,
      })
      .select('body, id, title, user_id')
      .single<QueuedNotificationRow>()

    if (error) {
      if (error.code === '23505') {
        continue
      }

      throw new Error(error.message)
    }

    if (data) {
      queuedNotifications.push(data)
    }
  }

  await sendQueuedNotificationEmails(queuedNotifications)
}
