import { bootstrapDocumentTypes, RbacService } from '@sonicjs-cms/core'
import { getPlatformProxy } from 'wrangler'

/**
 * Seed script to create initial admin user.
 *
 * Required env:
 *   ADMIN_EMAIL
 *   ADMIN_PASSWORD  (min 8 characters)
 *
 * Examples:
 *   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='…' npm run seed
 *   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='…' npm run seed:prod
 */

async function hashPassword(password) {
  const iterations = 100000
  const salt = new Uint8Array(16)
  crypto.getRandomValues(salt)
  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits'])
  const hashBuffer = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, keyMaterial, 256)
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('')
  const hashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')
  return `pbkdf2:${iterations}:${saltHex}:${hashHex}`
}

function requireAdminCredentials() {
  const email = process.env.ADMIN_EMAIL?.trim()
  const password = process.env.ADMIN_PASSWORD

  if (!email) {
    console.error('❌ Set ADMIN_EMAIL before seeding.')
    process.exit(1)
  }

  if (!password) {
    console.error('❌ Set ADMIN_PASSWORD before seeding.')
    process.exit(1)
  }

  if (password.length < 8) {
    console.error('❌ ADMIN_PASSWORD must be at least 8 characters.')
    process.exit(1)
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    console.error('❌ ADMIN_EMAIL must be a valid email address.')
    process.exit(1)
  }

  return { email, password }
}

async function seed() {
  const { email, password } = requireAdminCredentials()
  const useProduction = process.argv.includes('--remote') || process.env.SEED_ENV === 'production'
  const { env, dispose } = await getPlatformProxy({
    environment: useProduction ? 'production' : undefined,
    remoteBindings: useProduction,
  })

  if (!env?.DB) {
    console.error(
      useProduction
        ? '❌ Error: DB binding not found. Check wrangler.toml production D1 config and auth (`npx wrangler login`).'
        : '❌ Error: DB binding not found. Run migrations first: npm run db:migrate:local'
    )
    process.exit(1)
  }

  console.log(useProduction ? '→ Seeding production D1…' : '→ Seeding local D1…')

  try {
    const existing = await env.DB.prepare('SELECT id FROM auth_user WHERE email = ?').bind(email).first()
    if (existing) {
      console.log(`✓ Admin user already exists for ${email}`)
      await dispose()
      return
    }

    const passwordHash = await hashPassword(password)
    const nowMs = Date.now()
    const odid = `admin-${nowMs}-${Math.random().toString(36).substr(2, 9)}`

    await env.DB.batch([
      env.DB.prepare(
        'INSERT INTO auth_user (id, email, first_name, last_name, role, is_active, created_at, updated_at, name, password_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).bind(odid, email, 'Admin', 'User', 'admin', 1, nowMs, nowMs, 'Admin User', passwordHash),
      env.DB.prepare(
        'INSERT INTO auth_account (id, user_id, account_id, provider_id, password, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).bind(crypto.randomUUID(), odid, odid, 'credential', passwordHash, nowMs, nowMs),
    ])

    await bootstrapDocumentTypes(env.DB)
    const rbac = new RbacService(env.DB)
    await rbac.ensureSystemRbacSeed()
    await rbac.addUserRoleByName(odid, 'admin')

    console.log('✓ Admin user created successfully')
    console.log(`  Email: ${email}`)
    console.log('  Role: admin')
  } catch (error) {
    console.error('❌ Error creating admin user:', error)
    await dispose()
    process.exit(1)
  }

  await dispose()
}

seed()
  .then(() => {
    console.log('✓ Seeding complete')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Seeding failed:', error)
    process.exit(1)
  })
