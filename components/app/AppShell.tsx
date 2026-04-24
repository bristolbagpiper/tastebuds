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
        <div
          className={cx(
            'tb-panel mt-5 flex-1 rounded-3xl px-4 py-6 sm:px-6 sm:py-7 lg:mt-6 lg:px-8 lg:py-8'
          )}
        >
          {children}
        </div>
      </div>
      <BottomNav currentPath={currentPath} />
    </main>
  )
}
