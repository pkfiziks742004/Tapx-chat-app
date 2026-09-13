# WhatsApp-like (Email-based) + Supabase Postgres

MVP inspired by WhatsApp, but using **email** instead of phone number:

- **Custom Auth (Node.js API)**: Email OTP signup + Email/Password login + JWT sessions
- Add contacts by **email**
- 1:1 realtime chat (Socket.IO)
- 1:1 video/audio call (WebRTC)
- Message ticks: sent (1 tick), delivered (2 ticks), read (2 green ticks)
- Typing indicator ("typing…")
- File sharing: images/videos/audio/documents/zip (via Supabase Storage)
- Chat delete (for me) + auto-delete messages after 24h
- No MongoDB (users/contacts/messages are stored in **Supabase Postgres**)

## Setup

### 1) Supabase (Database)

Create a Supabase project (Postgres).

Run the DB schema:

- `supabase/schema.sql`

If you previously ran an older schema that referenced `auth.users`, drop the old tables and run the new schema again (this project no longer uses Supabase Auth).

If your server logs show an error like:

- `column profiles.email_verified does not exist`

...run `supabase/schema.sql` again (it now includes `ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...` fixes), then restart the server.

If your server logs show an error like:

- `insert or update on table "profiles" violates foreign key constraint "profiles_id_fkey"`

...you have an older `profiles.id -> users.id` foreign key. Re-run `supabase/schema.sql` (it drops `profiles_id_fkey`), then restart the server.

You'll need:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (server only)
- `JWT_SECRET` (server, for your app JWT)

### 1b) Supabase Storage (for files)

This app sends files via **Supabase Storage**, but the client never gets Supabase keys.

Create a bucket (recommended private):

- Bucket name: `chat-files` (or set `STORAGE_BUCKET` in `backend/.env`)

If you see upload errors, confirm the bucket exists and your `SUPABASE_SERVICE_ROLE_KEY` is correct.

### 2) SMTP (OTP emails)

OTP emails are sent by the **server** using SMTP (recommended: Gmail App Password).

Gmail notes:

- Turn on Google **2-Step Verification**
- Create a Google **App Password** and put it in `SMTP_PASS`
- Use `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=587`, `SMTP_SECURE=0`

Quick test (server):

- `cd backend`
- `npm.cmd run test:smtp -- you@gmail.com`

### 3) Environment files

Edit these files:

- `backend/.env`
- `frontend/.env`

### 4) Install + run

In PowerShell:

- `npm.cmd run install:all`
- Terminal 1: `npm.cmd run dev:backend`
- Terminal 2: `npm.cmd run dev:frontend`

Open:

- Client: `http://localhost:5173`
- API: `http://localhost:3000/health`

## Separate client/server

- Frontend code lives in `frontend/` and runs on port `5173`
- Backend code lives in `backend/` and runs on port `3000`
- The server does **not** serve the client (deploy them separately)

## Deploy (Vercel + Render)

### Deploy client on Vercel

1. Import the repo in Vercel
2. Set **Root Directory** to `frontend`
3. Set Environment Variables:
   - `VITE_API_URL` = your Render API URL (example: `https://YOUR-SERVICE.onrender.com`)

Vercel will build to `dist/` (see `frontend/vercel.json`).

### Deploy server on Render

1. Create a new **Web Service** on Render from this repo
2. Set **Root Directory** to `backend`
3. Build Command: `npm install`
4. Start Command: `npm start`
5. Set Environment Variables:
   - `CLIENT_ORIGIN` = your Vercel URL (you can also add `https://*.vercel.app` comma-separated)
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `JWT_SECRET`
   - `OTP_SECRET`
   - `SMTP_HOST`
   - `SMTP_PORT`
   - `SMTP_SECURE`
   - `SMTP_USER`
   - `SMTP_PASS`
   - `SMTP_FROM`
   - `SMTP_SENDER_NAME`

## Notes

- Message auto-delete is controlled by `MESSAGE_TTL_HOURS` (default `24`). Set `0` to disable.
- "Delete Chat" clears the thread only for the current user (WhatsApp-style "delete for me").
- If the app shows a red banner about schema mismatch (or the client console shows `500` for `/api/threads`), re-run `supabase/schema.sql` and restart the server.
- Video calling across different networks often needs a TURN server.
- "WhatsApp-like" UI/UX is implemented, but this is still an MVP (no groups/status/end-to-end encryption yet).
