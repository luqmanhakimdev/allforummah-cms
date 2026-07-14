import { getPlatformProxy } from 'wrangler'

/**
 * Set/reset an admin password in BOTH places SonicJS uses:
 * - auth_user.password_hash  (profile "change password" UI)
 * - auth_account.password    (Better Auth login)
 *
 * Required env:
 *   ADMIN_EMAIL
 *   ADMIN_PASSWORD  (min 8 characters)
 *
 * Examples:
 *   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='…' npm run set-password
 *   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='…' npm run set-password:prod
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
    console.error('❌ Set ADMIN_EMAIL before updating the password.')
    process.exit(1)
  }

  if (!password) {
    console.error('❌ Set ADMIN_PASSWORD before updating the password.')
    process.exit(1)
  }

  if (password.length < 8) {
    console.error('❌ ADMIN_PASSWORD must be at least 8 characters.')
    process.exit(1)
  }

  return { email, password }
}

async function main() {
  const { email, password } = requireAdminCredentials()
  const useProduction = process.argv.includes('--remote') || process.env.SEED_ENV === 'production'
  const { env, dispose } = await getPlatformProxy({
    environment: useProduction ? 'production' : undefined,
    remoteBindings: useProduction,
  })

  if (!env?.DB) {
    console.error('❌ DB binding not found.')
    process.exit(1)
  }

  console.log(useProduction ? '→ Updating production password…' : '→ Updating local password…')

  try {
    const user = await env.DB.prepare(
      'SELECT id FROM auth_user WHERE email = ? AND is_active = 1'
    ).bind(email).first()

    if (!user) {
      console.error(`❌ No active user found for ${email}`)
      process.exit(1)
    }

    const passwordHash = await hashPassword(password)
    const nowMs = Date.now()

    const existingCred = await env.DB.prepare(
      "SELECT id FROM auth_account WHERE user_id = ? AND provider_id = 'credential'"
    ).bind(user.id).first()

    const stmts = [
      env.DB.prepare(
        'UPDATE auth_user SET password_hash = ?, updated_at = ? WHERE id = ?'
      ).bind(passwordHash, nowMs, user.id),
    ]

    if (existingCred) {
      stmts.push(
        env.DB.prepare(
          'UPDATE auth_account SET password = ?, updated_at = ? WHERE id = ?'
        ).bind(passwordHash, nowMs, existingCred.id)
      )
    } else {
      // Self-registration via /auth/register/form used to skip this row — create it now
      stmts.push(
        env.DB.prepare(
          `INSERT INTO auth_account (id, user_id, account_id, provider_id, password, created_at, updated_at)
           VALUES (?, ?, ?, 'credential', ?, ?, ?)`
        ).bind(`cred-${user.id}`, user.id, user.id, passwordHash, nowMs, nowMs)
      )
    }

    await env.DB.batch(stmts)

    console.log(`✓ Password updated for ${email}`)
    console.log(
      existingCred
        ? '  Updated auth_user.password_hash and auth_account.password'
        : '  Updated auth_user.password_hash and created missing auth_account credential'
    )
  } catch (error) {
    console.error('❌ Failed to update password:', error)
    await dispose()
    process.exit(1)
  }

  await dispose()
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Password update failed:', error)
    process.exit(1)
  })
