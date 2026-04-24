import type { ReactNode } from 'react'

export function PageHeader({
  action,
  description,
  eyebrow,
  title,
}: {
  action?: ReactNode
  description?: string
  eyebrow?: string
  title: string
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-5">
      <div className="max-w-3xl">
        {eyebrow ? (
          <p className="tb-label text-xs font-medium uppercase tracking-[0.18em]">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-[color:var(--foreground)] sm:text-5xl">
          {title}
        </h1>
        {description ? (
          <p className="tb-copy mt-4 max-w-2xl text-base leading-7">{description}</p>
        ) : null}
      </div>
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  )
}
