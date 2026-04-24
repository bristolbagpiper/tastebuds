'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { AppShell } from '@/components/app/AppShell'
import { ProfileEditor } from '@/components/app/ProfileEditor'
import { getAppBootstrap, logout } from '@/lib/app/client'

export default function ProfilePage() {
  const router = useRouter()
  const [email, setEmail] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    async function loadPage() {
      try {
        const bootstrap = await getAppBootstrap()

        if (active) {
          setEmail(bootstrap.email)
        }
      } catch {
        if (active) {
          router.replace('/login')
        }
      }
    }

    void loadPage()

    return () => {
      active = false
    }
  }, [router])

  async function handleLogout() {
    await logout()
    router.replace('/login')
  }

  return (
    <AppShell currentPath="/profile" email={email} onLogout={handleLogout} title="Profile">
      <ProfileEditor
        backHref="/dashboard"
        backLabel="Back to home"
        description="Shape the places and dinners you see around the city."
        embedded
        eyebrow="Profile"
        redirectTo="/profile"
        title="Your taste profile"
      />
    </AppShell>
  )
}
