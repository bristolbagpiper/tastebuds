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
    <div className="rounded-[2rem] border border-dashed border-[color:var(--border-soft)] bg-white p-8 text-center shadow-[0_10px_40px_-10px_rgba(113,92,0,0.08)]">
      <p className="text-2xl font-semibold tracking-tight text-[color:var(--foreground)]">{title}</p>
      <p className="tb-copy mt-3 text-sm leading-6">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  )
}
