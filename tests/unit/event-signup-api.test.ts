import { beforeEach, describe, expect, it, vi } from 'vitest'

import { POST } from '@/app/api/events/signup/route'

const mocks = vi.hoisted(() => ({
  getUserFromAccessToken: vi.fn(),
  rpc: vi.fn(),
}))

vi.mock('@/lib/event-operations', () => ({
  refreshEventViability: vi.fn(),
  syncEventSignupScores: vi.fn(),
}))

vi.mock('@/lib/notifications', () => ({
  queueNotifications: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseAdminClient: () => ({
    from: (table: string) => createQuery(table),
    rpc: mocks.rpc,
  }),
  getUserFromAccessToken: mocks.getUserFromAccessToken,
}))

function createJsonRequest(body: unknown) {
  return new Request('https://tastebuds.test/api/events/signup', {
    body: JSON.stringify(body),
    headers: {
      authorization: 'Bearer test-token',
      'content-type': 'application/json',
    },
    method: 'POST',
  })
}

function createQuery(table: string) {
  const state = {
    table,
    filters: new Map<string, unknown>(),
  }

  const query = {
    eq(column: string, value: unknown) {
      state.filters.set(column, value)
      return query
    },
    maybeSingle() {
      if (state.table === 'events') {
        return Promise.resolve({
          data: {
            capacity: 4,
            duration_minutes: 120,
            id: 10,
            intent: 'friendship',
            restaurant_cuisines: ['italian'],
            restaurant_id: 55,
            restaurant_name: 'Banter NYC',
            restaurant_subregion: 'Midtown',
            starts_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
            status: 'open',
            title: 'Dinner',
            venue_crowd: ['Mixed'],
            venue_energy: 'Moderate',
            venue_latitude: 40.7,
            venue_longitude: -73.9,
            venue_music: ['Background'],
            venue_price: '$$',
            venue_scene: ['Social'],
            venue_setting: ['Restaurant'],
          },
          error: null,
        })
      }

      if (state.table === 'event_signups') {
        return Promise.resolve({ data: null, error: null })
      }

      if (state.table === 'saved_restaurants') {
        return Promise.resolve({ data: null, error: null })
      }

      return Promise.resolve({ data: null, error: null })
    },
    select() {
      return query
    },
  }

  return query
}

describe('POST /api/events/signup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getUserFromAccessToken.mockResolvedValue({ id: 'user-1' })
  })

  it('blocks joining when the user has not saved the restaurant', async () => {
    const response = await POST(createJsonRequest({ action: 'join', eventId: 10 }))
    const payload = (await response.json()) as { error: string }

    expect(response.status).toBe(403)
    expect(payload.error).toBe('Save this restaurant before joining its table.')
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
})
