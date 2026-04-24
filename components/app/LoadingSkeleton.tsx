import { AppShell } from '@/components/app/AppShell'
import { AuthShell } from '@/components/app/AuthShell'

function SkeletonBlock({
  className,
}: {
  className: string
}) {
  return <div className={`tb-skeleton ${className}`} />
}

export function AppPageSkeleton({
  currentPath,
  title,
  variant = 'list',
}: {
  currentPath: string
  title: string
  variant?: 'dashboard' | 'detail' | 'form' | 'list'
}) {
  return (
    <AppShell currentPath={currentPath} title={title}>
      <div className="space-y-6">
        <div className="space-y-3">
          <SkeletonBlock className="h-3 w-20 rounded-full" />
          <SkeletonBlock className="h-10 w-64 rounded-2xl" />
          <SkeletonBlock className="h-4 w-full max-w-2xl rounded-full" />
          <SkeletonBlock className="h-4 w-5/6 max-w-xl rounded-full" />
        </div>

        {variant === 'dashboard' ? (
          <>
            <div className="grid gap-4 md:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div className="tb-panel-soft rounded-3xl p-5" key={index}>
                  <SkeletonBlock className="h-3 w-24 rounded-full" />
                  <SkeletonBlock className="mt-4 h-10 w-20 rounded-2xl" />
                  <SkeletonBlock className="mt-3 h-4 w-28 rounded-full" />
                </div>
              ))}
            </div>
            <div className="tb-panel-soft rounded-3xl p-6">
              <SkeletonBlock className="h-3 w-28 rounded-full" />
              <SkeletonBlock className="mt-4 h-9 w-56 rounded-2xl" />
              <SkeletonBlock className="mt-4 h-4 w-full max-w-2xl rounded-full" />
              <div className="mt-5 flex gap-3">
                <SkeletonBlock className="h-11 w-28 rounded-2xl" />
                <SkeletonBlock className="h-11 w-24 rounded-2xl" />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div className="tb-panel-soft rounded-3xl p-5" key={index}>
                  <SkeletonBlock className="h-7 w-36 rounded-2xl" />
                  <SkeletonBlock className="mt-3 h-4 w-full rounded-full" />
                  <SkeletonBlock className="mt-2 h-4 w-4/5 rounded-full" />
                </div>
              ))}
            </div>
          </>
        ) : null}

        {variant === 'list' ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <div className="tb-panel-soft rounded-3xl p-6" key={index}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-3">
                    <SkeletonBlock className="h-8 w-44 rounded-2xl" />
                    <SkeletonBlock className="h-5 w-72 rounded-full" />
                    <SkeletonBlock className="h-4 w-56 rounded-full" />
                  </div>
                  <div className="tb-panel rounded-3xl px-4 py-3">
                    <SkeletonBlock className="h-4 w-24 rounded-full" />
                    <SkeletonBlock className="mt-2 h-4 w-20 rounded-full" />
                    <SkeletonBlock className="mt-2 h-4 w-16 rounded-full" />
                  </div>
                </div>
                <SkeletonBlock className="mt-5 h-4 w-full rounded-full" />
                <SkeletonBlock className="mt-2 h-4 w-5/6 rounded-full" />
                <div className="mt-5 flex flex-wrap gap-2">
                  {Array.from({ length: 5 }).map((__, chipIndex) => (
                    <SkeletonBlock className="h-7 w-20 rounded-full" key={chipIndex} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {variant === 'detail' ? (
          <div className="tb-panel-soft rounded-3xl p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-3">
                <SkeletonBlock className="h-8 w-48 rounded-2xl" />
                <SkeletonBlock className="h-5 w-80 rounded-full" />
                <SkeletonBlock className="h-4 w-56 rounded-full" />
              </div>
              <div className="tb-panel rounded-3xl px-4 py-3">
                <SkeletonBlock className="h-4 w-24 rounded-full" />
                <SkeletonBlock className="mt-2 h-4 w-20 rounded-full" />
                <SkeletonBlock className="mt-2 h-4 w-16 rounded-full" />
              </div>
            </div>
            <SkeletonBlock className="mt-6 h-4 w-full rounded-full" />
            <SkeletonBlock className="mt-2 h-4 w-11/12 rounded-full" />
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {Array.from({ length: 2 }).map((_, index) => (
                <div className="tb-panel rounded-3xl p-4" key={index}>
                  <SkeletonBlock className="h-3 w-24 rounded-full" />
                  <SkeletonBlock className="mt-4 h-4 w-full rounded-full" />
                  <SkeletonBlock className="mt-2 h-4 w-4/5 rounded-full" />
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {variant === 'form' ? (
          <div className="space-y-6">
            <div className="grid gap-5 sm:grid-cols-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <div className="space-y-2" key={index}>
                  <SkeletonBlock className="h-4 w-28 rounded-full" />
                  <SkeletonBlock className="h-12 w-full rounded-2xl" />
                </div>
              ))}
            </div>
            <div className="tb-panel-soft rounded-3xl p-6">
              <SkeletonBlock className="h-6 w-44 rounded-2xl" />
              <div className="mt-6 space-y-5">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div className="space-y-3" key={index}>
                    <SkeletonBlock className="h-4 w-24 rounded-full" />
                    <div className="flex flex-wrap gap-2">
                      {Array.from({ length: 4 }).map((__, chipIndex) => (
                        <SkeletonBlock className="h-9 w-20 rounded-2xl" key={chipIndex} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </AppShell>
  )
}

export function AuthPageSkeleton({
  title,
}: {
  title: string
}) {
  return (
    <AuthShell
      aside={
        <div className="space-y-5">
          <SkeletonBlock className="h-3 w-24 rounded-full" />
          <SkeletonBlock className="h-14 w-full max-w-lg rounded-3xl" />
          <SkeletonBlock className="h-4 w-full rounded-full" />
          <SkeletonBlock className="h-4 w-5/6 rounded-full" />
          <div className="tb-panel mt-8 rounded-3xl p-6">
            <SkeletonBlock className="h-3 w-24 rounded-full" />
            <div className="mt-4 space-y-3">
              <SkeletonBlock className="h-4 w-full rounded-full" />
              <SkeletonBlock className="h-4 w-4/5 rounded-full" />
              <SkeletonBlock className="h-4 w-3/4 rounded-full" />
            </div>
          </div>
        </div>
      }
      title={title}
    >
      <div className="space-y-4">
        <SkeletonBlock className="h-3 w-24 rounded-full" />
        <SkeletonBlock className="h-10 w-52 rounded-2xl" />
        <SkeletonBlock className="h-4 w-full rounded-full" />
        <div className="space-y-4 pt-4">
          <div className="space-y-2">
            <SkeletonBlock className="h-4 w-20 rounded-full" />
            <SkeletonBlock className="h-12 w-full rounded-2xl" />
          </div>
          <div className="space-y-2">
            <SkeletonBlock className="h-4 w-24 rounded-full" />
            <SkeletonBlock className="h-12 w-full rounded-2xl" />
          </div>
          <SkeletonBlock className="h-12 w-full rounded-2xl" />
        </div>
      </div>
    </AuthShell>
  )
}
