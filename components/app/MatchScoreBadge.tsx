import { cx, describeMatchStrength, formatMatchScore } from '@/lib/app/format'

export function MatchScoreBadge({
  className,
  compact = false,
  score,
}: {
  className?: string
  compact?: boolean
  score: number | null | undefined
}) {
  const clampedScore =
    typeof score === 'number' && !Number.isNaN(score)
      ? Math.max(0, Math.min(100, Math.round(score)))
      : null

  if (compact) {
    return (
      <span
        className={cx(
          'inline-flex items-center rounded-full border border-[color:var(--accent-border)] bg-[color:var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[color:var(--accent-strong)]',
          className
        )}
      >
        {formatMatchScore(score)} match
      </span>
    )
  }

  return (
    <div
      className={cx(
        'rounded-[1.1rem] border border-[color:var(--accent-border)] bg-[linear-gradient(180deg,var(--accent-softer)_0%,var(--accent-soft)_100%)] px-4 py-3 text-[color:var(--accent-strong)] shadow-[0_10px_24px_rgba(245,158,11,0.2)]',
        className
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--accent-deep)]">
        Taste match
      </p>
      <div className="mt-1 flex items-end gap-2">
        <span className="text-xl font-bold leading-none text-[color:var(--accent-text)]">
          {formatMatchScore(score)}
        </span>
        <span className="text-xs font-semibold text-[color:var(--accent-strong)]">
          {describeMatchStrength(score)}
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/60">
        <div
          className="h-full rounded-full bg-[color:var(--accent)]"
          style={{ width: `${clampedScore ?? 0}%` }}
        />
      </div>
    </div>
  )
}
