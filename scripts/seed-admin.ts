import { bootstrapDocumentTypes, RbacService } from '@sonicjs-cms/core'
import { getPlatformProxy } from 'wrangler'

/**
 * Seed script to create initial admin user
 *
 * Admin credentials:
 * Email: admin@allforummah.com
 * Password: [as entered during setup]
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

async function seed() {
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
    // Check if admin user already exists
    const existing = await env.DB.prepare('SELECT id FROM auth_user WHERE email = ?').bind('admin@allforummah.com').first()
    if (existing) {
      console.log('✓ Admin user already exists')
      await dispose()
      return
    }

    const passwordHash = await hashPassword('ChangeMe123!')
    const nowMs = Date.now()
    const odid = `admin-${nowMs}-${Math.random().toString(36).substr(2, 9)}`

    await env.DB.batch([
      env.DB.prepare(
        'INSERT INTO auth_user (id, email, first_name, last_name, role, is_active, created_at, updated_at, name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).bind(odid, 'admin@allforummah.com', 'Admin', 'User', 'admin', 1, nowMs, nowMs, 'Admin User'),
      env.DB.prepare(
        'INSERT INTO auth_account (id, user_id, account_id, provider_id, password, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).bind(crypto.randomUUID(), odid, odid, 'credential', passwordHash, nowMs, nowMs),
    ])

    await bootstrapDocumentTypes(env.DB)
    const rbac = new RbacService(env.DB)
    await rbac.ensureSystemRbacSeed()
    await rbac.addUserRoleByName(odid, 'admin')

    console.log('✓ Admin user created successfully')
    console.log(`  Email: admin@allforummah.com`)
    console.log(`  Role: admin`)
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
