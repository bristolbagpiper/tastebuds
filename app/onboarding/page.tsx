import { ProfileEditor } from '@/components/app/ProfileEditor'

export default function OnboardingPage() {
  return (
    <ProfileEditor
      backHref="/dashboard"
      backLabel="Back to home"
      description="Tell Tastebuds what a good night out feels like so we can start with the right places."
      eyebrow="Taste profile"
      redirectTo="/dashboard"
      title="Build your taste profile"
    />
  )
}
