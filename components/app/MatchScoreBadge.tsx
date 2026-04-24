export function MatchScoreBadge({ score }: { score: number | null | undefined }) {
  return (
    <span className="inline-flex items-center rounded-full border border-[color:var(--border-soft)] bg-[color:var(--surface)] px-3 py-1 text-sm font-medium text-[color:var(--foreground)] shadow-[0_6px_16px_rgba(86,54,34,0.05)]">
      Match {score ?? '--'}
    </span>
  )
}
