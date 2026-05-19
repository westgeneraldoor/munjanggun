// src/lib/constants.ts
export const RESERVED_SLUGS = ['admin', 'preview', 'api', '_next'] as const;
export const MAX_NODE_DEPTH = 4;

export const IMAGE_COMPRESSION = {
  NODE_IMAGE: { maxWidth: 1600, quality: 80 },
  GALLERY_PHOTO: { maxWidth: 1000, quality: 70 },
} as const;

export const PREVIEW_TOKEN_EXPIRY_HOURS = 72;

export const EMPTY_STATE_TITLE = '현재 준비 중입니다.';
export const EMPTY_STATE_SUBTITLE = '곧 만나보세요!';
export const GALLERY_SECTION_TITLE = '갤러리';
