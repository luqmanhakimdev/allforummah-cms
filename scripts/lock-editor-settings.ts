import { RbacService, bootstrapDocumentTypes } from '@sonicjs-cms/core'
import { getPlatformProxy } from 'wrangler'

/**
 * Strip settings:* grants from the editor role so editors cannot access
 * Admin → Settings (site name, admin email, security, etc.).
 *
 * Safe to re-run. Role seed is idempotent and will not update existing
 * role-editor docs — this script patches live grants in D1.
 *
 * Examples:
 *   npm run lock-editor-settings
 *   npm run lock-editor-settings:prod
 */

async function main() {
  const useProduction = process.argv.includes('--remote') || process.env.SEED_ENV === 'production'
  const { env, dispose } = await getPlatformProxy({
    environment: useProduction ? 'production' : undefined,
    remoteBindings: useProduction,
  })

  if (!env?.DB) {
    console.error('❌ DB binding not found.')
    process.exit(1)
  }

  console.log(useProduction ? '→ Locking editor settings on production…' : '→ Locking editor settings locally…')

  try {
    await bootstrapDocumentTypes(env.DB)
    const rbac = new RbacService(env.DB)
    await rbac.ensureSystemRbacSeed()

    const roles = await rbac.getRoles()
    const editor = roles.find((r) => r.name === 'editor' || r.id === 'role-editor')
    if (!editor) {
      console.error('❌ Editor role not found.')
      process.exit(1)
    }

    const grants = (await rbac.getGrants()).filter((g) => g.role_id === editor.id)
    const kept = grants.filter((g) => g.resource !== 'settings')
    const removed = grants.length - kept.length

    if (removed === 0) {
      console.log('✓ Editor role already has no settings grants')
      await dispose()
      return
    }

    await rbac.setRoleGrants(
      editor.id,
      kept.map((g) => ({ resource: g.resource, verb: g.verb, scope: g.scope === 'own' ? 'own' : 'any' }))
    )

    console.log(`✓ Removed ${removed} settings grant(s) from editor role`)
    console.log('  Editors can no longer access Admin → Settings after redeploy + re-login.')
  } catch (error) {
    console.error('❌ Failed to lock editor settings:', error)
    await dispose()
    process.exit(1)
  }

  await dispose()
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Lock failed:', error)
    process.exit(1)
  })
