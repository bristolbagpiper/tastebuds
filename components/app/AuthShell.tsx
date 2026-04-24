import type { ReactNode } from 'react'

import { Button } from '@/components/app/Button'

export function AuthShell({
  children,
  aside,
  title,
}: {
  aside?: ReactNode
  children: ReactNode
  title?: string
}) {
  return (
    <main className="tb-surface-bg min-h-screen px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
      <div className="mx-auto flex min-h-[calc(100vh-2.5rem)] w-full max-w-7xl flex-col gap-6 lg:min-h-[calc(100vh-4rem)]">
        <header className="tb-panel flex items-center justify-between gap-4 rounded-3xl px-5 py-4">
          <div>
            <p className="tb-label text-xs font-medium uppercase tracking-[0.18em]">
              Tastebuds
            </p>
            <p className="mt-1 text-lg font-semibold text-[color:var(--foreground)]">
              {title ?? 'Find my night'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button href="/login" variant="secondary">
              Log in
            </Button>
            <Button href="/signup">Sign up</Button>
          </div>
        </header>

        <div className="grid flex-1 gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          {aside ? (
            <section className="tb-panel-soft hidden rounded-3xl p-8 lg:flex lg:flex-col lg:justify-between">
              {aside}
            </section>
          ) : null}
          <section className="tb-panel mx-auto flex w-full max-w-xl flex-col justify-center rounded-3xl px-5 py-8 sm:px-8">
            {children}
          </section>
        </div>
      </div>
    </main>
  )
}
