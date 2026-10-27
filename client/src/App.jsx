import { useEffect, useState } from 'react'
import {
  Activity, Bell, CalendarDays, Check, ChevronDown, Download, FileText,
  Heart, LayoutDashboard, LogOut, Pencil, Plus, Search, Settings, Sparkles,
  Trash2, UserRound, X,
} from 'lucide-react'
import {
  CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import api, { getApiError } from './api'
import './App.css'

const pages = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard },
  { name: 'Health Profile', path: '/profile', icon: UserRound },
  { name: 'Recommendations', path: '/recommendations', icon: Sparkles },
  { name: 'Progress', path: '/progress', icon: Activity },
  { name: 'Reports', path: '/reports', icon: FileText },
  { name: 'Settings', path: '/settings', icon: Settings },
]
const today = () => new Date().toISOString().slice(0, 10)
const blankLog = () => ({ date: today(), steps: '', sleep: '', hydration: '', activityType: 'Walking', activityMinutes: '', notes: '' })
const blankProfile = {
  ageRange: '', height: '', weight: '', activityLevel: 'beginner', diet: 'balanced',
  goal: '', goalsText: '', dietaryText: '', sleepHours: '', lifestyle: 'balanced',
}
const recommendationIcons = { nutrition: '🥗', activity: '🏃', sleep: '🌙', lifestyle: '🌿' }
const idOf = (item) => item._id || item.id

