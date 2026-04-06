# Restaurant attendance

Web app for restaurant employee **check-in** and **check-out**: admin dashboard (employees, rotating kiosk QR, weekly/monthly hours) and a mobile **kiosk** flow after scanning the QR.

## Features

- **Admin** signs in, manages employees, opens **Check-in QR** (new kiosk token each time the tab loads or when you click **New QR**).
- **Kiosk** (`/kiosk?token=…`): employee finds their name, then either checks in (selfie + confirm) or checks out if they already have an open shift.
- **Hours**: completed shifts only (`checkOutAt` set); sums duration per employee for a selected **week** (UTC, Monday-start) or **calendar month** (UTC). Raw attendance rows are kept; totals are computed from the database.

## Local setup

1. Copy [`.env.example`](./.env.example) to `.env` and set variables.

2. Start PostgreSQL (optional: use the included Docker Compose from this folder):

   ```bash
   docker compose up -d
   ```

   Default URL in `.env.example` matches Compose: `postgresql://app:app@localhost:5433/attendance`.

3. Apply migrations:

   ```bash
   npx prisma migrate deploy
   ```

   For iterative schema changes in development you can use `npm run db:migrate` instead.

4. Run the app:

   ```bash
   npm install
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000), sign in with `ADMIN_EMAIL` / `ADMIN_PASSWORD` (or bcrypt `ADMIN_PASSWORD_HASH`), add employees, then open the **Check-in QR** tab and scan with a phone.

### Selfie storage

- **Production (e.g. Vercel):** prefer `BLOB_READ_WRITE_TOKEN` (Vercel Blob) for normal URLs. If Blob is not set, selfies are stored as **data URLs** in the database (works for demos; keep images small).
- **Local dev:** if Blob is not set, files are written under `public/uploads/selfies/` (ignored by git except `.gitkeep`).

### Neon provisioning (optional)

With `NEON_KEY` (or `NEON_API_KEY`) in `.env`, run `node scripts/provision-neon.mjs` to create a project and write `DATABASE_URL`. If you belong to multiple Neon orgs, set `NEON_ORG_ID` first. **Rotate the API key** if it may have been exposed.

### Public URL in QR codes

If the app is behind a proxy or you need a fixed origin in links, set `NEXT_PUBLIC_APP_URL` (e.g. `https://your-domain.com`). Otherwise the dashboard uses the browser’s current origin when drawing the QR.

## Deploy (Vercel + Neon)

1. Create a **Neon** (or other) Postgres database and set `DATABASE_URL` on Vercel.
2. Set `AUTH_SECRET` (e.g. `openssl rand -base64 32`), `ADMIN_EMAIL`, and `ADMIN_PASSWORD` or `ADMIN_PASSWORD_HASH`.
3. Set `BLOB_READ_WRITE_TOKEN` for selfie uploads.
4. Run migrations against production: `npx prisma migrate deploy` (CI or one-off with production `DATABASE_URL`).
5. Set `NEXT_PUBLIC_APP_URL` to your production URL so QR codes point to the live kiosk.

## Scripts

| Script            | Purpose                    |
|-------------------|----------------------------|
| `npm run dev`     | Development server         |
| `npm run build`   | `prisma migrate deploy` + `prisma generate` + build |
| `npm run db:deploy` | `prisma migrate deploy` |
| `npm run db:migrate` | `prisma migrate dev`    |
| `npm run db:push` | `prisma db push` (prototyping) |

## Stack

Next.js (App Router), Prisma, PostgreSQL, Auth.js (NextAuth v5) credentials for admin, `qrcode` for QR rendering, optional Vercel Blob for images.
