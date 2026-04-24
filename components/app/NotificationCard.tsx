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
    <article className="tb-panel-soft rounded-3xl p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            {!notification.read_at ? (
              <span className="rounded-full bg-[color:var(--accent)] px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.14em] text-white">
                New
              </span>
            ) : null}
            <p className="text-base font-semibold text-[color:var(--foreground)]">
              {notification.title}
            </p>
          </div>
          <p className="tb-label mt-2 text-xs uppercase tracking-[0.14em]">
            {formatNotificationType(notification.type)} -{' '}
            {formatNotificationDate(notification.created_at)}
          </p>
          <p className="tb-copy mt-3 text-sm leading-6">{notification.body}</p>
        </div>
        {onDismiss ? (
          <Button disabled={deleting} onClick={onDismiss} size="sm" variant="ghost">
            {deleting ? 'Deleting...' : 'Dismiss'}
          </Button>
        ) : null}
      </div>
    </article>
  )
}
