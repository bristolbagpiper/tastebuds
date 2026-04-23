import Link from 'next/link'

export default function AvailabilityPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center px-8 py-16">
      <p className="text-sm font-medium uppercase tracking-[0.2em] text-zinc-500">
        Update
      </p>
      <h1 className="mt-3 text-4xl font-semibold text-zinc-950">
        Availability was replaced by event signup
      </h1>
      <p className="mt-4 max-w-2xl text-base text-zinc-600">
        The old weekly opt-in flow is retired. Use the dashboard to join specific
        restaurant events instead.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          className="rounded-xl bg-zinc-950 px-4 py-3 font-medium text-white transition hover:bg-zinc-800"
          href="/dashboard"
        >
          Open dashboard
        </Link>
        <Link
          className="rounded-xl border border-zinc-950 px-4 py-3 font-medium text-zinc-950 transition hover:bg-zinc-950 hover:text-white"
          href="/"
        >
          Back to home
        </Link>
      </div>
    </main>
  )
}
