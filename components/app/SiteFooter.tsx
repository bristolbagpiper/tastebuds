import { TastebudsLogo } from '@/components/TastebudsLogo'

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-stone-200 bg-stone-50 py-12">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-6 md:flex-row lg:px-8">
        <TastebudsLogo size="sm" />
        <div className="flex flex-wrap items-center gap-8">
          {['Privacy', 'Terms', 'Support', 'Careers'].map((item) => (
            <span
              className="text-sm font-light tracking-wide text-stone-400"
              key={item}
            >
              {item}
            </span>
          ))}
        </div>
        <div className="text-sm font-light tracking-wide text-stone-400">
          &copy; 2026 Tastebuds. Savor the morning.
        </div>
      </div>
    </footer>
  )
}
