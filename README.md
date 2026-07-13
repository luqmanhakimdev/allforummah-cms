# allforummah-cms

CMS for the All For Ummah website, built with [SonicJS](https://sonicjs.com) on Cloudflare Workers (D1 + R2).

**Production URL:** https://allforummah-cms.roy-desg.workers.dev  
**Login:** https://allforummah-cms.roy-desg.workers.dev/auth/login

## Prerequisites

- Node.js 20+ (see `.nvmrc`)
- A Cloudflare account
- Wrangler authenticated locally (`npx wrangler login`) for one-time setup

## Local development

```bash
npm install
npm run db:migrate:local
npm run seed
npm run dev
```

Then open:

- Login: http://localhost:8787/auth/login
- Admin: http://localhost:8787/admin (after login)
- Health: http://localhost:8787/health

### Default admin

| Field    | Value                   |
|----------|-------------------------|
| Email    | `admin@allforummah.com` |
| Password | `ChangeMe123!`          |

Same credentials are seeded in production via `npm run seed:prod`. Change the password after first login.

## Production status

Already provisioned on Cloudflare:

| Resource | Name / value |
|----------|----------------|
| Worker | `allforummah-cms` (`--env production`) |
| D1 | `allforummah-cms-db` |
| R2 | `allforummah-cms-media` |
| Secrets | `BETTER_AUTH_SECRET`, `JWT_SECRET` |
| URL | https://allforummah-cms.roy-desg.workers.dev |

Local data: `.wrangler/` (gitignored). Production data: Cloudflare D1 + R2.

### Manual deploy

```bash
npm run db:migrate
npm run deploy
```

Rotate secrets if needed:

```bash
openssl rand -hex 32 | npx wrangler secret put BETTER_AUTH_SECRET --env production
openssl rand -hex 32 | npx wrangler secret put JWT_SECRET --env production
```

## GitHub Actions deploy

Workflows:

- [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) — migrate + deploy on push to `main` / manual dispatch
- [`.github/workflows/ci.yml`](.github/workflows/ci.yml) — typecheck on PRs and `main`

### 1. Create a Cloudflare API token

Dashboard → **My Profile** → **API Tokens** → **Create Token** → customize **Edit Cloudflare Workers** with:

- Account → Workers Scripts → Edit  
- Account → Workers R2 Storage → Edit  
- Account → D1 → Edit  
- Account → Account Settings → Read  

### 2. GitHub Environment `production`

Repo → **Settings** → **Environments** → create `production`:

| Type | Name | Value |
|------|------|--------|
| Secret | `CLOUDFLARE_API_TOKEN` | Token from step 1 |
| Secret | `CLOUDFLARE_ACCOUNT_ID` | `3f9e5456f446737d1fcd0178ddd6257c` |
| Variable | `WORKER_URL` | `https://allforummah-cms.roy-desg.workers.dev` |

### 3. Ship

Push (or merge) to `main`, or run **Actions → Deploy Worker → Run workflow**.

## Project structure

```
.github/workflows/     # CI + deploy
src/
├── collections/       # Content types
├── plugins/example/   # Demo plugin (not registered)
└── index.ts
wrangler.toml          # Workers / D1 / R2 / production
scripts/seed-admin.ts  # Admin bootstrap (local + --remote)
```

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Local server |
| `npm run deploy` | Deploy production |
| `npm run db:migrate:local` | Local D1 migrations |
| `npm run db:migrate` | Remote D1 migrations |
| `npm run seed` | Seed local admin |
| `npm run seed:prod` | Seed production admin |
| `npm run type-check` | TypeScript check |

## Docs

- [SonicJS](https://sonicjs.com)
- [Workers + GitHub Actions](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/)
