import 'server-only'

import { NextResponse } from 'next/server'

import { createServerSupabaseAuthClient } from '@/lib/supabase/server'

type RequireAdminOrCronOptions = {
  allowAdmin?: boolean
  allowCron?: boolean
}

type AdminAuthResult = {
  kind: 'admin'
  user: {
    email?: string | null
    id: string
  }
}

type CronAuthResult = {
  kind: 'cron'
}

type AuthSuccess = AdminAuthResult | CronAuthResult

type AuthFailure = {
  error: NextResponse
}

function parseBearerToken(request: Request) {
  const authorization = request.headers.get('authorization')

  if (!authorization?.startsWith('Bearer ')) {
    return null
  }

  return authorization.slice('Bearer '.length)
}

function isCronAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    return false
  }

  const bearerToken = parseBearerToken(request)
  const headerSecret = request.headers.get('x-cron-secret')

  return bearerToken === cronSecret || headerSecret === cronSecret
}

export async function requireAdminOrCron(
  request: Request,
  options: RequireAdminOrCronOptions = {}
): Promise<AuthSuccess | AuthFailure> {
  const allowAdmin = options.allowAdmin ?? true
  const allowCron = options.allowCron ?? false

  if (allowCron && isCronAuthorized(request)) {
    return { kind: 'cron' }
  }

  if (!allowAdmin) {
    return {
      error: NextResponse.json(
        { error: 'Invalid cron secret.' },
        { status: 401 }
      ),
    }
  }

  const token = parseBearerToken(request)

  if (!token) {
    return {
      error: NextResponse.json({ error: 'Missing bearer token.' }, { status: 401 }),
    }
  }

  const adminEmail = process.env.ADMIN_EMAIL

  if (!adminEmail) {
    return {
      error: NextResponse.json(
        { error: 'Missing ADMIN_EMAIL in environment.' },
        { status: 500 }
      ),
    }
  }

  const authClient = createServerSupabaseAuthClient()
  const {
    data: { user },
    error,
  } = await authClient.auth.getUser(token)

  if (error || !user) {
    return {
      error: NextResponse.json({ error: 'Invalid session.' }, { status: 401 }),
    }
  }

  if (user.email?.toLowerCase() !== adminEmail.toLowerCase()) {
    return {
      error: NextResponse.json({ error: 'Admin access only.' }, { status: 403 }),
    }
  }

  return {
    kind: 'admin',
    user: {
      email: user.email,
      id: user.id,
    },
  }
}
