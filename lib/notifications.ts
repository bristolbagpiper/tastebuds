import 'server-only'

import { sendNotificationEmail } from '@/lib/email'
import { createServerSupabaseAdminClient } from '@/lib/supabase/server'

export type NotificationType =
  | 'event_signup'
  | 'event_update'
  | 'event_at_risk'
  | 'event_reminder_24h'
  | 'event_reminder_2h'
  | 'event_follow_up'
  | 'event_waitlist'
  | 'event_promoted'
  | 'event_day_confirmation'
  | 'event_attendance'

type NotificationInput = {
  body: string
  duplicateBehavior?: 'rearm' | 'skip'
  eventId: number
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

type AdminClient = ReturnType<typeof createServerSupabaseAdminClient>

async function rearmExistingNotification(
  adminClient: AdminClient,
  notification: NotificationInput
) {
  const query = adminClient
    .from('notifications')
    .select('body, id, title, user_id')
    .eq('user_id', notification.userId)
    .eq('type', notification.type)
    .eq('event_id', notification.eventId)

  const { data: existingNotification, error: findError } =
    await query.maybeSingle()

  if (findError) {
    throw new Error(findError.message)
  }

  if (!existingNotification) {
    return null
  }

  const nowIso = new Date().toISOString()

  const { data: updatedNotification, error: updateError } = await adminClient
    .from('notifications')
    .update({
      body: notification.body,
      created_at: nowIso,
      email_attempted_at: null,
      email_error: null,
      email_provider_id: null,
      email_sent_at: null,
      email_status: 'pending',
      read_at: null,
      title: notification.title,
    })
    .eq('id', existingNotification.id)
    .select('body, id, title, user_id')
    .single()

  if (updateError || !updatedNotification) {
    throw new Error(updateError?.message ?? 'Failed to rearm notification.')
  }

  return updatedNotification
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
        attemptKey: `notification-${notification.id}-${Date.now()}`,
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

  const adminClient: AdminClient = createServerSupabaseAdminClient()
  const queuedNotifications: QueuedNotificationRow[] = []

  for (const notification of notifications) {
    const { data, error } = await adminClient
      .from('notifications')
      .insert({
        body: notification.body,
        event_id: notification.eventId,
        title: notification.title,
        type: notification.type,
        user_id: notification.userId,
      })
      .select('body, id, title, user_id')
      .single()

    if (error) {
      if (error.code === '23505') {
        if ((notification.duplicateBehavior ?? 'rearm') === 'skip') {
          continue
        }

        const rearmedNotification = await rearmExistingNotification(adminClient, notification)

        if (rearmedNotification) {
          queuedNotifications.push(rearmedNotification)
        }

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
