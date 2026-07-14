import { RbacService, bootstrapDocumentTypes } from '@sonicjs-cms/core'
import { getPlatformProxy } from 'wrangler'

/**
 * Promote a user so they can access /admin (requires portal:access).
 *
 * Self-registered users were previously given legacy role "viewer", which is
 * not a real RBAC role — so login succeeds but /admin redirects with
 * "You do not have permission to access this area".
 *
 * Required env:
 *   ADMIN_EMAIL  (target user email)
 *   ROLE         optional — admin | editor (default: editor)
 *
 * Examples:
 *   ADMIN_EMAIL=user@example.com npm run promote-user
 *   ADMIN_EMAIL=user@example.com ROLE=admin npm run promote-user:prod
 */

function requireEmail() {
  const email = process.env.ADMIN_EMAIL?.trim()
  if (!email) {
    console.error('❌ Set ADMIN_EMAIL to the user you want to promote.')
    process.exit(1)
  }
  return email
}

function requireRole() {
  const role = (process.env.ROLE || 'editor').trim().toLowerCase()
  if (role !== 'admin' && role !== 'editor') {
    console.error('❌ ROLE must be "admin" or "editor".')
    process.exit(1)
  }
  return role
}

async function main() {
  const email = requireEmail()
  const role = requireRole()
  const useProduction = process.argv.includes('--remote') || process.env.SEED_ENV === 'production'
  const { env, dispose } = await getPlatformProxy({
    environment: useProduction ? 'production' : undefined,
    remoteBindings: useProduction,
  })

  if (!env?.DB) {
    console.error('❌ DB binding not found.')
    process.exit(1)
  }

  console.log(useProduction ? '→ Promoting user on production…' : '→ Promoting user locally…')

  try {
    const user = await env.DB.prepare(
      'SELECT id, email, role FROM auth_user WHERE email = ? AND is_active = 1'
    ).bind(email).first()

    if (!user) {
      console.error(`❌ No active user found for ${email}`)
      process.exit(1)
    }

    await bootstrapDocumentTypes(env.DB)
    const rbac = new RbacService(env.DB)
    await rbac.ensureSystemRbacSeed()
    await rbac.addUserRoleByName(user.id, role)

    await env.DB.prepare(
      'UPDATE auth_user SET role = ?, updated_at = ? WHERE id = ?'
    ).bind(role, Date.now(), user.id).run()

    console.log(`✓ Promoted ${email} to ${role}`)
    console.log('  They can now access /admin after logging in again.')
  } catch (error) {
    console.error('❌ Failed to promote user:', error)
    await dispose()
    process.exit(1)
  }

  await dispose()
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Promote failed:', error)
    process.exit(1)
  })
