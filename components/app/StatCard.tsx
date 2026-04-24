export function StatCard({
  label,
  note,
  value,
}: {
  label: string
  note?: string
  value: number | string
}) {
  return (
    <section className="tb-panel-soft rounded-3xl p-5">
      <p className="tb-label text-xs font-medium uppercase tracking-[0.16em]">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-[color:var(--foreground)]">{value}</p>
      {note ? <p className="tb-copy mt-2 text-sm">{note}</p> : null}
    </section>
  )
}
