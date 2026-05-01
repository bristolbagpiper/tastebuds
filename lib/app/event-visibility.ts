export type EventVisibilityInput = {
  id: number
  restaurant_id: number | null
}

export type SignupVisibilityInput = {
  event_id: number
  status: string
  user_id: string
}

const ACTIVE_SIGNUP_STATUSES = new Set(['going', 'attended', 'no_show'])

export function getVisibleEventsForSavedRestaurants<TEvent extends EventVisibilityInput>({
  events,
  savedRestaurantIds,
  signups,
  userId,
}: {
  events: TEvent[]
  savedRestaurantIds: Set<number>
  signups: SignupVisibilityInput[]
  userId: string
}) {
  const activeJoinedEventIds = new Set(
    signups
      .filter(
        (signup) =>
          signup.user_id === userId && ACTIVE_SIGNUP_STATUSES.has(signup.status)
      )
      .map((signup) => signup.event_id)
  )

  return events.filter(
    (event) =>
      (event.restaurant_id !== null && savedRestaurantIds.has(event.restaurant_id)) ||
      activeJoinedEventIds.has(event.id)
  )
}
