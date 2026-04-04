<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

### Overview

Single Next.js 16 app (App Router) with Prisma ORM, PostgreSQL, and Auth.js. No monorepo. See `README.md` for full local setup and scripts.

### Services

| Service | How to start | Notes |
|---------|-------------|-------|
| PostgreSQL | `docker compose up -d` | Requires Docker daemon running (see below). Maps host port **5433** → container 5432. |
| Next.js dev server | `npm run dev` | Runs on port 3000. Hot-reloads on file changes. |

### Docker in Cloud Agent VM

The Cloud Agent VM runs inside a container, so Docker requires special setup on first use:

1. Start the Docker daemon: `sudo dockerd &>/tmp/dockerd.log &`
2. Wait a few seconds, then verify: `docker info`
3. If permission denied on the socket: `sudo chmod 666 /var/run/docker.sock`

Docker, fuse-overlayfs, and iptables-legacy are already installed and configured.

### Database

- The environment has injected secrets including `DATABASE_URL` pointing to a Neon cloud PostgreSQL instance. The `.env` file is also present with local Docker Postgres config, but the **environment variable takes precedence**.
- Run `npx prisma migrate deploy` to apply migrations, then `node scripts/seed-v2.mjs` to create demo data.
- Seed creates: Master Admin (`master@waqt.local`), Company Admin (`admin@demo.local` / `Admin123!`), Employee (`employee@demo.local` / `Employee123!`), Demo Restaurant with Main Branch.

### Key commands

| Task | Command |
|------|---------|
| Install deps | `npm install` (runs `prisma generate` via postinstall) |
| Dev server | `npm run dev` |
| Lint | `npm run lint` |
| Build | `npm run build` |
| Migrations | `npx prisma migrate deploy` |
| Seed | `node scripts/seed-v2.mjs` |

### Auth

- Master Admin login uses `ADMIN_EMAIL` / `ADMIN_PASSWORD` env vars (env-based, no DB user needed).
- Company Admin and Employee accounts are DB-backed; the seed script creates demo accounts.
- Master Admin dashboard shows Companies / Branches / QR page tabs.
- Company Admin dashboard shows Employees / Attendance / Hours / Check-in QR / Shifts tabs.
