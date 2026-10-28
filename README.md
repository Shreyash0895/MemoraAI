# MemoraAI - Caregiver Portal

React (Vite) frontend + Node/Express API + SQLite database (run with Docker).

## Run (two terminals)

1. Backend and database
       cp .env.example .env          # then set JWT_SECRET (openssl rand -hex 32)
       docker compose up --build
   API: http://localhost:4000/api/health   (SQLite file is kept in the `memoraai-data` Docker volume)

2. Frontend
       npm install
       npm run dev                   # http://localhost:5173

Demo login (seeded when SEED_DEMO=true): caregiver@memoraai.demo / Memora@123

## Handy commands
    docker compose logs -f api       # backend logs
    docker compose down              # stop (data is kept)
    docker compose down -v           # stop and DELETE all data

## What is stored in SQLite
| Table | Holds |
|---|---|
| users | caregiver accounts (password hashes only) and patient name |
| settings | home coordinates, safe-zone radius, time zone, and alert state |
| devices | the badge (only a hash of its key), last seen time, battery |
| medicines, medicine_logs, medicine_alerts | schedule, each dose marked taken, one missed-dose alert per day |
| alerts | SOS, safe-zone, missed-medicine, unknown-face and battery alerts with status |
| locations | GPS history (latest 2000 points per caregiver) |
| activity | the dashboard timeline |
| people, person_photos | family and friends (name, relationship, note) and up to 5 photos each, stored as images in the database |

## Server-side monitoring
The server (not the browser) runs all the rules, so alerts are created even when the dashboard is closed:
- Safe zone: one alert when the patient crosses the radius, with a buffer before they count as back inside.
- Missed medicine: checked every minute in the patient's time zone, 30 minutes after the scheduled time.
- Low battery (20% or below, re-armed after 30%), SOS, and unknown face alerts come from the badge.

## Connecting the badge
1. Open Settings, set the safe zone, and press "Generate device key".
2. The badge sends requests with the header `X-Device-Key: <key>` (see the table on the Settings page).
3. Until the hardware is ready, use the demo controls on the Location page. They send readings through the same server code.

## Tests
Logic tests for the geofence, battery and missed-medicine rules live outside the package; the Settings page lists the badge API.
