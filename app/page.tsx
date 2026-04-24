import { ActionCard } from '@/components/app/ActionCard'
import { AuthShell } from '@/components/app/AuthShell'
import { Button } from '@/components/app/Button'

export default function Home() {
  return (
    <AuthShell
      aside={
        <>
          <div>
            <p className="tb-label text-sm font-medium uppercase tracking-[0.24em]">
              Manhattan pilot
            </p>
            <h1 className="mt-5 max-w-3xl text-5xl font-semibold tracking-tight text-balance text-[color:var(--foreground)] sm:text-6xl">
              Match people to the right night, not just the next event card.
            </h1>
            <p className="tb-copy mt-6 max-w-2xl text-lg leading-8">
              Users define the energy, scene, crowd, spend, and setting they
              actually want. Restaurants and events are then ranked around fit,
              not dumped into one flat feed.
            </p>
          </div>

          <div className="mt-8 grid gap-4">
            <ActionCard
              description="Taste profile, venue tags, and proximity work together before event signup even enters the picture."
              href="/signup"
              label="Find my night"
            />
            <div className="tb-panel rounded-3xl p-6">
              <p className="tb-label text-xs font-medium uppercase tracking-[0.16em]">
                What users get
              </p>
              <ul className="tb-copy mt-4 space-y-3 text-sm leading-6">
                <li>Restaurant-first recommendations instead of generic event dumping</li>
                <li>Saved venues that shape future supply and decision-making</li>
                <li>Clear event detail, confirmation, and feedback flows</li>
              </ul>
            </div>
          </div>
        </>
      }
      title="Find my night"
    >
      <p className="tb-label text-sm font-medium uppercase tracking-[0.2em]">
        Welcome
      </p>
      <h2 className="mt-3 text-4xl font-semibold text-[color:var(--foreground)]">
        Tastebuds is built for calm decisions.
      </h2>
      <p className="tb-copy mt-4 text-base leading-7">
        The product matches taste to restaurants first, then helps you act on
        the right events when timing and viability line up.
      </p>

      <div className="mt-8 grid gap-4">
        <Button href="/signup">Create account</Button>
        <Button href="/login" variant="secondary">
          Log in
        </Button>
      </div>
    </AuthShell>
  )
}
