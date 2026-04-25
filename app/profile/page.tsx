'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

import { AppShell } from '@/components/app/AppShell'
import { ProfileEditor } from '@/components/app/ProfileEditor'
import { getAppBootstrap, logout } from '@/lib/app/client'

export default function ProfilePage() {
  const router = useRouter()

  useEffect(() => {
    let active = true

    async function loadPage() {
      try {
        await getAppBootstrap()
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
    <AppShell currentPath="/profile" onLogout={handleLogout}>
      <ProfileEditor
        backHref="/dashboard"
        backLabel="Back to home"
        description="Shape the restaurants and tables that rise to the top for you."
        embedded
        eyebrow="Profile"
        redirectTo="/profile"
        title="Your taste profile"
      />
    </AppShell>
  )
}
