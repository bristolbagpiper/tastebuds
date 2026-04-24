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
              Find the right table, not just the next thing on a list.
            </h1>
            <p className="tb-copy mt-6 max-w-2xl text-lg leading-8">
              Tastebuds learns what kind of dinner feels right, then brings back
              restaurants and small-group plans that suit the mood.
            </p>
          </div>

          <div className="mt-8 grid gap-4">
            <ActionCard
              description="Build a taste profile, save the right spots, and join the tables that feel worth it."
              href="/signup"
              label="Find my table"
            />
            <div className="tb-panel rounded-3xl p-6">
              <p className="tb-label text-xs font-medium uppercase tracking-[0.16em]">
                What users get
              </p>
              <ul className="tb-copy mt-4 space-y-3 text-sm leading-6">
                <li>Restaurant picks shaped around taste, budget and social vibe</li>
                <li>Saved favourites for the places you want to keep an eye on</li>
                <li>Clear dinner details, confirmations and feedback after the table</li>
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
        Start with the restaurants that fit you best, then move into the live
        dinners worth joining.
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
