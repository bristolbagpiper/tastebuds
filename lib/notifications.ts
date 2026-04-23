import 'server-only'

import { createServerSupabaseAdminClient } from '@/lib/supabase/server'

export type NotificationType =
  | 'match_accepted'
  | 'match_confirmed'
  | 'match_declined'
  | 'match_proposed'

type NotificationInput = {
  body: string
  matchId: number
  title: string
  type: NotificationType
  userId: string
}

export async function queueNotifications(notifications: NotificationInput[]) {
  if (notifications.length === 0) {
    return
  }

  const adminClient = createServerSupabaseAdminClient()
  const { error } = await adminClient.from('notifications').upsert(
    notifications.map((notification) => ({
      body: notification.body,
      match_id: notification.matchId,
      title: notification.title,
      type: notification.type,
      user_id: notification.userId,
    })),
    {
      onConflict: 'user_id,match_id,type',
    }
  )

  if (error) {
    throw new Error(error.message)
  }
}