function App() {
  const navigate = useNavigate()
  const location = useLocation()
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('healthmate-user') || 'null') } catch { return null }
  })
  const [token, setToken] = useState(() => localStorage.getItem('healthmate-token') || '')
  const [authMode, setAuthMode] = useState('login')
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' })
  const [authError, setAuthError] = useState('')
  const [authBusy, setAuthBusy] = useState(false)
  const [loading, setLoading] = useState(() => Boolean(localStorage.getItem('healthmate-token')))
  const [pageError, setPageError] = useState('')
  const [notice, setNotice] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [profile, setProfile] = useState(null)
  const [logs, setLogs] = useState([])
  const [recommendations, setRecommendations] = useState([])
  const [analytics, setAnalytics] = useState(null)
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [preferences, setPreferences] = useState({ notificationsEnabled: true, notificationPreferences: { email: false, inApp: true } })
  const [profileForm, setProfileForm] = useState(blankProfile)
  const [logForm, setLogForm] = useState(blankLog())
  const [editingLog, setEditingLog] = useState(null)
  const [logFormOpen, setLogFormOpen] = useState(false)
  const [logBusy, setLogBusy] = useState(false)
  const [recommendationCategory, setRecommendationCategory] = useState('all')
  const [recommendationBusy, setRecommendationBusy] = useState(false)
  const [progressRange, setProgressRange] = useState(7)
  const [reportRange, setReportRange] = useState({ from: today(), to: today() })
  const [report, setReport] = useState(null)
  const [searchText, setSearchText] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '' })
  const [settingsBusy, setSettingsBusy] = useState(false)

  const activePage = pages.find((page) => page.path === location.pathname)?.name || 'Dashboard'

  useEffect(() => {
    if (!token) return undefined
    let cancelled = false
    api.get('/auth/me').then(({ data }) => {
      if (!cancelled) {
        setUser(data.user)
        localStorage.setItem('healthmate-user', JSON.stringify(data.user))
      }
    }).catch(() => {
      if (!cancelled) {
        localStorage.removeItem('healthmate-token')
        localStorage.removeItem('healthmate-user')
        setToken('')
        setUser(null)
      }
    })
    return () => { cancelled = true }
  }, [token])

  useEffect(() => {
    if (!token) return undefined
    let cancelled = false
    const requests = [
      api.get('/profile'), api.get('/health-logs?limit=365'), api.get('/analytics/summary?days=90'),
      api.get('/recommendations'), api.get('/notifications'), api.get('/settings/preferences'),
    ]
    Promise.allSettled(requests).then((results) => {
      if (cancelled) return
      const [profileResult, logsResult, analyticsResult, recommendationResult, notificationResult, preferenceResult] = results
      if (profileResult.status === 'fulfilled') {
        const value = profileResult.value.data
        setProfile(value)
        setProfileForm(value ? {
          ageRange: value.ageRange || '', height: value.height ?? '', weight: value.weight ?? '',
          activityLevel: value.activityLevel || 'beginner', diet: value.diet || 'balanced',
          goal: value.goal || '', goalsText: (value.wellnessGoals || value.goals || []).join(', '),
          dietaryText: (value.dietaryPreferences || []).join(', '), sleepHours: value.sleepHours ?? '', lifestyle: value.lifestyle || 'balanced',
        } : blankProfile)
      }
      if (logsResult.status === 'fulfilled') setLogs(logsResult.value.data.items || [])
      if (analyticsResult.status === 'fulfilled') setAnalytics(analyticsResult.value.data)
      if (recommendationResult.status === 'fulfilled') setRecommendations(recommendationResult.value.data || [])
      if (notificationResult.status === 'fulfilled') {
        setNotifications(notificationResult.value.data.items || [])
        setUnreadCount(notificationResult.value.data.unreadCount || 0)
      }
      if (preferenceResult.status === 'fulfilled') setPreferences(preferenceResult.value.data)
      const failed = results.find((result) => result.status === 'rejected')
      if (failed) setPageError(getApiError(failed.reason))
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [token, refreshKey])

  useEffect(() => {
    if (!notice) return undefined
    const timer = window.setTimeout(() => setNotice(''), 3500)
    return () => window.clearTimeout(timer)
  }, [notice])

  const refresh = () => {
    setPageError('')
    setLoading(true)
    setRefreshKey((value) => value + 1)
  }
  const goTo = (path) => {
    navigate(path)
    setSearchOpen(false)
    setNotificationsOpen(false)
    setAccountOpen(false)
  }
  const logout = () => {
    const activeToken = localStorage.getItem('healthmate-token')
    if (activeToken) api.post('/auth/logout', {}, { headers: { Authorization: `Bearer ${activeToken}` } }).catch(() => {})
    localStorage.removeItem('healthmate-token')
    localStorage.removeItem('healthmate-user')
    setToken('')
    setUser(null)
    setLogs([])
    setProfile(null)
    setRecommendations([])
    setAnalytics(null)
    setNotifications([])
    setUnreadCount(0)
    setPreferences({ notificationsEnabled: true, notificationPreferences: { email: false, inApp: true } })
    setProfileForm(blankProfile)
    setReport(null)
    navigate('/')
  }

  const submitAuth = async (event) => {
    event.preventDefault()
    setAuthError('')
    setPageError('')
    setAuthBusy(true)
    try {
      const path = authMode === 'login' ? '/auth/login' : '/auth/register'
      const payload = authMode === 'login'
        ? { email: authForm.email, password: authForm.password }
        : authForm
      const { data } = await api.post(path, payload)
      localStorage.setItem('healthmate-token', data.token)
      localStorage.setItem('healthmate-user', JSON.stringify(data.user))
      setToken(data.token)
      setUser(data.user)
      setLoading(true)
      setLogs([])
      setProfile(null)
      setRecommendations([])
      setAnalytics(null)
      setNotifications([])
      setUnreadCount(0)
      setReport(null)
      setAuthForm({ name: '', email: '', password: '' })
      setNotice('You are signed in.')
    } catch (error) {
      setAuthError(getApiError(error))
    } finally {
      setAuthBusy(false)
    }
  }

  const saveProfile = async (event) => {
    event.preventDefault()
    setSettingsBusy(true)
    setPageError('')
    const payload = {
      ageRange: profileForm.ageRange || undefined,
      height: profileForm.height === '' ? undefined : Number(profileForm.height),
      weight: profileForm.weight === '' ? undefined : Number(profileForm.weight),
      activityLevel: profileForm.activityLevel,
      diet: profileForm.diet,
      goal: profileForm.goal,
      wellnessGoals: profileForm.goalsText.split(',').map((item) => item.trim()).filter(Boolean),
      dietaryPreferences: profileForm.dietaryText.split(',').map((item) => item.trim()).filter(Boolean),
      sleepHours: profileForm.sleepHours === '' ? undefined : Number(profileForm.sleepHours),
      lifestyle: profileForm.lifestyle,
    }
    try {
      const { data } = await api.put('/profile', payload)
      setProfile(data)
      setNotice('Health profile saved.')
      refresh()
    } catch (error) {
      setPageError(getApiError(error))
    } finally {
      setSettingsBusy(false)
    }
  }

  const saveLog = async (event) => {
    event.preventDefault()
    if (logBusy) return
    setLogBusy(true)
    setPageError('')
    const payload = {
      ...logForm,
      steps: logForm.steps === '' ? null : Number(logForm.steps), sleep: logForm.sleep === '' ? null : Number(logForm.sleep),
      hydration: logForm.hydration === '' ? null : Number(logForm.hydration), activityMinutes: logForm.activityMinutes === '' ? null : Number(logForm.activityMinutes),
    }
    try {
      if (editingLog) await api.put(`/health-logs/${editingLog}`, payload)
      else await api.post('/health-logs', payload)
      setLogForm(blankLog())
      setEditingLog(null)
      setLogFormOpen(false)
      setNotice('Daily activity saved.')
      refresh()
    } catch (error) {
      setPageError(getApiError(error))
    } finally {
      setLogBusy(false)
    }
  }

  const editLog = (log) => {
    setEditingLog(idOf(log))
    setLogForm({
      date: new Date(log.date).toISOString().slice(0, 10), steps: log.steps ?? '', sleep: log.sleep ?? '',
      hydration: log.hydration ?? '', activityType: log.activityType || 'Other',
      activityMinutes: log.activityMinutes ?? '', notes: log.notes || '',
    })
    setLogFormOpen(true)
  }

  const removeLog = async (log) => {
    if (!window.confirm(`Delete the activity record for ${new Date(log.date).toLocaleDateString()}?`)) return
    try {
      await api.delete(`/health-logs/${idOf(log)}`)
      setNotice('Activity record deleted.')
      refresh()
    } catch (error) {
      setPageError(getApiError(error))
    }
  }

  const generateRecommendations = async () => {
    setRecommendationBusy(true)
    setPageError('')
    try {
      await api.post('/recommendations/generate')
      setNotice('Personalised suggestions generated from your saved profile and logs.')
      refresh()
    } catch (error) {
      setPageError(getApiError(error))
    } finally {
      setRecommendationBusy(false)
    }
  }

  const updateRecommendation = async (recommendation, patch) => {
    try {
      await api.patch(`/recommendations/${idOf(recommendation)}/feedback`, patch)
      setRecommendations((current) => current.map((item) => idOf(item) === idOf(recommendation) ? { ...item, ...patch } : item).filter((item) => item.status !== 'dismissed'))
      setNotice(patch.status === 'dismissed' ? 'Suggestion dismissed.' : 'Feedback saved.')
    } catch (error) {
      setPageError(getApiError(error))
    }
  }

  const markNotificationRead = async (notification) => {
    try {
      await api.patch(`/notifications/${idOf(notification)}/read`)
      setNotifications((current) => current.map((item) => idOf(item) === idOf(notification) ? { ...item, readAt: new Date().toISOString() } : item))
      setUnreadCount((count) => Math.max(0, count - (notification.readAt ? 0 : 1)))
    } catch (error) {
      setPageError(getApiError(error))
    }
  }

  const savePreferences = async (next) => {
    try {
      const { data } = await api.patch('/settings/preferences', next)
      setPreferences(data)
      setNotice('Notification settings saved.')
    } catch (error) {
      setPageError(getApiError(error))
    }
  }

  const changePassword = async (event) => {
    event.preventDefault()
    setSettingsBusy(true)
    try {
      const { data } = await api.put('/settings/password', passwordForm)
      setPasswordForm({ currentPassword: '', newPassword: '' })
      if (data.token) {
        localStorage.setItem('healthmate-token', data.token)
        setToken(data.token)
      }
      setNotice(data.message)
    } catch (error) {
      setPageError(getApiError(error))
    } finally {
      setSettingsBusy(false)
    }
  }

  const exportData = async () => {
    try {
      const { data } = await api.get('/settings/export')
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const href = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = href
      anchor.download = 'healthmate-data-export.json'
      anchor.click()
      URL.revokeObjectURL(href)
      setNotice('Your data export was downloaded.')
    } catch (error) {
      setPageError(getApiError(error))
    }
  }

  const deleteAccount = async () => {
    const password = window.prompt('Enter your password to permanently delete your account and data.')
    if (!password) return
    if (!window.confirm('This permanently deletes your account and all saved wellness records. Continue?')) return
    try {
      await api.delete('/settings/account', { data: { password } })
      logout()
    } catch (error) {
      setPageError(getApiError(error))
    }
  }

  const loadReport = async (event) => {
    event.preventDefault()
    setPageError('')
    setReport(null)
    try {
      const { data } = await api.get('/reports/summary', { params: reportRange })
      setReport(data)
    } catch (error) {
      setPageError(getApiError(error))
    }
  }

  const todayLog = logs.find((log) => new Date(log.date).toISOString().slice(0, 10) === today())
  const dashboardGoals = [
    { name: 'Steps', value: todayLog?.steps == null ? null : Number(todayLog.steps), target: analytics?.goals?.steps || 10000, tone: 'green' },
    { name: 'Sleep', value: todayLog?.sleep == null ? null : Number(todayLog.sleep), target: analytics?.goals?.sleep || 8, tone: 'purple' },
    { name: 'Water', value: todayLog?.hydration == null ? null : Number(todayLog.hydration), target: analytics?.goals?.hydration || 2.5, tone: 'blue' },
    { name: 'Activity', value: todayLog?.activityMinutes == null ? null : Number(todayLog.activityMinutes), target: analytics?.goals?.activityMinutes || 30, tone: 'orange' },
  ]
  const [currentDateLabel] = useState(() => new Date().toLocaleDateString())
  const filteredRecommendations = recommendations.filter((item) => recommendationCategory === 'all' || item.type === recommendationCategory)
  const utcToday = new Date(`${today()}T00:00:00.000Z`).getTime()
  const periodLogs = logs.filter((log) => {
    const ageDays = Math.floor((utcToday - new Date(log.date).getTime()) / 86400000)
    return progressRange === 1 ? ageDays === 0 : ageDays >= 0 && ageDays < progressRange
  }).sort((a, b) => new Date(a.date) - new Date(b.date))
  const previousPeriodLogs = logs.filter((log) => {
    const ageDays = Math.floor((utcToday - new Date(log.date).getTime()) / 86400000)
    return ageDays >= progressRange && ageDays < progressRange * 2
  })
  const toChartPoint = (log) => ({
    day: new Date(log.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    steps: log.steps ?? null, sleep: log.sleep ?? null, water: log.hydration ?? null,
  })
  const chartData = periodLogs.map(toChartPoint)
  const weeklyChartData = logs.filter((log) => {
    const ageDays = Math.floor((utcToday - new Date(log.date).getTime()) / 86400000)
    return ageDays >= 0 && ageDays < 7
  }).sort((a, b) => new Date(a.date) - new Date(b.date)).map(toChartPoint)
  const averageValue = (field) => {
    const entries = periodLogs.filter((log) => log[field] !== null && log[field] !== undefined)
    if (!entries.length) return null
    return entries.reduce((sum, log) => sum + Number(log[field]), 0) / entries.length
  }
  const goalCompletion = (field, target) => {
    const entries = periodLogs.filter((log) => log[field] !== null && log[field] !== undefined)
    const complete = entries.filter((log) => Number(log[field]) >= target).length
    return { complete, available: entries.length, percent: entries.length ? Math.round((complete / entries.length) * 100) : 0 }
  }
  const periodComparison = (field) => {
    const currentValues = periodLogs.filter((log) => log[field] !== null && log[field] !== undefined)
    const previousValues = previousPeriodLogs.filter((log) => log[field] !== null && log[field] !== undefined)
    const minimumRecords = progressRange === 1 ? 1 : 3
    if (currentValues.length < minimumRecords || previousValues.length < minimumRecords) return null
    const currentAverage = currentValues.reduce((sum, log) => sum + Number(log[field]), 0) / currentValues.length
    const previousAverage = previousValues.reduce((sum, log) => sum + Number(log[field]), 0) / previousValues.length
    const difference = Number((currentAverage - previousAverage).toFixed(1))
    return `${difference > 0 ? '+' : ''}${difference} vs previous period`
  }
  const searchResults = [
    ...pages.filter((page) => page.name.toLowerCase().includes(searchText.toLowerCase())).map((page) => ({ label: page.name, detail: 'Page', path: page.path })),
    ...recommendations.filter((item) => item.title.toLowerCase().includes(searchText.toLowerCase())).slice(0, 5).map((item) => ({ label: item.title, detail: `${item.type} recommendation`, path: '/recommendations' })),
  ]

  const renderAuth = () => (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="brand-icon auth-icon"><Heart size={25} fill="currentColor" /></div>
          <div><p className="eyebrow">HealthMate</p><h1>{authMode === 'login' ? 'Welcome back' : 'Create account'}</h1></div>
        </div>
        <p className="auth-description">Personal wellness insights, grounded in the information you choose to save.</p>
        <div className="auth-toggle">
          <button type="button" className={authMode === 'login' ? 'active' : ''} onClick={() => setAuthMode('login')}>Login</button>
          <button type="button" className={authMode === 'register' ? 'active' : ''} onClick={() => setAuthMode('register')}>Register</button>
        </div>
        <form className="auth-form" onSubmit={submitAuth}>
          {authMode === 'register' && <label>Full name<input required minLength="2" maxLength="80" value={authForm.name} onChange={(event) => setAuthForm({ ...authForm, name: event.target.value })} autoComplete="name" /></label>}
          <label>Email<input required type="email" value={authForm.email} onChange={(event) => setAuthForm({ ...authForm, email: event.target.value })} autoComplete="email" /></label>
          <label>Password<input required type="password" minLength="8" maxLength="128" value={authForm.password} onChange={(event) => setAuthForm({ ...authForm, password: event.target.value })} autoComplete={authMode === 'login' ? 'current-password' : 'new-password'} /></label>
          {authError && <p className="form-error" role="alert">{authError}</p>}
          <button type="submit" className="auth-submit" disabled={authBusy}>{authBusy ? 'Please wait...' : authMode === 'login' ? 'Sign in' : 'Create account'}</button>
        </form>
        <p className="privacy-note">General wellness support only. Not medical diagnosis or treatment.</p>
      </div>
    </div>
  )

  const renderDashboard = () => (
    <>
      <div className="dashboard-main-grid">
        <div className="content-main">
          <section className="welcome-card">
            <div className="welcome-header"><h2>Good day, {user?.name?.split(' ')[0] || 'there'}</h2><span className="date-pill"><CalendarDays size={15} /> Today <strong>{currentDateLabel}</strong></span></div>
            <div className="metric-grid">
              {[
                { label: 'Steps', value: todayLog?.steps, unit: 'steps', tone: 'green', sub: `Goal: ${dashboardGoals[0].target.toLocaleString()}` },
                { label: 'Sleep', value: todayLog?.sleep, unit: 'hours', tone: 'rose', sub: `Goal: ${dashboardGoals[1].target} hours` },
                { label: 'Water intake', value: todayLog?.hydration, unit: 'litres', tone: 'blue', sub: `Goal: ${dashboardGoals[2].target} litres` },
                { label: 'Activity', value: todayLog?.activityMinutes, unit: 'minutes', tone: 'amber', sub: `Goal: ${dashboardGoals[3].target} minutes` },
              ].map((metric) => <div key={metric.label} className={`metric-box ${metric.tone}`}><div className="metric-topline"><span>{metric.label}</span></div><div className="metric-value-row"><strong>{metric.value ?? '--'}</strong><span>{metric.value == null ? 'No entry' : metric.unit}</span></div><small>{metric.sub}</small></div>)}
            </div>
            {!todayLog && <p className="inline-empty">No activity saved for today yet. Use “Log today’s activity” to add your own data.</p>}
          </section>

          <section className="progress-panel">
            <div className="panel-header"><h3>Weekly Wellness Progress</h3><div className="legend-row"><span>Steps</span><span>Sleep (hours)</span><span>Water (litres)</span></div></div>
            {weeklyChartData.length ? <div className="chart-wrap"><ResponsiveContainer width="100%" height={240}><LineChart data={weeklyChartData}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f3" vertical={false} /><XAxis dataKey="day" tickLine={false} axisLine={false} /><YAxis tickLine={false} axisLine={false} /><Tooltip /><Line connectNulls type="monotone" dataKey="steps" stroke="#5ec182" strokeWidth={3} dot={false} /><Line connectNulls type="monotone" dataKey="sleep" stroke="#7c6af5" strokeWidth={2} dot={false} /><Line connectNulls type="monotone" dataKey="water" stroke="#5ab0ff" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer></div> : <EmptyState text="Your chart will appear after you save activity records." />}
            <div className="goal-panel dashboard-goals">{dashboardGoals.map((goal) => { const percent = goal.value == null ? 0 : Math.min(100, Math.round((goal.value / goal.target) * 100)); return <div className="goal-item" key={goal.name}><div className="goal-header"><span>{goal.name}</span><span>{goal.value == null ? 'Not logged' : `${percent}%`}</span></div><div className="goal-progress"><span style={{ width: `${percent}%` }} /></div><small>{goal.value == null ? 'No value entered for today' : `${goal.value} of ${goal.target}`}</small></div> })}</div>
          </section>

          <section className="recommendation-panel">
            <div className="panel-header"><h3>Personalised Wellness Recommendations</h3><button type="button" onClick={() => goTo('/recommendations')}>View all</button></div>
            {recommendations.length ? <div className="recommendation-grid">{recommendations.slice(0, 3).map((item) => <RecommendationCard key={idOf(item)} item={item} onFeedback={updateRecommendation} compact />)}</div> : <EmptyState text="No saved suggestions yet. Add profile details, then generate recommendations." action={<button className="secondary-button" type="button" onClick={() => goTo('/recommendations')}>Explore recommendations</button>} />}
          </section>
        </div>
        <aside className="right-rail">
          <div className="note-box"><div className="sparkle"><Sparkles size={18} /></div><div><strong>Small steps, on your terms.</strong><p>Suggestions are general wellness information.</p></div></div>
          <div className="quick-actions"><h3>Quick Actions</h3><button className="action-btn primary" type="button" onClick={() => goTo('/recommendations')}>View recommendations</button><button className="action-btn" type="button" onClick={() => { setLogForm(blankLog()); setEditingLog(null); setLogFormOpen(true); goTo('/progress') }}>Log today&apos;s activity</button><button className="action-btn" type="button" onClick={() => goTo('/profile')}>Update health profile</button></div>
          <div className="activity-panel profile-summary"><div className="panel-header compact-header"><h3>Health Profile</h3><button type="button" onClick={() => goTo('/profile')}>Edit</button></div>{profile ? <dl><div><dt>Activity</dt><dd>{profile.activityLevel || 'Not set'}</dd></div><div><dt>Diet</dt><dd>{profile.diet || 'Not set'}</dd></div><div><dt>Goal</dt><dd>{profile.goal || (profile.wellnessGoals || [])[0] || 'Not set'}</dd></div></dl> : <p className="muted-copy">Add optional details to personalize general suggestions.</p>}</div>
          <div className="activity-panel"><div className="panel-header compact-header"><h3>Recent Activity</h3><button type="button" onClick={() => goTo('/progress')}>View all</button></div>{logs.slice(0, 4).length ? <div className="activity-list">{logs.slice(0, 4).map((log) => <div className="activity-row" key={idOf(log)}><span className="activity-bullet steps" /><div><p>{log.activityType || 'Wellness log'} · {log.steps == null ? 'Steps not recorded' : `${Number(log.steps).toLocaleString()} steps`}</p><small>{new Date(log.date).toLocaleDateString()}</small></div></div>)}</div> : <p className="muted-copy">Saved activity appears here.</p>}</div>
        </aside>
      </div>
    </>
  )

  const renderProfile = () => (
    <section className="page-panel"><div className="page-heading"><div><p className="eyebrow">Your information</p><h2>Health Profile</h2></div></div><p className="muted-copy">Optional details help tailor general wellness suggestions. Leave any field blank if you prefer.</p>
      <form className="data-form" onSubmit={saveProfile}>
        <FormSelect label="Age range" value={profileForm.ageRange} onChange={(value) => setProfileForm({ ...profileForm, ageRange: value })} options={['', 'under-18', '18-24', '25-34', '35-44', '45-54', '55-64', '65-plus', 'prefer-not-to-say']} />
        <FormInput label="Height (cm), optional" type="number" min="80" max="250" value={profileForm.height} onChange={(value) => setProfileForm({ ...profileForm, height: value })} />
        <FormInput label="Weight (kg), optional" type="number" min="20" max="350" value={profileForm.weight} onChange={(value) => setProfileForm({ ...profileForm, weight: value })} />
        <FormSelect label="Activity level" value={profileForm.activityLevel} onChange={(value) => setProfileForm({ ...profileForm, activityLevel: value })} options={['beginner', 'low', 'moderate', 'active', 'high']} />
        <FormSelect label="Diet preference" value={profileForm.diet} onChange={(value) => setProfileForm({ ...profileForm, diet: value })} options={['balanced', 'vegetarian', 'vegan', 'pescatarian', 'other']} />
        <FormInput label="Primary wellness goal" maxLength="100" value={profileForm.goal} onChange={(value) => setProfileForm({ ...profileForm, goal: value })} placeholder="For example: build a consistent walking routine" />
        <FormInput label="Other goals (comma-separated)" maxLength="300" value={profileForm.goalsText} onChange={(value) => setProfileForm({ ...profileForm, goalsText: value })} placeholder="Sleep routine, daily movement" />
        <FormInput label="Dietary preferences (comma-separated)" maxLength="300" value={profileForm.dietaryText} onChange={(value) => setProfileForm({ ...profileForm, dietaryText: value })} placeholder="Vegetarian, dairy-free" />
        <FormInput label="Typical sleep (hours), optional" type="number" min="0" max="24" step="0.25" value={profileForm.sleepHours} onChange={(value) => setProfileForm({ ...profileForm, sleepHours: value })} />
        <FormSelect label="Lifestyle" value={profileForm.lifestyle} onChange={(value) => setProfileForm({ ...profileForm, lifestyle: value })} options={['balanced', 'mostly sedentary', 'mixed routine', 'highly active']} />
        <div className="form-actions"><button className="primary-button" disabled={settingsBusy}>{settingsBusy ? 'Saving...' : 'Save health profile'}</button></div>
      </form>
    </section>
  )

  const renderRecommendations = () => (
    <section className="page-panel"><div className="page-heading"><div><p className="eyebrow">Rule-based and explainable</p><h2>Recommendations</h2></div><button className="primary-button" type="button" onClick={generateRecommendations} disabled={recommendationBusy}>{recommendationBusy ? 'Generating...' : 'Generate suggestions'}</button></div>
      <p className="muted-copy">General wellness information only. Suggestions are based on your saved profile and activity logs, not a medical assessment.</p>
      <p className="urgent-guidance">Priority labels only order general suggestions; they do not indicate medical urgency. For severe, sudden, or worsening symptoms, contact local emergency services or a qualified healthcare professional.</p>
      <p className="form-hint">Priority is a display label: high matches a saved preference or recent log, medium matches a selected goal or activity pattern, and low is a general fallback. It is not medical urgency or a risk score.</p>
      <div className="segmented-control" role="group" aria-label="Filter recommendations">{['all', 'nutrition', 'activity', 'sleep', 'lifestyle'].map((category) => <button type="button" key={category} className={recommendationCategory === category ? 'active' : ''} onClick={() => setRecommendationCategory(category)}>{category[0].toUpperCase() + category.slice(1)}</button>)}</div>
      {filteredRecommendations.length ? <div className="recommendation-list">{filteredRecommendations.map((item) => <RecommendationCard key={idOf(item)} item={item} onFeedback={updateRecommendation} />)}</div> : <EmptyState text={recommendationCategory === 'all' ? 'No saved recommendations. Generate suggestions to get started.' : `No ${recommendationCategory} suggestions saved.`} action={<button className="secondary-button" type="button" disabled={recommendationBusy} onClick={generateRecommendations}>{recommendationBusy ? 'Generating...' : 'Generate suggestions'}</button>} />}
    </section>
  )

  const renderLogForm = () => <form className="data-form log-form" onSubmit={saveLog}>
    <FormInput label="Date" type="date" required value={logForm.date} onChange={(value) => setLogForm({ ...logForm, date: value })} />
    <FormInput label="Steps" type="number" min="0" max="100000" value={logForm.steps} onChange={(value) => setLogForm({ ...logForm, steps: value })} />
    <FormInput label="Sleep duration (hours)" type="number" min="0" max="24" step="0.25" value={logForm.sleep} onChange={(value) => setLogForm({ ...logForm, sleep: value })} />
    <FormInput label="Water intake (litres)" type="number" min="0" max="20" step="0.1" value={logForm.hydration} onChange={(value) => setLogForm({ ...logForm, hydration: value })} />
    <FormSelect label="Activity type" value={logForm.activityType} onChange={(value) => setLogForm({ ...logForm, activityType: value })} options={['Walking', 'Running', 'Cycling', 'Strength', 'Yoga', 'Other']} />
    <FormInput label="Activity duration (minutes)" type="number" min="0" max="1440" value={logForm.activityMinutes} onChange={(value) => setLogForm({ ...logForm, activityMinutes: value })} />
    <label className="field-label full-width">Notes<textarea maxLength="500" rows="3" value={logForm.notes} onChange={(event) => setLogForm({ ...logForm, notes: event.target.value })} /></label>
    <div className="form-actions full-width"><button className="primary-button" disabled={logBusy}>{logBusy ? 'Saving...' : editingLog ? 'Update activity' : 'Save activity'}</button><button className="secondary-button" type="button" onClick={() => { setLogFormOpen(false); setEditingLog(null) }}>Cancel</button></div>
    <p className="form-hint full-width">One saved record per date. Saving that date again updates its existing record.</p>
  </form>

  const renderProgress = () => (
    <section className="page-panel"><div className="page-heading"><div><p className="eyebrow">Your saved records</p><h2>Progress</h2></div><button className="primary-button" type="button" onClick={() => { setEditingLog(null); setLogForm(blankLog()); setLogFormOpen((open) => !open) }}><Plus size={16} /> Log activity</button></div>
      <div className="segmented-control" role="group" aria-label="Progress date range">{[{ value: 1, label: 'Today' }, { value: 7, label: '7 Days' }, { value: 30, label: '30 Days' }].map((item) => <button key={item.value} type="button" className={progressRange === item.value ? 'active' : ''} onClick={() => setProgressRange(item.value)}>{item.label}</button>)}</div>
      {logFormOpen && <div className="form-section"><h3>{editingLog ? 'Edit activity' : 'Log activity'}</h3>{renderLogForm()}</div>}
      <div className="metric-grid progress-metrics">{[
        ['Steps', 'steps', averageValue('steps') == null ? 'Not recorded' : Math.round(averageValue('steps')).toLocaleString(), 'average per recorded day'],
        ['Sleep', 'sleep', averageValue('sleep') == null ? 'Not recorded' : `${averageValue('sleep').toFixed(1)} h`, 'average per recorded day'],
        ['Water', 'hydration', averageValue('hydration') == null ? 'Not recorded' : `${averageValue('hydration').toFixed(1)} L`, 'average per recorded day'],
        ['Activity', 'activityMinutes', averageValue('activityMinutes') == null ? 'Not recorded' : `${Math.round(averageValue('activityMinutes'))} min`, 'average per recorded day'],
      ].map(([label, field, value, note]) => <div className="metric-box blue" key={label}><div className="metric-topline">{label}</div><div className="metric-value-row"><strong>{value}</strong></div><small>{note}</small>{periodComparison(field) && <small className="comparison-note">{periodComparison(field)}</small>}</div>)}</div>
      <div className="completion-grid">{[
        ['Steps', 'steps', 10000], ['Sleep', 'sleep', 8], ['Water', 'hydration', 2.5], ['Activity', 'activityMinutes', 30],
      ].map(([label, field, target]) => { const completion = goalCompletion(field, target); return <div className="goal-item" key={label}><div className="goal-header"><span>{label} goal</span><span>{completion.available ? `${completion.percent}%` : 'No data'}</span></div><div className="goal-progress"><span style={{ width: `${completion.percent}%` }} /></div><small>{completion.available ? `${completion.complete}/${completion.available} recorded days met the ${target} target` : 'No values entered in this period'}</small></div> })}</div>
      {chartData.length ? <div className="chart-wrap progress-chart"><ResponsiveContainer width="100%" height={280}><LineChart data={chartData}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="day" /><YAxis /><Tooltip /><Line type="monotone" dataKey="steps" stroke="#52b67a" strokeWidth={3} /><Line type="monotone" dataKey="sleep" stroke="#7866df" strokeWidth={2} /><Line type="monotone" dataKey="water" stroke="#4a9fe8" strokeWidth={2} /></LineChart></ResponsiveContainer></div> : <EmptyState text="No records are available for this period. Add a daily log to start tracking." />}
      <div className="records-heading"><h3>Saved activity</h3><span>{periodLogs.length} record{periodLogs.length === 1 ? '' : 's'}</span></div>
      {periodLogs.length ? <div className="table-wrap"><table><thead><tr><th>Date</th><th>Steps</th><th>Sleep</th><th>Water</th><th>Activity</th><th>Actions</th></tr></thead><tbody>{[...periodLogs].reverse().map((log) => <tr key={idOf(log)}><td>{new Date(log.date).toLocaleDateString()}</td><td>{log.steps == null ? 'Not recorded' : Number(log.steps).toLocaleString()}</td><td>{log.sleep == null ? 'Not recorded' : `${log.sleep} h`}</td><td>{log.hydration == null ? 'Not recorded' : `${log.hydration} L`}</td><td>{log.activityType || 'Other'} · {log.activityMinutes == null ? 'Not recorded' : `${log.activityMinutes} min`}</td><td className="table-actions"><button type="button" aria-label="Edit activity" title="Edit activity" onClick={() => editLog(log)}><Pencil size={16} /></button><button type="button" aria-label="Delete activity" title="Delete activity" onClick={() => removeLog(log)}><Trash2 size={16} /></button></td></tr>)}</tbody></table></div> : null}
    </section>
  )

  const renderReports = () => (
    <section className="page-panel"><div className="page-heading"><div><p className="eyebrow">Based on saved records</p><h2>Reports</h2></div></div>
      <form className="report-form" onSubmit={loadReport}><FormInput label="From" type="date" required value={reportRange.from} onChange={(value) => setReportRange({ ...reportRange, from: value })} /><FormInput label="To" type="date" required value={reportRange.to} onChange={(value) => setReportRange({ ...reportRange, to: value })} /><button className="primary-button">Generate summary</button></form>
      {report ? <div className="report-content" id="wellness-report"><div className="page-heading"><div><h3>Wellness summary</h3><p className="muted-copy">{reportRange.from} – {reportRange.to} · {report.recordCount} saved record{report.recordCount === 1 ? '' : 's'}</p></div><button className="secondary-button no-print" type="button" onClick={() => window.print()}><Download size={16} /> Save as PDF</button></div>
        {report.recordCount ? <><div className="metric-grid">{[['Steps', report.totals.steps == null ? 'Not recorded' : report.totals.steps.toLocaleString(), 'total steps'], ['Sleep', report.totals.sleep == null ? 'Not recorded' : `${report.totals.sleep.toFixed(1)} h`, 'total hours'], ['Water', report.totals.hydration == null ? 'Not recorded' : `${report.totals.hydration.toFixed(1)} L`, 'total litres'], ['Activity', report.totals.activityMinutes == null ? 'Not recorded' : `${report.totals.activityMinutes} min`, 'total minutes']].map(([label, value, detail]) => <div className="metric-box blue" key={label}><div className="metric-topline">{label}</div><div className="metric-value-row"><strong>{value}</strong></div><small>{detail}</small></div>)}</div>{report.missingData.length > 0 && <p className="form-hint">Not entered in this range: {report.missingData.join(', ')}.</p>}</> : <EmptyState text="No records were saved in this date range. No values have been estimated." />}
        <p className="form-hint">This summary reports manually entered information and does not provide a medical assessment.</p>
      </div> : <EmptyState text="Choose a date range and generate a summary from your saved wellness records." />}
    </section>
  )

  const renderSettings = () => (
    <section className="page-panel"><div className="page-heading"><div><p className="eyebrow">Account and privacy</p><h2>Settings</h2></div></div>
      <div className="settings-grid"><div className="info-card"><h3>Account</h3><p><strong>{user?.name}</strong></p><p>{user?.email}</p><p className="muted-copy">Password hashes are never included in data exports.</p></div>
        <div className="info-card"><h3>Notifications</h3><label className="toggle-row"><span>In-app notifications</span><input type="checkbox" checked={preferences.notificationsEnabled} onChange={(event) => savePreferences({ notificationsEnabled: event.target.checked })} /></label><label className="toggle-row"><span>Email notifications</span><input type="checkbox" checked={preferences.notificationPreferences?.email || false} onChange={(event) => savePreferences({ notificationPreferences: { ...preferences.notificationPreferences, email: event.target.checked } })} /></label><p className="form-hint">Email delivery is a saved preference; outbound email integration is not configured.</p></div>
      </div>
      <div className="info-card settings-section"><h3>Change password</h3><form className="data-form password-form" onSubmit={changePassword}><FormInput label="Current password" type="password" required autoComplete="current-password" value={passwordForm.currentPassword} onChange={(value) => setPasswordForm({ ...passwordForm, currentPassword: value })} /><FormInput label="New password" type="password" required minLength="8" maxLength="128" autoComplete="new-password" value={passwordForm.newPassword} onChange={(value) => setPasswordForm({ ...passwordForm, newPassword: value })} /><div className="form-actions"><button className="primary-button" disabled={settingsBusy}>Update password</button></div></form></div>
      <div className="info-card settings-section"><h3>Your data</h3><p className="muted-copy">Download the account information currently stored by HealthMate.</p><button className="secondary-button" type="button" onClick={exportData}><Download size={16} /> Export account data</button></div>
      <div className="danger-zone"><div><h3>Delete account</h3><p>This permanently removes your account and associated wellness records.</p></div><button className="danger-button" type="button" onClick={deleteAccount}>Delete account</button></div>
    </section>
  )

  if (!user || !token) return renderAuth()

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand-block"><div className="brand-icon"><Heart size={25} fill="currentColor" /></div><div className="brand-copy"><h1>HealthMate</h1><small>Personal wellness</small></div></div>
      <nav className="nav-block" aria-label="Main navigation">{pages.map(({ name, path, icon: Icon }) => <button key={name} type="button" className={`nav-item ${activePage === name ? 'active' : ''}`} aria-current={activePage === name ? 'page' : undefined} onClick={() => goTo(path)}><Icon size={18} /><span>{name}</span></button>)}</nav>
      <div className="user-card"><div className="avatar">{user.name?.charAt(0).toUpperCase()}</div><div className="user-card-copy"><strong>{user.name}</strong><small>{user.email}</small></div><button className="logout-btn" type="button" onClick={logout} aria-label="Log out" title="Log out"><LogOut size={17} /></button></div>
    </aside>
    <main className="dashboard-panel">
      <header className="topbar"><div className="topbar-left"><span className="tiny-badge"><Heart size={18} fill="currentColor" /></span><div><strong>HealthMate</strong><small>{activePage}</small></div></div>
        <div className="search-area"><div className="search-box"><Search size={17} /><input type="search" aria-label="Search pages and recommendations" placeholder="Search pages and recommendations" value={searchText} onFocus={() => setSearchOpen(true)} onChange={(event) => { setSearchText(event.target.value); setSearchOpen(true) }} onKeyDown={(event) => { if (event.key === 'Escape') setSearchOpen(false); if (event.key === 'Enter' && searchResults[0]) goTo(searchResults[0].path) }} /></div>{searchOpen && searchText && <div className="popover search-results">{searchResults.length ? searchResults.map((item) => <button type="button" key={`${item.detail}-${item.label}`} onClick={() => goTo(item.path)}><span>{item.label}</span><small>{item.detail}</small></button>) : <p>No matching pages or saved recommendations.</p>}</div>}</div>
        <div className="topbar-right"><div className="popover-anchor"><button className="icon-btn notification-button" type="button" aria-label={`Notifications, ${unreadCount} unread`} onClick={() => { setNotificationsOpen((open) => !open); setAccountOpen(false) }}><Bell size={18} />{unreadCount > 0 && <span className="notification-count">{unreadCount}</span>}</button>{notificationsOpen && <div className="popover notifications-menu"><h3>Notifications</h3>{notifications.length ? notifications.map((item) => <button className={!item.readAt ? 'unread' : ''} type="button" key={idOf(item)} onClick={() => markNotificationRead(item)}><strong>{item.title}</strong><span>{item.message}</span><small>{new Date(item.createdAt).toLocaleString()} · {item.readAt ? 'Read' : 'Mark read'}</small></button>) : <p>No notifications yet.</p>}</div>}</div>
          <div className="popover-anchor"><button className="account-trigger" type="button" onClick={() => { setAccountOpen((open) => !open); setNotificationsOpen(false) }}><span className="mini-avatar">{user.name?.charAt(0).toUpperCase()}</span><span className="account-name">{user.name}</span><ChevronDown size={15} /></button>{accountOpen && <div className="popover account-menu"><p><strong>{user.name}</strong><small>{user.email}</small></p><button type="button" onClick={() => goTo('/profile')}>Health profile</button><button type="button" onClick={() => goTo('/settings')}>Settings</button><button type="button" onClick={logout}>Log out</button></div>}</div>
        </div>
      </header>
      <div className="page-content">{notice && <div className="success-banner" role="status"><Check size={16} />{notice}<button type="button" aria-label="Dismiss message" onClick={() => setNotice('')}><X size={15} /></button></div>}{pageError && <div className="error-banner" role="alert">{pageError}<button type="button" onClick={() => { setPageError(''); refresh() }}>Dismiss</button></div>}{loading && <div className="loading-banner">Loading saved HealthMate data...</div>}
        <Routes>
          <Route path="/" element={renderDashboard()} />
          <Route path="/profile" element={renderProfile()} />
          <Route path="/recommendations" element={renderRecommendations()} />
          <Route path="/progress" element={renderProgress()} />
          <Route path="/reports" element={renderReports()} />
          <Route path="/settings" element={renderSettings()} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </main>
  </div>
}

function FormInput({ label, value, onChange, ...props }) {
  return <label className="field-label">{label}<input value={value} onChange={(event) => onChange(event.target.value)} {...props} /></label>
}

function FormSelect({ label, value, onChange, options }) {
  return <label className="field-label">{label}<select value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option value={option} key={option}>{option ? option.replaceAll('-', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) : 'Select an option'}</option>)}</select></label>
}

function EmptyState({ text, action }) {
  return <div className="empty-state"><span><Activity size={20} /></span><p>{text}</p>{action}</div>
}

function RecommendationCard({ item, onFeedback, compact = false }) {
  return <article className={`recommendation-row ${compact ? 'recommendation-compact' : ''}`}>
    <div className="reco-icon">{recommendationIcons[item.type] || '✦'}</div><div className="reco-copy"><div className="recommendation-title-row"><strong>{item.title}</strong><span className={`priority-badge ${item.priority || 'low'}`}>{item.priority || 'general'}</span></div><p>{item.message || item.description}</p><p className="reason-copy"><strong>Why this may help:</strong> {item.reason || 'Based on your saved wellness preferences.'}</p>{item.relevance && <small className="relevance-copy">Relevant to: {item.relevance}</small>}<div className="recommendation-actions"><button type="button" onClick={() => onFeedback(item, { feedback: 'helpful' })}>Helpful</button><button type="button" onClick={() => onFeedback(item, { feedback: 'not-helpful' })}>Not helpful</button><button type="button" onClick={() => onFeedback(item, { status: 'dismissed' })}>Dismiss</button></div></div>
  </article>
}

export default App
