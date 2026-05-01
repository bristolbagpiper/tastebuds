import type { ReactNode } from 'react'
import { Epilogue } from 'next/font/google'

import { cx } from '@/lib/app/format'

import { BottomNav } from '@/components/app/BottomNav'
import { SiteFooter } from '@/components/app/SiteFooter'
import { TopNav } from '@/components/app/TopNav'

const epilogue = Epilogue({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800', '900'],
})

export function AppShell({
  children,
  currentPath,
  onLogout,
}: {
  children: ReactNode
  currentPath: string
  onLogout?: () => void
}) {
  const topNavProps = onLogout
    ? { currentPath, onLogout }
    : { currentPath }

  return (
    <main className={cx(epilogue.className, 'tb-surface-bg min-h-screen text-[color:var(--foreground)]')}>
      <TopNav {...topNavProps} />
      <div className="mx-auto w-full max-w-7xl px-6 py-10 pb-28 lg:px-8 lg:py-14">
        <div className={cx('space-y-10 pb-6 sm:space-y-12 lg:pb-10')}>
          {children}
        </div>
      </div>
      <SiteFooter />
      <BottomNav currentPath={currentPath} />
    </main>
  )
}
