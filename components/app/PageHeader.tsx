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
    <section className="flex flex-wrap items-end justify-between gap-5">
      <div className="max-w-3xl">
        {eyebrow ? (
          <p className="tb-label text-xs font-semibold uppercase tracking-[0.18em]">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="mt-3 text-[2.5rem] font-bold leading-none tracking-[-0.04em] text-[color:var(--foreground)] sm:text-[3.25rem]">
          {title}
        </h1>
        {description ? (
          <p className="tb-copy mt-4 max-w-2xl text-base leading-7">{description}</p>
        ) : null}
      </div>
      {action ? <div className="flex flex-wrap gap-2 pt-1">{action}</div> : null}
    </section>
  )
}
