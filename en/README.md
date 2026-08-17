# Medical Clinic "Salud+" (English version)

English copy of the appointment-booking app: patients sign up, book appointments with different doctors (saved in the backend), and get an **email reminder one day before** to confirm or cancel. Includes a **front-desk (admin)** panel.

> This folder (`en/`) is the English version of the Spanish app in the repo root. Same features and architecture (Node/Express + SQLite), with all identifiers, comments and UI text in English.

## Run

```bash
npm install
npm start
# Booking: http://localhost:3200/   ·   Front desk: http://localhost:3200/admin.html
```

Sample specialties, doctors and schedules are created on first run. There is **no default admin**: create the front-desk account the first time at `/admin.html`. Patients sign up themselves from the booking site.

## How it works

1. The patient goes to `/`, picks **specialty → provider → day → time**, and confirms (requires an account). The appointment is `requested`.
2. A background job (every 15 min) finds appointments **24–25 h** away and emails **Confirm / Cancel** links (token-based, no login needed).
3. The front desk sees all appointments at `/admin.html` and changes their status.

### Emails
Without SMTP configured, the reminder runs in **demo mode** (logs the email instead of sending). Set `SMTP_*` in `.env` for real emails.
Test the reminder without waiting: `POST /api/v1/dev/run-reminders?now=<epoch_ms>`.

## Technical notes
- No default credentials; passwords hashed with **scrypt**; JWT with roles `patient` / `admin`.
- **No double-booking**: unique index `(doctor, date_time)` + server-side slot validation.
- Times computed and shown in **Argentina time** (stored in UTC).
- **Problem Details (RFC 7807)** errors, Helmet headers, rate limiting on auth.

## Main endpoints

| Method | Path | Access |
|--------|------|--------|
| GET | `/api/v1/specialties` · `/doctors` | public |
| GET | `/api/v1/doctors/{id}/availability?date=` | public |
| POST | `/api/v1/auth/register` · `/register-admin` · `/login` | public |
| POST | `/api/v1/appointments` | patient |
| GET | `/api/v1/appointments` | admin (all) / patient (own) |
| PATCH | `/api/v1/appointments/{id}/status` | admin |
| GET | `/api/v1/appointments/{id}/confirm?token=` | by token (email) |
