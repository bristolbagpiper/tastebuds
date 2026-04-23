import 'server-only'

const RESEND_EMAIL_ENDPOINT = 'https://api.resend.com/emails'

type SendEmailInput = {
  attemptKey?: string
  body: string
  notificationId: number
  subject: string
  to: string
}

type SendEmailResult = {
  providerId: string | null
}

function getRequiredEmailEnv(name: 'EMAIL_FROM' | 'RESEND_API_KEY') {
  const value = process.env[name]

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }

  return value
}

function getAppUrl() {
  const rawValue =
    process.env.APP_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.VERCEL_PROJECT_PRODUCTION_URL ??
    process.env.VERCEL_URL

  if (!rawValue) {
    return 'http://localhost:3000'
  }

  const withProtocol = rawValue.startsWith('http')
    ? rawValue
    : `https://${rawValue}`

  return withProtocol.replace(/\/+$/, '')
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

export async function sendNotificationEmail({
  attemptKey,
  body,
  notificationId,
  subject,
  to,
}: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = getRequiredEmailEnv('RESEND_API_KEY')
  const from = getRequiredEmailEnv('EMAIL_FROM')
  const appUrl = getAppUrl()
  const safeBody = escapeHtml(body)
  const dashboardUrl = `${appUrl}/dashboard`

  const response = await fetch(RESEND_EMAIL_ENDPOINT, {
    body: JSON.stringify({
      from,
      html: `<p>${safeBody}</p><p><a href="${dashboardUrl}">Open your Tastebuds dashboard</a></p>`,
      subject,
      text: `${body}\n\nOpen your Tastebuds dashboard: ${dashboardUrl}`,
      to,
    }),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key':
        attemptKey ??
        `tastebuds-notification-${notificationId}-${new Date().toISOString()}`,
    },
    method: 'POST',
  })

  const payload = (await response.json().catch(() => null)) as {
    id?: string
    message?: string
    name?: string
  } | null

  if (!response.ok) {
    throw new Error(
      payload?.message ?? payload?.name ?? `Email provider failed: ${response.status}`
    )
  }

  return {
    providerId: payload?.id ?? null,
  }
}
