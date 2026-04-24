import { ProfileEditor } from '@/components/app/ProfileEditor'

export default function ProfilePage() {
  return (
    <ProfileEditor
      backHref="/dashboard"
      backLabel="Back to home"
      description="Edit the taste profile that drives restaurant ranking, event fit, and location proximity."
      eyebrow="Profile"
      redirectTo="/profile"
      title="Your taste profile"
    />
  )
}
