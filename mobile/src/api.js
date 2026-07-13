// Thin client for the LEVELED backend (Express API: /game /programs /challenges).
//
// URL resolution:
//  - EXPO_PUBLIC_API_URL, when set, always wins (native builds, dev servers).
//  - On WEB with no env URL, default to same-origin (relative paths): the web
//    build is served by the same Express server as the API, so relative
//    requests are correct on any host — moving hosts never needs a rebuild.
//  - On native with no env URL, fall back to the offline mock demo.
// Auth is not built yet — the backend resolves the acting user from x-user-id
// (falls back to the first user row), so we send a dev id header.

import { Platform } from 'react-native';
import { mockApi } from './mockApi';

const isWeb = Platform.OS === 'web';
// Empty string = relative/same-origin requests (the web default).
const BASE_URL = process.env.EXPO_PUBLIC_API_URL || '';
const DEV_USER_ID = process.env.EXPO_PUBLIC_USER_ID || '';
// Explicit EXPO_PUBLIC_MOCK=1, or native with no backend URL → offline demo.
const USE_MOCK =
  process.env.EXPO_PUBLIC_MOCK === '1' || (!process.env.EXPO_PUBLIC_API_URL && !isWeb);

async function request(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (DEV_USER_ID) headers['x-user-id'] = DEV_USER_ID;
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const err = new Error((data && data.error) || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

const liveApi = {
  // Progress + core loop
  getProgress: () => request('/game/progress'),
  logWorkout: (payload) => request('/game/workouts/log', { method: 'POST', body: payload }),
  getExercises: (query = '') => request(`/game/exercises${query}`),
  getLastSets: (ids) => request(`/game/workouts/last-sets?ids=${ids.join(',')}`),
  createCustomExercise: (body) => request('/game/exercises/custom', { method: 'POST', body }),
  getWorkoutHistory: (take = 15) => request(`/game/workouts/history?take=${take}`),
  updateWorkoutSession: (id, sets) => request(`/game/workouts/sessions/${id}`, { method: 'PATCH', body: { sets } }),
  // Shop / gear
  getShop: () => request('/game/shop'),
  buyGear: (id) => request(`/game/gear/${id}/buy`, { method: 'POST' }),
  equipGear: (id) => request(`/game/gear/${id}/equip`, { method: 'POST' }),
  unequipGear: (id) => request(`/game/gear/${id}/unequip`, { method: 'POST' }),
  // Programs
  getPrograms: () => request('/programs'),
  getProgram: (id) => request(`/programs/${id}`),
  getActiveProgram: () => request('/programs/active'),
  selectProgram: (id) => request(`/programs/${id}/select`, { method: 'POST' }),
  clearProgram: () => request('/programs/clear', { method: 'POST' }),
  createProgram: (program) => request('/programs', { method: 'POST', body: program }),
  aiGenerateProgram: (goals) => request('/programs/ai-generate', { method: 'POST', body: goals }),
  aiValidateWorkout: (workout) => request('/programs/ai-validate', { method: 'POST', body: workout }),
  // Challenges (special tasks)
  getDailyChallenge: () => request('/challenges/daily'),
  getWeeklyChallenge: () => request('/challenges/weekly'),
  getWarriorChallenge: () => request('/challenges/warrior'),
  completeChallenge: (id) => request(`/challenges/${id}/complete`, { method: 'POST' }),
  // Food tracker
  getFoodToday: () => request('/food/today'),
  logFood: (item) => request('/food/log', { method: 'POST', body: item }),
  deleteFood: (id) => request(`/food/${id}`, { method: 'DELETE' }),
  setFoodGoals: (goals) => request('/food/goals', { method: 'POST', body: goals }),
  getFoodCalendar: (month) => request(`/food/calendar${month ? `?month=${month}` : ''}`),
  getFoodDay: (date) => request(`/food/day/${date}`),
  // Settings
  getSettings: () => request('/game/settings'),
  putSettings: (patch) => request('/game/settings', { method: 'PUT', body: patch }),
};

export const api = USE_MOCK ? mockApi : liveApi;
export { BASE_URL, USE_MOCK };
