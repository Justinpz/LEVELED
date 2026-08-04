// Central art resolver — backgrounds and moment art only.
//
// The warrior-era registries (paper-doll avatars, idle loops, 124 gear icons)
// were retired with the Feed the Beast redesign; keeping their require()s here
// would drag ~33 MB of dead art into every web export. Creature and mob art
// resolve in src/creature.js and src/mobs.js.

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
  Quests: require('../assets/bg/quests.png'),
};

export function bgImage(key) {
  return BG[key] || null;
}

export function uiImage(key) {
  return UI[key] || null;
}
