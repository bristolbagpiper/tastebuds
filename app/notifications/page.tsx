'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

import { AppShell } from '@/components/app/AppShell'
import { Button } from '@/components/app/Button'
import { EmptyState } from '@/components/app/EmptyState'
import { NotificationCard } from '@/components/app/NotificationCard'
import { PageHeader } from '@/components/app/PageHeader'
import {
  clearReadNotifications,
  dismissNotification,
  fetchNotifications,
  getAppBootstrap,
  logout,
  markNotificationsRead,
} from '@/lib/app/client'
import type { NotificationSummary } from '@/lib/app/types'

export default function NotificationsPage() {
  const router = useRouter()
  const [notifications, setNotifications] = useState<NotificationSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showUnreadOnly, setShowUnreadOnly] = useState(true)
  const [notificationActionLoading, setNotificationActionLoading] = useState(false)
  const [clearReadLoading, setClearReadLoading] = useState(false)
  const [notificationDeletingId, setNotificationDeletingId] = useState<number | null>(null)

  useEffect(() => {
    let active = true

    async function loadPage() {
      const bootstrap = await getAppBootstrap()

      if (!active) {
        return
      }

      const response = await fetchNotifications(bootstrap.userId)

      if (!active) {
        return
      }

      if (response.error) {
        setError(response.error.message)
        setLoading(false)
        return
      }

      setNotifications(response.data ?? [])
      setLoading(false)
    }

    void loadPage()

    return () => {
      active = false
    }
  }, [router])

  async function handleLogout() {
    await logout()
    router.replace('/login')
  }

  async function handleMarkAllRead() {
    const unreadIds = notifications.filter((item) => !item.read_at).map((item) => item.id)

    setError('')
    setNotificationActionLoading(true)

    try {
      await markNotificationsRead(unreadIds)
      const readAt = new Date().toISOString()
      setNotifications((current) =>
        current.map((notification) =>
          unreadIds.includes(notification.id)
            ? { ...notification, read_at: readAt }
            : notification
        )
      )
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not mark notifications read.')
    } finally {
      setNotificationActionLoading(false)
    }
  }

  async function handleDismiss(notificationId: number) {
    setError('')
    setNotificationDeletingId(notificationId)

    try {
      await dismissNotification(notificationId)
      setNotifications((current) =>
        current.filter((notification) => notification.id !== notificationId)
      )
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not dismiss notification.')
    } finally {
      setNotificationDeletingId(null)
    }
  }

  async function handleClearRead() {
    const readIds = notifications.filter((item) => item.read_at).map((item) => item.id)

    setError('')
    setClearReadLoading(true)

    try {
      await clearReadNotifications(readIds)
      setNotifications((current) =>
        current.filter((notification) => !readIds.includes(notification.id))
      )
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not clear read notifications.')
    } finally {
      setClearReadLoading(false)
    }
  }

  const unreadCount = notifications.filter((notification) => !notification.read_at).length
  const readCount = notifications.length - unreadCount
  const visibleNotifications = useMemo(
    () =>
      showUnreadOnly
        ? notifications.filter((notification) => !notification.read_at)
        : notifications,
    [notifications, showUnreadOnly]
  )

  if (loading) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-6xl items-center px-8">
        <p className="tb-copy text-sm">Loading notifications...</p>
      </main>
    )
  }

  return (
    <AppShell currentPath="/notifications" onLogout={handleLogout}>
      <PageHeader
        action={
          <div className="flex gap-2">
            <Button
              onClick={() => setShowUnreadOnly(true)}
              size="sm"
              variant={showUnreadOnly ? 'primary' : 'secondary'}
            >
              Unread ({unreadCount})
            </Button>
            <Button
              onClick={() => setShowUnreadOnly(false)}
              size="sm"
              variant={showUnreadOnly ? 'secondary' : 'primary'}
            >
              All ({notifications.length})
            </Button>
          </div>
        }
        description="Reminders, updates and day-of prompts for your plans."
        eyebrow="Inbox"
        title="Your dinner inbox"
      />

      {error ? (
        <div className="rounded-[1.5rem] border border-[color:var(--accent-border)] bg-[color:var(--accent-softer)] p-4 text-sm text-[color:var(--accent-strong)]">
          {error}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3 rounded-[1.75rem] border border-[color:var(--border-soft)] bg-white p-5 shadow-[0_10px_40px_-10px_rgba(113,92,0,0.08)]">
        <Button
          disabled={notificationActionLoading || unreadCount === 0}
          onClick={() => void handleMarkAllRead()}
          variant="secondary"
        >
          {notificationActionLoading ? 'Marking...' : 'Mark all read'}
        </Button>
        <Button
          disabled={clearReadLoading || readCount === 0}
          onClick={() => void handleClearRead()}
          variant="secondary"
        >
          {clearReadLoading ? 'Clearing...' : 'Clear read'}
        </Button>
      </div>

      <div className="grid gap-5">
        {visibleNotifications.length > 0 ? (
          visibleNotifications.map((notification) => (
            <NotificationCard
              deleting={notificationDeletingId === notification.id}
              key={notification.id}
              notification={notification}
              onDismiss={() => void handleDismiss(notification.id)}
            />
          ))
        ) : (
          <EmptyState
            description={
              notifications.length > 0 && showUnreadOnly
                ? 'No unread notifications. Switch to All if you want the full history.'
                : 'No notifications yet.'
            }
            title="Nothing to review"
          />
        )}
      </div>
    </AppShell>
  )
}
