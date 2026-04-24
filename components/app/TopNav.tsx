import Link from 'next/link'

import { Button } from '@/components/app/Button'
import { cx } from '@/lib/app/format'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Home' },
  { href: '/restaurants', label: 'Restaurants' },
  { href: '/events', label: 'Events' },
  { href: '/notifications', label: 'Notifications' },
  { href: '/profile', label: 'Profile' },
] as const

export function TopNav({
  currentPath,
  email,
  onLogout,
  title,
}: {
  currentPath: string
  email?: string | null
  onLogout?: () => void
  title?: string
}) {
  return (
    <header className="tb-panel rounded-3xl px-4 py-4 sm:px-5 lg:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="tb-label text-xs font-medium uppercase tracking-[0.18em]">
            Tastebuds
          </p>
          <p className="mt-1 text-lg font-semibold text-[color:var(--foreground)]">
            {title ?? 'Find my night'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {email ? <p className="tb-copy hidden text-sm sm:block">{email}</p> : null}
          {onLogout ? (
            <Button onClick={onLogout} variant="secondary">
              Log out
            </Button>
          ) : null}
        </div>
      </div>
      <nav className="mt-5 hidden flex-wrap gap-2 sm:flex">
        {NAV_ITEMS.map((item) => {
          const isActive = currentPath === item.href

          return (
            <Link
              className={cx(
                'rounded-2xl px-4 py-2.5 text-sm font-medium transition',
                isActive
                  ? 'border border-[color:var(--accent)] bg-[color:var(--accent)] text-white shadow-[0_10px_24px_rgba(199,106,74,0.22)]'
                  : 'border border-[color:var(--border-soft)] bg-[color:var(--surface-strong)] text-[color:var(--text-muted)] hover:border-[color:var(--accent)] hover:text-[color:var(--foreground)]'
              )}
              href={item.href}
              key={item.href}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>
    </header>
  )
}
