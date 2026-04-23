'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

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
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center p-8">
      <p className="text-sm font-medium uppercase tracking-[0.2em] text-zinc-500">
        Authentication
      </p>
      <h1 className="mt-3 text-3xl font-semibold text-zinc-950">
        Finishing sign-in
      </h1>
      <p className="mt-4 text-sm text-zinc-600">
        Completing the redirect from Supabase and storing the session locally.
      </p>

      {error ? (
        <div className="mt-6 space-y-4 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          <p>{error}</p>
          <Link className="font-medium underline" href="/login">
            Go back to login
          </Link>
        </div>
      ) : (
        <p className="mt-6 text-sm text-zinc-600">Signing you in...</p>
      )}
    </main>
  )
}
