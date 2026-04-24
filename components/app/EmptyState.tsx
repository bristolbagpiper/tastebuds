import type { ReactNode } from 'react'

export function EmptyState({
  action,
  description,
  title,
}: {
  action?: ReactNode
  description: string
  title: string
}) {
  return (
    <div className="rounded-3xl border border-dashed border-[color:var(--border-soft)] bg-[color:var(--surface-soft)] p-8 text-center">
      <p className="text-lg font-semibold text-[color:var(--foreground)]">{title}</p>
      <p className="tb-copy mt-2 text-sm leading-6">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  )
}
