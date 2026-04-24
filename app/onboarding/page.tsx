import { ProfileEditor } from '@/components/app/ProfileEditor'

export default function OnboardingPage() {
  return (
    <ProfileEditor
      backHref="/dashboard"
      backLabel="Back to dashboard"
      description="The old profile was too vague. This one captures the actual night you want so the app can rank venues with something more defensible than a random list."
      eyebrow="Find My Night"
      redirectTo="/dashboard"
      title="Build the profile that drives your venue matches"
    />
  )
}
