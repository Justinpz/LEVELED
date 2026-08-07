// LEVELED neutral theme — the clean-premium system (reference-app language):
// pure black ground, soft rounded graphite cards, white/gray Inter type, blue
// primary CTA, difficulty accents. The game lives in the art (beast, mobs),
// not in neon chrome.

export const colors = {
  bg: '#000000',
  bgPanel: '#15171B', // card surface
  bgPanelAlt: '#23262C', // nested surfaces: inputs, chips, tiles
  border: 'rgba(255,255,255,0.08)',
  text: '#FFFFFF',
  textDim: '#9AA0A8',
  ink: '#000000', // text on bright fills
  accent: '#3D6DFF', // primary CTA blue
  accentAlt: '#6E9BFF', // lighter blue for secondary emphasis
  danger: '#FF5A5A',
  success: '#35D07F',
  xp: '#3D6DFF',
  // Body-part accents (balance hex, tags)
  Arms: '#ff7a45',
  Legs: '#3ddc84',
  Chest: '#ffc93c',
  Back: '#4f8dff',
  Core: '#c964ff',
  Shoulders: '#ff5fa2',
};

// Difficulty accents, reference-style: green / yellow / purple.
export const levels = {
  beginner: '#35D07F',
  intermediate: '#D6E34D',
  advanced: '#B06CFF',
};

// Card fills are opaque now — screens sit on flat black, art lives in cards.
export const glass = {
  panel: '#15171B',
  panelStrong: '#1A1D22',
  deep: '#0C0D10',
  scrim: (a) => `rgba(0,0,0,${a})`,
};

// Legacy gear-tier colors (history rows may still reference them).
export const tierColors = {
  iron: '#ff8a3d',
  mythic: '#ff4d6d',
  celestial: '#41c7ff',
  abyssal: '#a44dff',
  ascendant: '#ffe27a',
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };

export const radius = { sm: 12, md: 18, lg: 26 };

// Loaded in App.js via expo-font (@expo-google-fonts/inter).
export const fonts = {
  body: 'Inter_400Regular',
  bodyBold: 'Inter_700Bold',
  heading: 'Inter_700Bold',
};

export const bodyParts = ['Arms', 'Legs', 'Chest', 'Back', 'Core', 'Shoulders'];
