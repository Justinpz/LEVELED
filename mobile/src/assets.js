// Central art resolver. Maps game entities -> bundled 8-bit images.
//
// Art is generated via Higgsfield and bundled under mobile/assets/. Until a file
// exists, these resolvers return null and screens fall back to placeholders, so
// the app runs before the full art library lands. When assets are added, wire the
// require() calls here (static requires are required by the Metro bundler).

// Warrior avatar progression by tier (1 = Iron/novice … 5 = Ascendant/god-tier).
const AVATARS = {
  1: require('../assets/avatar/t1_iron.png'),
  2: require('../assets/avatar/t2_mythic.png'),
  3: require('../assets/avatar/t3_celestial.png'),
  4: require('../assets/avatar/t4_abyssal.png'),
  5: require('../assets/avatar/t5_ascendant.png'),
};
const GEAR = {};
const UI = {};

// Screen background plates, keyed by screen name.
const BG = {
  Home: require('../assets/bg/hub.png'),
  Workout: require('../assets/bg/workout.png'),
  Shop: require('../assets/bg/shop.png'),
  Quests: require('../assets/bg/quests.png'),
};

export function bgImage(key) {
  return BG[key] || null;
}

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
