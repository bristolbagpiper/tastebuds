'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { AuthShell } from '@/components/app/AuthShell'
import { Button } from '@/components/app/Button'
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
    <AuthShell
      aside={
        <>
          <div>
            <p className="tb-label text-sm font-medium uppercase tracking-[0.24em]">
              Existing account
            </p>
            <h1 className="mt-5 text-5xl font-semibold tracking-tight text-[color:var(--foreground)]">
              Come back to the right plan.
            </h1>
            <p className="tb-copy mt-6 max-w-xl text-lg leading-8">
              Your saved restaurants, notifications, and joined events all sit
              behind this session. If auth breaks, the rest of the product is performative.
            </p>
          </div>
          <div className="tb-panel mt-8 rounded-3xl p-6">
            <p className="tb-label text-xs font-medium uppercase tracking-[0.16em]">
              Session scope
            </p>
            <ul className="tb-copy mt-4 space-y-3 text-sm leading-6">
              <li>Restaurant matches and saved venues</li>
              <li>Joined events, waitlists, and day-of confirmations</li>
              <li>Notifications and feedback history</li>
            </ul>
          </div>
        </>
      }
      title="Log in"
    >
      <p className="tb-label text-sm font-medium uppercase tracking-[0.2em]">Log in</p>
      <h1 className="mt-3 text-3xl font-semibold text-[color:var(--foreground)]">Access your account</h1>
      <p className="tb-copy mt-3 text-sm leading-6">
        Sign in with email and password, or continue with Google if that provider is configured.
      </p>

      <form onSubmit={handleLogin} className="mt-8 space-y-4">
        <label className="block space-y-2">
          <span className="text-sm font-medium text-[color:var(--foreground)]">Email</span>
          <input
            className="tb-input"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-[color:var(--foreground)]">Password</span>
          <input
            className="tb-input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>

        <Button className="w-full" disabled={loading || oauthLoading} type="submit">
          {loading ? 'Logging in...' : 'Log in'}
        </Button>
      </form>

      <Button
        className="mt-4 w-full"
        onClick={handleGoogleLogin}
        disabled={loading || oauthLoading}
        type="button"
        variant="secondary"
      >
        {oauthLoading ? 'Redirecting to Google...' : 'Continue with Google'}
      </Button>

      {error ? (
        <p className="mt-4 rounded-2xl border border-[color:color-mix(in_srgb,var(--accent)_28%,white)] bg-[color:color-mix(in_srgb,var(--accent)_10%,var(--surface))] p-3 text-sm text-[color:var(--accent-strong)]">
          {error}
        </p>
      ) : null}

      <p className="tb-copy mt-6 text-sm">
        Need an account?{' '}
        <Link className="font-medium text-[color:var(--foreground)] underline" href="/signup">
          Sign up
        </Link>
      </p>
    </AuthShell>
  )
}
