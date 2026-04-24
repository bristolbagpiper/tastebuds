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
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="max-w-3xl">
        {eyebrow ? (
          <p className="tb-label text-xs font-medium uppercase tracking-[0.18em]">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="mt-2 text-3xl font-semibold text-[color:var(--foreground)] sm:text-4xl">{title}</h1>
        {description ? <p className="tb-copy mt-3 max-w-2xl text-sm leading-7">{description}</p> : null}
      </div>
      {action ? <div>{action}</div> : null}
    </div>
  )
}
