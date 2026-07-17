// LEVELED vibrant-shonen theme. Single source of truth for colors/spacing/fonts.
// Deep ink-navy grounds, ember orange-red primary accent, electric cyan secondary,
// saturated body-part accents matching the five progression tracks.

export const colors = {
  bg: '#0b0e1a',
  bgPanel: '#131a2e',
  bgPanelAlt: '#1c2440',
  border: '#2c3a63',
  text: '#eef2ff',
  textDim: '#8f9bc0',
  ink: '#070a14', // darkest solid — image wells, text on bright fills
  accent: '#ff5a2e', // ember orange-red
  accentAlt: '#35e0ff', // electric cyan
  danger: '#ff3b5c',
  success: '#3ddc84',
  xp: '#35e0ff',
  // Body-part accents
  Arms: '#ff7a45',
  Legs: '#3ddc84',
  Chest: '#ffc93c',
  Back: '#4f8dff',
  Core: '#c964ff',
};

// Translucent fills layered over the screen background art.
export const glass = {
  panel: 'rgba(15, 21, 40, 0.72)',
  panelStrong: 'rgba(15, 21, 40, 0.92)',
  deep: 'rgba(7, 10, 20, 0.6)',
  scrim: (a) => `rgba(7,10,20,${a})`,
};

// Gear tier colors — shonen energy language: ember rookie → crimson enchanted →
// azure starlight → void-purple demonic → white-gold ascendant.
export const tierColors = {
  iron: '#ff8a3d',
  mythic: '#ff4d6d',
  celestial: '#41c7ff',
  abyssal: '#a44dff',
  ascendant: '#ffe27a',
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };

export const radius = { sm: 6, md: 10, lg: 14 };

// Loaded in App.js via expo-font (@expo-google-fonts); the family strings below
// are the registered names. Until the fonts resolve, platforms fall back safely.
export const fonts = {
  body: 'Rajdhani_600SemiBold',
  bodyBold: 'Rajdhani_700Bold',
  heading: 'Teko_600SemiBold',
};

export const bodyParts = ['Arms', 'Legs', 'Chest', 'Back', 'Core'];
