'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { AuthShell } from '@/components/app/AuthShell'
import { Button } from '@/components/app/Button'
import { supabase } from '@/lib/supabase/client'

export default function SignupPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''

  function getAuthRedirectUrl() {
    const baseUrl =
      appUrl.trim().length > 0
        ? appUrl.replace(/\/+$/, '')
        : window.location.origin

    return `${baseUrl}/auth/callback`
  }

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
        emailRedirectTo: getAuthRedirectUrl(),
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
    <AuthShell
      aside={
        <>
          <div>
            <p className="tb-label text-sm font-medium uppercase tracking-[0.24em]">
              New account
            </p>
            <h1 className="mt-5 text-5xl font-semibold tracking-tight text-[color:var(--foreground)]">
              Build the profile that shapes your next table.
            </h1>
            <p className="tb-copy mt-6 max-w-xl text-lg leading-8">
              Start with a simple account, then tell Tastebuds what kind of dinner actually feels right.
            </p>
          </div>
          <div className="tb-panel mt-8 rounded-3xl p-6">
            <p className="tb-label text-xs font-medium uppercase tracking-[0.16em]">
              What happens next
            </p>
            <ul className="tb-copy mt-4 space-y-3 text-sm leading-6">
              <li>Create account and confirm email if required</li>
              <li>Complete your taste profile and home area</li>
              <li>Start saving restaurants and joining the right tables</li>
            </ul>
          </div>
        </>
      }
      title="Sign up"
    >
      <p className="tb-label text-sm font-medium uppercase tracking-[0.2em]">Create account</p>
      <h1 className="mt-3 text-3xl font-semibold text-[color:var(--foreground)]">Start with your login</h1>
      <p className="tb-copy mt-3 text-sm leading-6">
        Start with email and password. You can finish the rest of your profile after signup.
      </p>

      <form onSubmit={handleSignup} className="mt-8 space-y-4">
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
            autoComplete="new-password"
            minLength={6}
            placeholder="At least 6 characters"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>

        <Button className="w-full" disabled={loading} type="submit">
          {loading ? 'Creating account...' : 'Sign up'}
        </Button>
      </form>

      {error ? (
        <p className="mt-4 rounded-2xl border border-[color:color-mix(in_srgb,var(--accent)_28%,white)] bg-[color:color-mix(in_srgb,var(--accent)_10%,var(--surface))] p-3 text-sm text-[color:var(--accent-strong)]">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="mt-4 rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-soft)] p-3 text-sm text-[color:var(--foreground)]">
          {message}
        </p>
      ) : null}

      <p className="tb-copy mt-6 text-sm">
        Already have an account?{' '}
        <Link className="font-medium text-[color:var(--foreground)] underline" href="/login">
          Log in
        </Link>
      </p>
    </AuthShell>
  )
}
