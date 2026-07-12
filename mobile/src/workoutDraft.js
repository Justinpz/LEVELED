// In-progress workout draft — survives tab kills, phone locks, and app
// switches during long gym sessions.
//
// Mobile browsers aggressively evict background tabs; without this, an hour of
// entered sets would vanish if the tab reloaded before "Complete Workout".
// Every change to the in-progress workout is written to localStorage (web);
// the Workout screen restores it on load and clears it on successful submit.
// Drafts expire after 18 hours (a stale draft from last week shouldn't
// resurrect mid-session).

import { Platform } from 'react-native';

const KEY = 'leveled_workout_draft_v1';
const MAX_AGE_MS = 18 * 60 * 60 * 1000;

const canStore =
  Platform.OS === 'web' && typeof window !== 'undefined' && !!window.localStorage;

export function saveDraft(picked, dayNumber) {
  if (!canStore) return;
  try {
    if (!picked || picked.length === 0) {
      window.localStorage.removeItem(KEY);
      return;
    }
    window.localStorage.setItem(KEY, JSON.stringify({ picked, dayNumber, ts: Date.now() }));
  } catch {
    // storage full/blocked — non-fatal
  }
}

export function loadDraft() {
  if (!canStore) return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw);
    if (!draft.ts || Date.now() - draft.ts > MAX_AGE_MS) {
      window.localStorage.removeItem(KEY);
      return null;
    }
    if (!Array.isArray(draft.picked) || draft.picked.length === 0) return null;
    return draft;
  } catch {
    return null;
  }
}

export function clearDraft() {
  if (!canStore) return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
