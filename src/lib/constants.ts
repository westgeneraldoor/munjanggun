// src/lib/constants.ts
export const RESERVED_SLUGS = ['admin', 'preview', 'api', '_next'] as const;
export const MAX_NODE_DEPTH = 4;

export const IMAGE_COMPRESSION = {
  NODE_IMAGE: { maxWidth: 1600, quality: 80 },
  GALLERY_PHOTO: { maxWidth: 1000, quality: 70 },
} as const;

export const PREVIEW_TOKEN_EXPIRY_HOURS = 72;
