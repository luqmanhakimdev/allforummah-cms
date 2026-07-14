# allforummah-cms

CMS for the All For Ummah website, built with [SonicJS](https://sonicjs.com) on Cloudflare Workers (D1 + R2).


## Prerequisites

- Node.js 20+ (see `.nvmrc`)
- A Cloudflare account
- Wrangler authenticated locally (`npx wrangler login`) for one-time setup

## Local development

```bash
npm install
npm run db:migrate:local
ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='your-secure-password' npm run seed
npm run dev
```

Then open:

- Login: http://localhost:8787/auth/login
- Admin: http://localhost:8787/admin (after login)
- Health: http://localhost:8787/health

### Admin bootstrap

Seeding never stores a password in the repo. Pass credentials via env:

```bash
ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='your-secure-password' npm run seed
ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='your-secure-password' npm run seed:prod
```

To change an existing user's password (updates login + profile password fields):

```bash
ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='your-new-password' npm run set-password:prod
```

Prefer `set-password:prod` over the admin UI password form — SonicJS login reads `auth_account`, while the UI only writes `auth_user.password_hash`.

If a self-registered user cannot log in (`Credential account not found`), run `set-password:prod` for their email — that upserts the missing Better Auth credential row. (`@sonicjs-cms/core@3.0.0-beta.25` form registration is patched in this repo to create it.)

If login succeeds but they see **You do not have permission to access this area**, they lack RBAC `portal:access` (legacy `viewer` is not a real admin role). Promote them:

```bash
ADMIN_EMAIL=user@example.com npm run promote-user:prod
```

New self-registrations are patched to get the `editor` role (portal access). First user remains `admin`.

## Production status

Already provisioned on Cloudflare:

| Resource | Name / value |
|----------|----------------|
| Worker | `allforummah-cms` (`--env production`) |
| D1 | `allforummah-cms-db` |
| R2 | `allforummah-cms-media` |
| Secrets | `BETTER_AUTH_SECRET`, `JWT_SECRET` |

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
| Secret | `CLOUDFLARE_ACCOUNT_ID` | `your account` |
| Variable | `WORKER_URL` | `your-domain` |

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
| `npm run set-password` | Reset local password |
| `npm run set-password:prod` | Reset production password |
| `npm run promote-user` | Grant local user editor (or ROLE=admin) portal access |
| `npm run promote-user:prod` | Same for production |
| `npm run type-check` | TypeScript check |

## Docs

- [SonicJS](https://sonicjs.com)
- [Workers + GitHub Actions](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/)
