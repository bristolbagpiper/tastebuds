import Link from 'next/link'

import { Button } from '@/components/app/Button'
import { TastebudsLogo } from '@/components/TastebudsLogo'
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
  onLogout,
}: {
  currentPath: string
  onLogout?: () => void
}) {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-stone-200 bg-white/90 backdrop-blur-md shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
      <div className="mx-auto flex h-20 w-full max-w-7xl items-center justify-between px-6 lg:px-8">
        <Link className="inline-flex items-center" href="/dashboard">
          <TastebudsLogo className="translate-y-[1px]" size="sm" />
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {NAV_ITEMS.map((item) => {
            const isActive = currentPath === item.href

            return (
              <Link
                className={cx(
                  'pb-1 text-sm tracking-tight transition',
                  isActive
                    ? 'border-b-2 border-[#e2a300] font-bold text-[#e2a300]'
                    : 'font-medium text-stone-500 hover:text-[#e2a300]'
                )}
                href={item.href}
                key={item.href}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          {onLogout ? (
            <Button className="hidden sm:inline-flex" onClick={onLogout} size="sm" variant="ghost">
              Log out
            </Button>
          ) : null}
        </div>
      </div>
    </header>
  )
}
