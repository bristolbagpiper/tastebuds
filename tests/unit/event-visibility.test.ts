import { describe, expect, it } from 'vitest'

import { getVisibleEventsForSavedRestaurants } from '@/lib/app/event-visibility'

describe('getVisibleEventsForSavedRestaurants', () => {
  const events = [
    { id: 1, restaurant_id: 10, title: 'Saved venue table' },
    { id: 2, restaurant_id: 20, title: 'Unsaved venue table' },
    { id: 3, restaurant_id: null, title: 'Detached event' },
    { id: 4, restaurant_id: 30, title: 'Joined legacy table' },
  ]

  it('only shows events for restaurants the user saved', () => {
    const visibleEvents = getVisibleEventsForSavedRestaurants({
      events,
      savedRestaurantIds: new Set([10]),
      signups: [],
      userId: 'user-1',
    })

    expect(visibleEvents.map((event) => event.id)).toEqual([1])
  })

  it('keeps already joined active events visible so users can manage their seat', () => {
    const visibleEvents = getVisibleEventsForSavedRestaurants({
      events,
      savedRestaurantIds: new Set([10]),
      signups: [
        { event_id: 2, status: 'cancelled', user_id: 'user-1' },
        { event_id: 4, status: 'going', user_id: 'user-1' },
      ],
      userId: 'user-1',
    })

    expect(visibleEvents.map((event) => event.id)).toEqual([1, 4])
  })

  it('does not leak another user joined event', () => {
    const visibleEvents = getVisibleEventsForSavedRestaurants({
      events,
      savedRestaurantIds: new Set<number>(),
      signups: [{ event_id: 2, status: 'going', user_id: 'user-2' }],
      userId: 'user-1',
    })

    expect(visibleEvents).toEqual([])
  })
})
