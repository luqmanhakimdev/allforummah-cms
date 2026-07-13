/**
 * Blog Posts Collection
 *
 * Blog posts with featured image and gallery media (R2 via MEDIA_BUCKET).
 */

import type { CollectionConfig } from '@sonicjs-cms/core';

export default {
  name: 'blog_post',
  displayName: 'Blog Post',
  slug: 'blog-posts',
  description: 'Manage your blog posts',
  icon: '📝',

  schema: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        title: 'Title',
        required: true,
        maxLength: 200,
      },
      slug: {
        type: 'slug',
        title: 'URL Slug',
        required: true,
        maxLength: 200,
      },
      excerpt: {
        type: 'textarea',
        title: 'Excerpt',
        maxLength: 300,
        helpText: 'Short summary used in listings and SEO meta tags',
      },
      content: {
        type: 'lexical',
        title: 'Content',
        required: true,
      },
      featuredImage: {
        type: 'media',
        title: 'Featured Image',
        helpText: 'Main image shown in listings and at the top of the post',
      },
      gallery: {
        type: 'array',
        title: 'Gallery',
        helpText: 'Additional images for the post',
        items: {
          type: 'media',
        },
      },
      author: {
        type: 'user',
        title: 'Author',
        required: true,
      },
      publishedAt: {
        type: 'datetime',
        title: 'Published Date',
      },
    },
    required: ['title', 'slug', 'content', 'author'],
  },

  // List view configuration
  listFields: ['title', 'author', 'status', 'publishedAt'],
  searchFields: ['title', 'excerpt', 'content', 'author'],
  defaultSort: 'createdAt',
  defaultSortOrder: 'desc',

  // Mark as config-managed (code-based) collection
  managed: true,
  isActive: true,

  // Opt in to public read access. Without this, only authenticated users
  // (admin/editor) can read content via the API. See docs/authentication.md.
  access: {
    public: ['read'],
  },

  // Per-collection cache override. TTL in seconds; falls back to the cache plugin
  // default (CACHE_CONFIGS.api.ttl, currently 300s) if unset.
  cache: {
    enabled: true,
    ttl: 5,
  },
} satisfies CollectionConfig;
