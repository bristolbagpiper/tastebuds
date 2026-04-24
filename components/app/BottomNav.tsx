import Link from 'next/link'

import { cx } from '@/lib/app/format'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Home' },
  { href: '/restaurants', label: 'Restaurants' },
  { href: '/events', label: 'Events' },
  { href: '/notifications', label: 'Inbox' },
  { href: '/profile', label: 'Profile' },
] as const

export function BottomNav({ currentPath }: { currentPath: string }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-[color:var(--border-soft)] bg-[color:rgba(255,250,244,0.95)] px-4 py-3 backdrop-blur sm:hidden">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2">
        {NAV_ITEMS.map((item) => {
          const isActive = currentPath === item.href

          return (
            <Link
              className={cx(
                'min-w-0 flex-1 rounded-2xl px-2 py-2.5 text-center text-xs font-medium transition',
                isActive
                  ? 'bg-[color:var(--accent)] text-white shadow-[0_10px_24px_rgba(199,106,74,0.2)]'
                  : 'text-[color:var(--text-muted)] hover:bg-[color:var(--surface)] hover:text-[color:var(--foreground)]'
              )}
              href={item.href}
              key={item.href}
            >
              {item.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
