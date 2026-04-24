import Link from 'next/link'
import type { ReactNode } from 'react'

export function ActionCard({
  description,
  href,
  label,
  meta,
}: {
  description: string
  href: string
  label: string
  meta?: ReactNode
}) {
  return (
    <Link
      className="tb-panel-soft rounded-3xl p-5 transition hover:border-[color:var(--accent)] hover:bg-[color:var(--surface)]"
      href={href}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-lg font-semibold text-[color:var(--foreground)]">{label}</p>
          <p className="tb-copy mt-2 text-sm leading-6">{description}</p>
        </div>
        {meta ? <div className="shrink-0">{meta}</div> : null}
      </div>
    </Link>
  )
}
