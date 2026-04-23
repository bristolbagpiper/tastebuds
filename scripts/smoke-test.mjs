const appUrl = (process.env.SMOKE_APP_URL || 'http://localhost:3000').replace(
  /\/+$/,
  ''
)
const userToken = process.env.SMOKE_USER_BEARER_TOKEN
const adminToken = process.env.SMOKE_ADMIN_BEARER_TOKEN
const eventId = Number(process.env.SMOKE_EVENT_ID)

if (!userToken) {
  throw new Error('Missing SMOKE_USER_BEARER_TOKEN')
}

if (!Number.isInteger(eventId) || eventId <= 0) {
  throw new Error('Missing valid SMOKE_EVENT_ID')
}

async function requestJson(path, options = {}) {
  const response = await fetch(`${appUrl}${path}`, options)
  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(`${options.method || 'GET'} ${path} failed: ${JSON.stringify(payload)}`)
  }

  return payload
}

async function eventSignup(action) {
  return requestJson('/api/events/signup', {
    body: JSON.stringify({ action, eventId }),
    headers: {
      Authorization: `Bearer ${userToken}`,
      'Content-Type': 'application/json',
    },
    method: 'POST',
  })
}

async function run() {
  console.log(`Smoke test target: ${appUrl}`)
  console.log(`Event ID: ${eventId}`)

  const eventsPayload = await requestJson('/api/events', {
    headers: {
      Authorization: `Bearer ${userToken}`,
    },
  })
  console.log(`Loaded events: ${Array.isArray(eventsPayload.events) ? eventsPayload.events.length : 0}`)

  const joinFirst = await eventSignup('join')
  console.log(`Join status: ${joinFirst.status}`)

  const leave = await eventSignup('leave')
  console.log(`Leave status: ${leave.status}`)

  const joinSecond = await eventSignup('join')
  console.log(`Rejoin status: ${joinSecond.status}`)

  if (adminToken) {
    const emailRun = await requestJson('/api/send-notification-emails', {
      body: JSON.stringify({ limit: 10 }),
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      method: 'POST',
    })
    console.log(
      `Email run: processed=${emailRun.processed ?? 0}, sent=${emailRun.sent ?? 0}, failed=${emailRun.failed ?? 0}, skipped=${emailRun.skipped ?? 0}`
    )
  } else {
    console.log('Skipping email retry check (SMOKE_ADMIN_BEARER_TOKEN not set).')
  }

  console.log('Smoke test passed.')
}

run().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
