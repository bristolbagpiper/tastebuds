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
          'inline-flex items-center rounded-full border border-[#f3d87a] bg-[#fff5c9] px-3 py-1 text-xs font-semibold text-[#715c00]',
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
        'rounded-[1.1rem] border border-[#f3d87a] bg-[linear-gradient(180deg,#fff8da_0%,#fff1b8_100%)] px-4 py-3 text-[#715c00] shadow-[0_10px_24px_rgba(255,215,64,0.2)]',
        className
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8b6a00]">
        Taste match
      </p>
      <div className="mt-1 flex items-end gap-2">
        <span className="text-xl font-bold leading-none text-[#4d3b00]">
          {formatMatchScore(score)}
        </span>
        <span className="text-xs font-semibold text-[#715c00]">
          {describeMatchStrength(score)}
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/60">
        <div
          className="h-full rounded-full bg-[#e0ae00]"
          style={{ width: `${clampedScore ?? 0}%` }}
        />
      </div>
    </div>
  )
}
