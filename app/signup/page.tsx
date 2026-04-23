'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { supabase } from '@/lib/supabase/client'

export default function SignupPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

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

  async function handleSignup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    setLoading(false)

    if (signUpError) {
      setError(signUpError.message)
      return
    }

    if (data.session) {
      router.replace('/dashboard')
      return
    }

    setMessage(
      'Check your email to confirm your account, then come back and log in.'
    )
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center p-8">
      <p className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-zinc-500">
        TasteBuds
      </p>
      <h1 className="text-3xl font-semibold text-zinc-950">Create your account</h1>
      <p className="mt-3 text-sm text-zinc-600">
        Start with email and password. Google SSO can be added once the provider
        is fully configured in Supabase.
      </p>

      <form onSubmit={handleSignup} className="mt-8 space-y-4">
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
            autoComplete="new-password"
            minLength={6}
            placeholder="At least 6 characters"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>

        <button
          className="w-full rounded-xl bg-zinc-950 px-4 py-3 font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
          type="submit"
          disabled={loading}
        >
          {loading ? 'Creating account...' : 'Sign up'}
        </button>
      </form>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      {message && <p className="mt-4 text-sm text-emerald-700">{message}</p>}

      <p className="mt-6 text-sm text-zinc-600">
        Already have an account?{' '}
        <Link className="font-medium text-zinc-950 underline" href="/login">
          Log in
        </Link>
      </p>
    </main>
  )
}
