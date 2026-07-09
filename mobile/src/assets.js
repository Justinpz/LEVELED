// Central art resolver. Maps game entities -> bundled 8-bit images.
//
// Art is generated via Higgsfield and bundled under mobile/assets/. Until a file
// exists, these resolvers return null and screens fall back to placeholders, so
// the app runs before the full art library lands. When assets are added, wire the
// require() calls here (static requires are required by the Metro bundler).

import { GEAR_ITEMS } from './gearItemImages';

// Warrior avatar progression by tier (1 = Iron/novice … 5 = Ascendant/god-tier).
const AVATARS = {
  1: require('../assets/avatar/t1_iron.png'),
  2: require('../assets/avatar/t2_mythic.png'),
  3: require('../assets/avatar/t3_celestial.png'),
  4: require('../assets/avatar/t4_abyssal.png'),
  5: require('../assets/avatar/t5_ascendant.png'),
};
// Gear icons keyed by `${tier}_${slot}` — one icon per tier×slot covers all 124
// catalog items with tier-and-slot-appropriate art.
const GEAR = {
  iron_arms: require('../assets/gear/iron_arms.png'),
  iron_legs: require('../assets/gear/iron_legs.png'),
  iron_chest: require('../assets/gear/iron_chest.png'),
  iron_back: require('../assets/gear/iron_back.png'),
  iron_core: require('../assets/gear/iron_core.png'),
  mythic_arms: require('../assets/gear/mythic_arms.png'),
  mythic_legs: require('../assets/gear/mythic_legs.png'),
  mythic_chest: require('../assets/gear/mythic_chest.png'),
  mythic_back: require('../assets/gear/mythic_back.png'),
  mythic_core: require('../assets/gear/mythic_core.png'),
  celestial_arms: require('../assets/gear/celestial_arms.png'),
  celestial_legs: require('../assets/gear/celestial_legs.png'),
  celestial_chest: require('../assets/gear/celestial_chest.png'),
  celestial_back: require('../assets/gear/celestial_back.png'),
  celestial_core: require('../assets/gear/celestial_core.png'),
  abyssal_arms: require('../assets/gear/abyssal_arms.png'),
  abyssal_legs: require('../assets/gear/abyssal_legs.png'),
  abyssal_chest: require('../assets/gear/abyssal_chest.png'),
  abyssal_back: require('../assets/gear/abyssal_back.png'),
  abyssal_core: require('../assets/gear/abyssal_core.png'),
  ascendant_arms: require('../assets/gear/ascendant_arms.png'),
  ascendant_legs: require('../assets/gear/ascendant_legs.png'),
  ascendant_chest: require('../assets/gear/ascendant_chest.png'),
  ascendant_back: require('../assets/gear/ascendant_back.png'),
  ascendant_core: require('../assets/gear/ascendant_core.png'),
};
// Moment / effect art (level-up ritual, onboarding splash, streak, quest seal).
const UI = {
  levelUp: require('../assets/moments/level_up.png'),
  onboarding: require('../assets/moments/onboarding.png'),
  streak: require('../assets/moments/streak.png'),
  questSeal: require('../assets/moments/quest_seal.png'),
};

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

// Gear art: dedicated per-item image first (113 unique pieces), then the
// generic tier+slot icon, then null -> tier-colored placeholder.
export function gearImage(tier, slot, itemId) {
  if (itemId && GEAR_ITEMS[itemId]) return GEAR_ITEMS[itemId];
  return GEAR[`${tier}_${slot}`] || null;
}

export function uiImage(key) {
  return UI[key] || null;
}
