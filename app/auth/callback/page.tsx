'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { AuthShell } from '@/components/app/AuthShell'
import { Button } from '@/components/app/Button'
import { supabase } from '@/lib/supabase/client'

export default function AuthCallbackPage() {
  const router = useRouter()
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (active && session) {
          router.replace('/dashboard')
        }
      }
    )

    async function finishAuth() {
      const searchParams = new URLSearchParams(window.location.search)
      const authCode = searchParams.get('code')
      const authError =
        searchParams.get('error_description') ?? searchParams.get('error')

      if (authError) {
        if (active) {
          setError(decodeURIComponent(authError))
        }
        return
      }

      if (authCode) {
        const { error: exchangeError } =
          await supabase.auth.exchangeCodeForSession(authCode)

        if (exchangeError) {
          if (active) {
            setError(exchangeError.message)
          }
          return
        }

        if (active) {
          router.replace('/dashboard')
        }
        return
      }

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()

      if (sessionError) {
        if (active) {
          setError(sessionError.message)
        }
        return
      }

      if (session) {
        router.replace('/dashboard')
        return
      }

      if (active) {
        setError('No active session was found. Try logging in again.')
      }
    }

    void finishAuth()

    return () => {
      active = false
      authListener.subscription.unsubscribe()
    }
  }, [router])

  return (
    <AuthShell
      aside={
        <div>
          <p className="tb-label text-sm font-medium uppercase tracking-[0.24em]">
            Authentication
          </p>
          <h1 className="mt-5 text-5xl font-semibold tracking-tight text-[color:var(--foreground)]">
            Finishing sign-in.
          </h1>
          <p className="tb-copy mt-6 max-w-xl text-lg leading-8">
            Supabase is exchanging the auth result and restoring the session locally.
          </p>
        </div>
      }
      title="Authentication"
    >
      <p className="tb-label text-sm font-medium uppercase tracking-[0.2em]">
        Authentication
      </p>
      <h1 className="mt-3 text-3xl font-semibold text-[color:var(--foreground)]">
        Finishing sign-in
      </h1>
      <p className="tb-copy mt-4 text-sm leading-6">
        Completing the redirect from Supabase and storing the session locally.
      </p>

      {error ? (
        <div className="mt-6 space-y-4 rounded-3xl border border-[color:color-mix(in_srgb,var(--accent)_28%,white)] bg-[color:color-mix(in_srgb,var(--accent)_10%,var(--surface))] p-5 text-sm text-[color:var(--accent-strong)]">
          <p>{error}</p>
          <Button href="/login" variant="secondary">
            Go back to login
          </Button>
        </div>
      ) : (
        <p className="tb-copy mt-6 text-sm">Signing you in...</p>
      )}
    </AuthShell>
  )
}
