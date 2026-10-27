# HealthMate: Personalised Healthcare Recommendations Engine

HealthMate is an educational wellness app. Users enter their own profile and daily activity; a deterministic rule engine provides explainable general wellness suggestions. It does not diagnose, assess medical risk, prescribe treatment, or connect to wearable devices.

## Stack and Structure

- `client/`: React, Vite, React Router, Tailwind CSS, Axios, Recharts
- `server/`: Express, Mongoose, JWT, bcryptjs, Zod dependency, Helmet, CORS, rate-limited authentication
- `server/src/models/`: User, HealthProfile, HealthLog, Recommendation, Notification, ProgressLog
- `server/src/routes/`: Auth, profile, health logs, recommendations, analytics, reports, notifications, settings
- `server/test/`: API workflow tests using Node's built-in test runner

## Windows Setup

Use Node.js 20.19+ or 22.12+ and npm. From PowerShell in the repository root:

```powershell
npm install
Copy-Item server/.env.example server/.env
Copy-Item client/.env.example client/.env.local
npm run dev
```

The Vite frontend runs at the URL printed by Vite (usually `http://localhost:5177`) and the API at `http://localhost:5000`. The example env leaves `MONGODB_URI` blank, so the API uses memory-only demo mode; data is lost when the server restarts. To use MongoDB, set `MONGODB_URI` in `server/.env` before starting.

Quality checks:

```powershell
npm test
npm run lint
npm run build
```

## Environment Variables

`server/.env.example` contains `PORT`, `JWT_SECRET`, `MONGODB_URI`, `CLIENT_URL`, and `CLIENT_URLS`. Replace the JWT value with a long random secret before deployment. `client/.env.example` contains only the public API base URL (`VITE_API_URL`); never put database credentials or JWT secrets in frontend variables.

For local development, create a secret with:

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

Copy that output into the private `JWT_SECRET` entry in `server/.env`.

## MongoDB Atlas

1. Create an Atlas project and cluster, then create a database user with a strong password.
2. In Network Access, allow the development machine's current IP. For Render, configure the narrowest outbound IP range supported by the selected plan; do not leave broad access enabled as a production default.
3. Copy the Atlas Node.js connection string into `MONGODB_URI`, replace the username/password/database, and URL-encode special characters in credentials.
4. Keep the URI only in `server/.env` locally and in the Render secret environment settings in deployment. Never commit it.
5. Restart the API and check `GET /api/health`; `database` should report `mongo` when the Mongoose connection is active.

The app waits for the configured MongoDB connection before listening. When no URI is configured, it uses an ephemeral in-memory store for local demos.

## API Endpoints

All endpoints below except health and register/login require `Authorization: Bearer <token>`.

- `GET /api/health`
- `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`
- `GET /api/profile`, `PUT /api/profile`
- `GET /api/health-logs?from=YYYY-MM-DD&to=YYYY-MM-DD&page=1&limit=90`
- `POST /api/health-logs`, `PUT /api/health-logs/:id`, `DELETE /api/health-logs/:id`
- `GET /api/recommendations?category=nutrition`, `POST /api/recommendations/generate`, `PATCH /api/recommendations/:id/feedback`
- `GET /api/analytics/summary?days=7`
- `GET /api/reports/summary?from=YYYY-MM-DD&to=YYYY-MM-DD`
- `GET /api/notifications`, `PATCH /api/notifications/:id/read`
- `GET /api/settings/preferences`, `PATCH /api/settings/preferences`
- `PUT /api/settings/password`, `GET /api/settings/export`, `DELETE /api/settings/account`

Health records are user-scoped. There is one record per user per date: posting the date again updates that day's record; attempting to edit a record onto another occupied date returns `409`.

Recommendation priority is only a display ordering: `high` reflects a direct profile preference or recent log trigger, `medium` reflects a selected wellness goal or activity pattern, and `low` is the general fallback when more specific inputs are unavailable. None of these labels indicates medical urgency or risk.

## Manual Dashboard Checks

1. Register and log in; reload to verify the authenticated session and saved backend data.
2. Open Health Profile, save preferences, revisit the page, and confirm values reload.
3. Open Progress, create a daily record, edit it, save the same date again, then delete it. Confirm the dashboard metrics and chart update.
4. Generate recommendations; check category filtering, explanations, helpful/not-helpful feedback, and dismissal.
5. Change Today/7 Days/30 Days in Progress and confirm empty periods show an empty state rather than invented values.
6. Generate a report for dates with and without logs. Use “Save as PDF” to open the browser print dialog.
7. Save a log, open notifications, mark it read, and check the unread count.
8. In Settings, save notification preferences, change the password, export JSON, or delete the test account. Deletion requires password confirmation.

## Deployment

- **Vercel:** configure the project root as `client`, build command `npm run build`, output directory `dist`, and set `VITE_API_URL` to the Render API origin plus `/api`. `client/vercel.json` includes the SPA fallback.
- **Render:** use the root `render.yaml` blueprint. Set `MONGODB_URI`, a generated `JWT_SECRET`, and `CLIENT_URL` to the deployed Vercel origin. `CLIENT_URLS` may contain additional comma-separated frontend origins.

## Verification and Known Limits

`npm test` exercises auth, profile validation, daily-log upsert and ownership, recommendations and feedback, analytics, reports, notifications, export privacy, password changes, logout revocation, and account deletion against an ephemeral memory-mode API. MongoDB-backed persistence still requires a reachable Atlas/local MongoDB URI and was not available in the no-credential workspace environment. Email delivery and wearable integrations are not implemented; email notifications are only a saved preference. PDF export uses the browser print dialog's “Save as PDF” option. JWTs are bearer tokens stored in browser local storage; logout and password changes invalidate earlier tokens, but production should pair this with a strict CSP and XSS prevention or migrate to HttpOnly cookies with CSRF protection.
