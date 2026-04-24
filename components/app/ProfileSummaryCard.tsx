import { Button } from '@/components/app/Button'
import { TasteTag } from '@/components/app/TasteTag'
import { formatIntent } from '@/lib/app/format'
import type { Profile } from '@/lib/app/types'

function renderTags(values: string[] | null | undefined) {
  if (!values?.length) {
    return <p className="tb-copy text-sm">Not set</p>
  }

  return (
    <div className="flex flex-wrap gap-2">
      {values.map((value) => (
        <TasteTag key={value}>{value}</TasteTag>
      ))}
    </div>
  )
}

export function ProfileSummaryCard({
  profile,
  showEditLink = true,
}: {
  profile: Profile
  showEditLink?: boolean
}) {
  return (
    <section className="tb-panel-soft rounded-3xl p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="tb-label text-xs font-medium uppercase tracking-[0.16em]">
            Taste profile
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-[color:var(--foreground)]">
            {profile.display_name ?? 'Unnamed profile'}
          </h2>
          <p className="tb-copy mt-2 text-sm">
            {profile.subregion ?? 'No subregion'}
            {profile.neighbourhood ? `, ${profile.neighbourhood}` : ''}
          </p>
          <p className="tb-copy mt-2 text-sm">
            Connection mode:{' '}
            <span className="font-medium text-[color:var(--foreground)]">
              {profile.intent ? formatIntent(profile.intent) : 'Not set'}
            </span>
          </p>
          <p className="tb-copy mt-1 text-sm">
            Max travel:{' '}
            <span className="font-medium text-[color:var(--foreground)]">
              {profile.max_travel_minutes ?? 30} minutes
            </span>
          </p>
        </div>
        {showEditLink ? <Button href="/profile" variant="secondary">Edit profile</Button> : null}
      </div>

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <p className="text-sm font-medium text-[color:var(--foreground)]">Energy</p>
          {renderTags(profile.preferred_energy)}
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium text-[color:var(--foreground)]">Scene</p>
          {renderTags(profile.preferred_scene)}
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium text-[color:var(--foreground)]">Crowd</p>
          {renderTags(profile.preferred_crowd)}
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium text-[color:var(--foreground)]">Music</p>
          {renderTags(profile.preferred_music)}
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium text-[color:var(--foreground)]">Setting</p>
          {renderTags(profile.preferred_setting)}
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium text-[color:var(--foreground)]">Price</p>
          {renderTags(profile.preferred_price)}
        </div>
      </div>

      <div className="mt-5 space-y-2">
        <p className="text-sm font-medium text-[color:var(--foreground)]">Cuisine preferences</p>
        {renderTags(profile.cuisine_preferences)}
      </div>

      {profile.bio ? <p className="tb-copy mt-5 text-sm leading-7">{profile.bio}</p> : null}
    </section>
  )
}
