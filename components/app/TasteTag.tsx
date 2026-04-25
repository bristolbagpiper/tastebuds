export function TasteTag({ children }: { children: string }) {
  return (
    <span className="inline-flex rounded-full border border-[color:var(--border-soft)] bg-[#f4f4f2] px-3 py-1 text-xs font-medium text-[color:var(--text-muted)]">
      {children}
    </span>
  )
}
