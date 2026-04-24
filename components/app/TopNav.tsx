import Link from 'next/link'

import { Button } from '@/components/app/Button'
import { cx } from '@/lib/app/format'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Home' },
  { href: '/restaurants', label: 'Restaurants' },
  { href: '/events', label: 'Events' },
  { href: '/notifications', label: 'Inbox' },
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
    <header className="rounded-[2rem] border border-[color:var(--border-soft)] bg-[color:rgba(255,251,247,0.88)] px-4 py-4 shadow-[0_18px_50px_rgba(94,74,60,0.08)] backdrop-blur sm:px-5 lg:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="tb-label text-xs font-medium uppercase tracking-[0.18em]">Tastebuds</p>
          <p className="mt-1 text-lg font-semibold text-[color:var(--foreground)]">
            {title ?? 'Find your next table'}
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
                'rounded-full px-4 py-2.5 text-sm font-medium transition',
                isActive
                  ? 'border border-[color:var(--accent)] bg-[color:var(--accent)] text-white shadow-[0_10px_24px_rgba(199,106,74,0.22)]'
                  : 'border border-[color:rgba(110,84,67,0.12)] bg-[color:rgba(255,255,255,0.66)] text-[color:var(--text-muted)] hover:border-[color:var(--accent)] hover:bg-[color:rgba(255,255,255,0.92)] hover:text-[color:var(--foreground)]'
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
