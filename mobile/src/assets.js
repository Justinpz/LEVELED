// Central art resolver. Maps game entities -> bundled 8-bit images.
//
// Art is generated via Higgsfield and bundled under mobile/assets/. Until a file
// exists, these resolvers return null and screens fall back to placeholders, so
// the app runs before the full art library lands. When assets are added, wire the
// require() calls here (static requires are required by the Metro bundler).

// Example once assets exist:
//   const AVATARS = { 1: require('../assets/avatar/warrior_t1.png'), ... };
const AVATARS = {};
const GEAR = {};
const UI = {};

// Avatar image for an overall level (tiers of ~20 levels each).
export function avatarForLevel(level) {
  const tier = Math.min(5, Math.max(1, Math.ceil(level / 20)));
  return AVATARS[tier] || null;
}

// Gear item art by item_id (falls back to null -> tier-colored placeholder).
export function gearImage(itemId) {
  return GEAR[itemId] || null;
}

export function uiImage(key) {
  return UI[key] || null;
}
