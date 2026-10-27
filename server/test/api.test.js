import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import app from '../src/app.js'

process.env.JWT_SECRET = 'healthmate-test-secret'
let server
let baseUrl

before(async () => {
  server = app.listen(0)
  await new Promise((resolve) => server.once('listening', resolve))
  baseUrl = `http://127.0.0.1:${server.address().port}/api`
})

after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
})

async function request(path, { token, method = 'GET', body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  const text = await response.text()
  return { status: response.status, data: text ? JSON.parse(text) : null }
}

test('authenticated health and recommendation workflows enforce validation and ownership', async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`
  const today = new Date().toISOString().slice(0, 10)
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  const registered = await request('/auth/register', { method: 'POST', body: { name: 'Test Member', email: `member-${suffix}@example.test`, password: 'TestPassword123!' } })
  assert.equal(registered.status, 201)
  const token = registered.data.token
  assert.equal((await request('/auth/me', { token })).status, 200)
  assert.equal((await request('/profile', { token })).data, null)
  assert.equal((await request('/profile', { token, method: 'PUT', body: { activityLevel: 'unrealistic' } })).status, 400)

  const profile = await request('/profile', { token, method: 'PUT', body: { ageRange: '25-34', activityLevel: 'beginner', diet: 'vegetarian', goal: 'daily movement', sleepHours: 6 } })
  assert.equal(profile.data.diet, 'vegetarian')
  const payload = { date: today, steps: 4100, sleep: 6, hydration: 1.7, activityType: 'Walking', activityMinutes: 20, notes: 'test record' }
  assert.equal((await request('/health-logs', { token, method: 'POST', body: { date: today } })).status, 400)
  const firstLog = await request('/health-logs', { token, method: 'POST', body: payload })
  const replacedLog = await request('/health-logs', { token, method: 'POST', body: { ...payload, steps: 5100 } })
  assert.equal(firstLog.status, 201)
  assert.equal(replacedLog.data.steps, 5100)
  assert.equal((await request('/health-logs', { token })).data.items.length, 1)
  assert.equal((await request('/health-logs', { token, method: 'POST', body: { ...payload, date: 'not-a-date' } })).status, 400)

  const secondLog = await request('/health-logs', { token, method: 'POST', body: { ...payload, date: yesterday } })
  assert.equal((await request(`/health-logs/${secondLog.data.id}`, { token, method: 'PUT', body: payload })).status, 409)
  const other = await request('/auth/register', { method: 'POST', body: { name: 'Other Member', email: `other-${suffix}@example.test`, password: 'TestPassword123!' } })
  assert.equal((await request(`/health-logs/${firstLog.data.id}`, { token: other.data.token, method: 'DELETE' })).status, 404)

  const generated = await request('/recommendations/generate', { token, method: 'POST', body: {} })
  assert.ok(generated.data.length > 0)
  assert.ok(generated.data.every((item) => item.reason && ['nutrition', 'activity', 'sleep', 'lifestyle'].includes(item.type)))
  const savedRecommendations = await request('/recommendations', { token })
  const feedback = await request(`/recommendations/${savedRecommendations.data[0].id}/feedback`, { token, method: 'PATCH', body: { feedback: 'helpful' } })
  assert.equal(feedback.data.feedback, 'helpful')

  assert.equal((await request('/analytics/summary?days=7', { token })).data.hasData, true)
  assert.equal((await request(`/reports/summary?from=${today}&to=${today}`, { token })).data.recordCount, 1)
  const notifications = await request('/notifications', { token })
  assert.ok(notifications.data.unreadCount > 0)
  assert.equal((await request(`/notifications/${notifications.data.items[0].id}/read`, { token, method: 'PATCH', body: {} })).status, 200)
  assert.equal((await request('/settings/preferences', { token })).status, 200)
  assert.equal((await request('/settings/preferences', { token, method: 'PATCH', body: { notificationsEnabled: false } })).status, 200)
  const pastLog = await request('/health-logs', { token, method: 'POST', body: { ...payload, date: '2020-01-01' } })
  assert.equal(pastLog.status, 201)
  assert.equal((await request('/notifications', { token })).data.items.length, notifications.data.items.length)

  const exported = await request('/settings/export', { token })
  assert.equal(Object.hasOwn(exported.data.user, 'passwordHash'), false)
  assert.equal((await request('/settings/account', { token, method: 'DELETE', body: { password: 'wrong-password' } })).status, 401)
  assert.equal((await request('/settings/password', { token, method: 'PUT', body: { currentPassword: 'wrong-password', newPassword: 'ChangedPassword123!' } })).status, 401)
  const passwordChanged = await request('/settings/password', { token, method: 'PUT', body: { currentPassword: 'TestPassword123!', newPassword: 'ChangedPassword123!' } })
  assert.equal(passwordChanged.status, 200)
  assert.equal((await request('/auth/me', { token })).status, 401)
  const currentToken = passwordChanged.data.token
  assert.equal((await request('/settings/account', { token: currentToken, method: 'DELETE', body: { password: 'TestPassword123!' } })).status, 401)
  assert.equal((await request('/settings/account', { token: currentToken, method: 'DELETE', body: { password: 'ChangedPassword123!' } })).status, 204)
  assert.equal((await request('/auth/me', { token: currentToken })).status, 401)
  const logoutUser = await request('/auth/register', { method: 'POST', body: { name: 'Logout Member', email: `logout-${suffix}@example.test`, password: 'TestPassword123!' } })
  assert.equal((await request('/auth/logout', { token: logoutUser.data.token, method: 'POST' })).status, 200)
  assert.equal((await request('/auth/me', { token: logoutUser.data.token })).status, 401)
  assert.equal((await request('/settings/account', { token: other.data.token, method: 'DELETE', body: { password: 'TestPassword123!' } })).status, 204)
})
