/**
 * All For Ummah CMS
 *
 * SonicJS headless CMS on Cloudflare Workers (D1 + R2).
 */

import { createSonicJSApp, registerCollections } from '@sonicjs-cms/core'
import type { SonicJSConfig } from '@sonicjs-cms/core'

import blogPostsCollection from './collections/blog-posts.collection'

registerCollections([
  blogPostsCollection,
])

const config: SonicJSConfig = {
  plugins: {
    register: [],
  },
  auth: {
    // Block Better Auth public sign-up; users are created by admins only
    extendBetterAuth: (opts) => ({
      ...opts,
      emailAndPassword: {
        ...opts.emailAndPassword,
        disableSignUp: true,
      },
    }),
  },
}

export default createSonicJSApp(config)
