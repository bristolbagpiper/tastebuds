'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { supabase } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState(false)

  useEffect(() => {
    let active = true

    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (active && user) {
        router.replace('/dashboard')
      }
    }

    void loadUser()

    return () => {
      active = false
    }
  }, [router])

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    setLoading(false)

    if (signInError) {
      setError(signInError.message)
      return
    }

    router.replace('/dashboard')
  }

  async function handleGoogleLogin() {
    setOauthLoading(true)
    setError('')

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (oauthError) {
      setError(oauthError.message)
      setOauthLoading(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center p-8">
      <p className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-zinc-500">
        TasteBuds
      </p>
      <h1 className="text-3xl font-semibold text-zinc-950">Log in</h1>
      <p className="mt-3 text-sm text-zinc-600">
        This is still the foundation layer. If login is flaky here, everything
        above it will be fake progress.
      </p>

      <form onSubmit={handleLogin} className="mt-8 space-y-4">
        <label className="block space-y-2">
          <span className="text-sm font-medium text-zinc-700">Email</span>
          <input
            className="w-full rounded-xl border border-zinc-300 px-4 py-3 outline-none transition focus:border-zinc-950"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-zinc-700">Password</span>
          <input
            className="w-full rounded-xl border border-zinc-300 px-4 py-3 outline-none transition focus:border-zinc-950"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>

        <button
          className="w-full rounded-xl bg-zinc-950 px-4 py-3 font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
          type="submit"
          disabled={loading || oauthLoading}
        >
          {loading ? 'Logging in...' : 'Log in'}
        </button>
      </form>

      <button
        className="mt-4 w-full rounded-xl border border-zinc-300 px-4 py-3 font-medium text-zinc-950 transition hover:border-zinc-950 disabled:cursor-not-allowed disabled:text-zinc-400"
        onClick={handleGoogleLogin}
        disabled={loading || oauthLoading}
        type="button"
      >
        {oauthLoading ? 'Redirecting to Google...' : 'Continue with Google'}
      </button>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <p className="mt-6 text-sm text-zinc-600">
        Need an account?{' '}
        <Link className="font-medium text-zinc-950 underline" href="/signup">
          Sign up
        </Link>
      </p>
    </main>
  )
}
