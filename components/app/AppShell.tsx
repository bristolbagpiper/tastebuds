import type { ReactNode } from 'react'

import { cx } from '@/lib/app/format'

import { BottomNav } from '@/components/app/BottomNav'
import { TopNav } from '@/components/app/TopNav'

export function AppShell({
  children,
  currentPath,
  email,
  onLogout,
  title,
}: {
  children: ReactNode
  currentPath: string
  email?: string | null
  onLogout?: () => void
  title?: string
}) {
  return (
    <main className="tb-surface-bg min-h-screen text-[color:var(--foreground)]">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 pb-28 pt-5 sm:px-6 lg:px-8 lg:pb-16 lg:pt-8">
        <TopNav currentPath={currentPath} email={email} onLogout={onLogout} title={title} />
        <div className={cx('mt-8 flex-1 space-y-10 pb-6 sm:space-y-12 lg:mt-10 lg:pb-10')}>
          {children}
        </div>
      </div>
      <BottomNav currentPath={currentPath} />
    </main>
  )
}
