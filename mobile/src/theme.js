// LEVELED 8-bit dark-fantasy theme. Single source of truth for colors/spacing.
// Per-body-part accent colors match the five progression tracks.

export const colors = {
  bg: '#0e0a14',
  bgPanel: '#1a1420',
  bgPanelAlt: '#241a30',
  border: '#3a2b4d',
  text: '#ece4f5',
  textDim: '#9a8bad',
  accent: '#c9a227', // iron/gold
  danger: '#c0392b',
  success: '#4caf50',
  xp: '#7c4dff',
  // Body-part accents
  Arms: '#e07a5f',
  Legs: '#81b29a',
  Chest: '#e6b800',
  Back: '#5b8def',
  Core: '#c05fe0',
};

// Gear tier colors (master doc Part 5).
export const tierColors = {
  iron: '#9aa0a6',
  mythic: '#8e6bd8',
  celestial: '#4fc3f7',
  abyssal: '#e0533d',
  ascendant: '#f4c542',
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };

export const radius = { sm: 4, md: 8, lg: 12 };

// Monospace stands in for a pixel font until a bitmap font asset is bundled.
export const fonts = {
  body: 'monospace',
  heading: 'monospace',
};

export const bodyParts = ['Arms', 'Legs', 'Chest', 'Back', 'Core'];
