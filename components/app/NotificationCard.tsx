import { Button } from '@/components/app/Button'
import { formatNotificationDate, formatNotificationType } from '@/lib/app/format'
import type { NotificationSummary } from '@/lib/app/types'

export function NotificationCard({
  deleting,
  notification,
  onDismiss,
}: {
  deleting?: boolean
  notification: NotificationSummary
  onDismiss?: () => void
}) {
  return (
    <article className="rounded-[2rem] border border-[color:var(--border-soft)] bg-white p-5 shadow-[0_10px_40px_-10px_rgba(113,92,0,0.08)]">
      <div className="flex items-start justify-between gap-4">
        <div className="max-w-3xl">
          <div className="flex flex-wrap items-center gap-2">
            {!notification.read_at ? (
              <span className="rounded-full bg-[color:var(--accent-soft)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--accent-strong)]">
                New
              </span>
            ) : null}
            <p className="text-lg font-semibold tracking-tight text-[color:var(--foreground)]">
              {notification.title}
            </p>
          </div>
          <p className="tb-label mt-2 text-xs uppercase tracking-[0.14em]">
            {formatNotificationType(notification.type)} /{' '}
            {formatNotificationDate(notification.created_at)}
          </p>
          <p className="tb-copy mt-4 text-sm leading-7">{notification.body}</p>
        </div>
        {onDismiss ? (
          <Button disabled={deleting} onClick={onDismiss} size="sm" variant="secondary">
            {deleting ? 'Deleting...' : 'Dismiss'}
          </Button>
        ) : null}
      </div>
    </article>
  )
}
