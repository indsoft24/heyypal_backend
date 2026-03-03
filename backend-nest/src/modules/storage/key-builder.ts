/**
 * Deterministic file keys. No full URLs in DB.
 */

export function buildUserProfilePhotoKey(userId: number, index: 1 | 2): string {
  return `profile/user/${userId}/photo${index}.jpg`;
}

export function buildExpertProfilePhotoKey(userId: number, index: 1 | 2): string {
  return `profile/expert/${userId}/photo${index}.jpg`;
}

export function buildExpertVideoKey(userId: number): string {
  return `expert/${userId}/intro.mp4`;
}

export function buildExpertThumbKey(userId: number): string {
  return `expert/${userId}/intro-thumb.jpg`;
}

/** Allowed key prefixes for GET /media/:key (prevent directory traversal). */
export const ALLOWED_KEY_PREFIXES = [
  'profile/user/',
  'profile/expert/',
  'expert/',
];

export function isAllowedKey(key: string): boolean {
  const normalized = key.replace(/\.\./g, '').trim();
  return ALLOWED_KEY_PREFIXES.some((p) => normalized.startsWith(p));
}
