import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8f5ef_0%,#ffffff_52%,#f4efe7_100%)] px-6 py-10 text-zinc-950">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-5xl flex-col justify-between rounded-[2rem] border border-black/5 bg-white/80 p-8 shadow-[0_30px_80px_rgba(24,24,27,0.08)] backdrop-blur sm:p-12">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.28em] text-zinc-500">
              TasteBuds
            </p>
            <p className="mt-2 text-sm text-zinc-600">
              Manhattan venue matching built around a find-my-night journey.
            </p>
          </div>
          <div className="flex gap-3">
            <Link
              className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium transition hover:border-zinc-950"
              href="/login"
            >
              Log in
            </Link>
            <Link
              className="rounded-full bg-zinc-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800"
              href="/signup"
            >
              Sign up
            </Link>
          </div>
        </div>

        <section className="grid gap-12 py-14 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.24em] text-amber-700">
              Manhattan pilot
            </p>
            <h1 className="mt-5 max-w-3xl text-5xl font-semibold tracking-tight text-balance sm:text-6xl">
              Match people to the right night, not just the next event card.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-600">
              Users define the energy, scene, crowd, spend, and setting they
              actually want. Admins tag each venue properly. The app ranks
              events by fit instead of dumping the same list on everyone.
            </p>
          </div>

          <div className="rounded-[1.75rem] border border-zinc-200 bg-zinc-950 p-6 text-white">
            <p className="text-sm uppercase tracking-[0.2em] text-zinc-400">
              Current milestone
            </p>
            <h2 className="mt-4 text-2xl font-semibold">
              Matching model first, signup mechanics second.
            </h2>
            <ul className="mt-6 space-y-3 text-sm text-zinc-300">
              <li>Explicit venue tags across mood, crowd, price, and setting</li>
              <li>User night-preference profiles instead of vague bios alone</li>
              <li>Weighted people-to-venue ranking before signup</li>
              <li>Event signup, waitlist, and notification workflow on top</li>
            </ul>
          </div>
        </section>
      </div>
    </main>
  )
}
