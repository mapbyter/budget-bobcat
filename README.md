# Budget Bobcat

Self-hosted envelope budgeting app (SvelteKit + external PostgreSQL), run with Docker Compose. Installable as a PWA on phones and desktops.

## Features
Envelope budgeting by month with rollover, a Left to assign counter, nested category groups, savings goals,
direct deposits into categories, recurring expenses/deposits/income (auto-post or confirm first), reports, export.

## Run
1. Create an empty Postgres database and a user that can create tables.
2. `cp .env.example .env` and fill in `DATABASE_URL`, `SESSION_SECRET` (`openssl rand -hex 32`) and `ORIGIN`.
3. `docker compose -f docker-compose.build.yml up -d --build` (builds from source; to run a published image instead, see below)
4. Put it behind an HTTPS reverse proxy (required for install and offline support) and open `ORIGIN`.
5. Create the first account at `/register`. Later sign-ups need `ALLOW_REGISTRATION=true`.

Migrations run automatically on every start. Recurring items are processed by an in-app scheduler (hourly, plus on open and after downtime).

### Behind a reverse proxy
Set `ADDRESS_HEADER=X-Forwarded-For` (and `XFF_DEPTH` if you chain proxies) so login rate limiting sees real client addresses. `ORIGIN` must exactly match the public URL.

### Install on your phone
Open the site in Safari (iOS: Share > Add to Home Screen) or Chrome (Android: Install app). Data needs a connection; offline you'll see a friendly message.

### Backups
Back up the Postgres database. Settings > Export also downloads everything as JSON, or transactions as CSV.

## Develop
`npm install`, set `DATABASE_URL`, `SESSION_SECRET`, `ORIGIN=http://localhost:5173`, then `npm run migrate && npm run dev`.
`npm run check` type-checks.

## Tests
- `npm test`: unit tests for the budget math (rollover, savings, nested rollups, deposits vs Left to assign), recurrence dates (month-ends, leap years), money parsing, CSV safety and rate limiting. No database needed.
- `npm run test:db`: runs the real migrations and exercises the recurring engine (catch-up, duplicate prevention, confirm-first, end dates) on a real Postgres, then starts the built app and walks through sign-up, budgeting, deposits, savings, recurring items, reports and export over HTTP.
  It needs a Postgres: either `TEST_DATABASE_URL=postgres://user:pw@host:5432/postgres` (an admin login; it creates and drops `budget_test_it` and `budget_test_e2e`), or `npm install --no-save embedded-postgres` for a throwaway local one. Run `npm run build` first, or let the test build it.

## Publish and deploy as an image
**Publish (once, by the maintainer).** Push this repo to GitHub. The workflow in `.github/workflows/docker-publish.yml` runs the type check and unit tests, then builds a multi-architecture image (Intel/AMD and ARM, including Raspberry Pi and Apple Silicon servers) and pushes it to `ghcr.io/<your-username>/<repository-name>` (name the repository `budget-bobcat`).
`latest` follows the `main` branch; push a tag such as `v1.0.0` to also publish `1.0.0` and `1.0`.
After the first run, open the package on GitHub (Packages > your repository name > Package settings) and set visibility to **Public** so anyone can pull it.
Edit the `image:` line in `docker-compose.yml` to your image name.

**Deploy (anyone).** Download only `docker-compose.yml`, set `DATABASE_URL`, `SESSION_SECRET` and `ORIGIN` (in the file, or in a `.env` beside it), then `docker compose up -d`. Update later with `docker compose pull && docker compose up -d`; migrations run automatically.
The container exits with a clear message if `SESSION_SECRET` is shorter than 32 characters or `ORIGIN` is missing.

Prefer Docker Hub? Replace the `images:` and login step in the workflow with your Docker Hub name and credentials, or build by hand:
`docker buildx build --platform linux/amd64,linux/arm64 -t youruser/budget-bobcat:1.0.0 -t youruser/budget-bobcat:latest --push .`
