// Tiny reactive settings store — hydrated from the backend once, readable from
// any screen via useSettings(), updated optimistically via updateSettings().
import { useEffect, useState } from 'react';
import { api } from './api';

export const DEFAULT_SETTINGS = {
  displayName: '',
  units: 'lbs',
  barks: true,
  animations: true,
  levelUpModal: true,
  warriorShowOriginal: false,
  restTimer: false,
  restSeconds: 90,
};

let current = { ...DEFAULT_SETTINGS };
let hydrated = false;
const listeners = new Set();

function emit() {
  for (const l of listeners) l(current);
}

export async function hydrateSettings() {
  try {
    const res = await api.getSettings();
    current = { ...DEFAULT_SETTINGS, ...(res.settings || {}) };
    hydrated = true;
    emit();
  } catch {
    // offline/mock — defaults stand
    hydrated = true;
  }
  return current;
}

export function getSettings() {
  return current;
}

export async function updateSettings(patch) {
  current = { ...current, ...patch }; // optimistic
  emit();
  try {
    const res = await api.putSettings(patch);
    current = { ...DEFAULT_SETTINGS, ...(res.settings || {}) };
    emit();
  } catch {
    // keep optimistic value; next hydrate reconciles
  }
  return current;
}

export function useSettings() {
  const [value, setValue] = useState(current);
  useEffect(() => {
    listeners.add(setValue);
    if (!hydrated) hydrateSettings();
    return () => listeners.delete(setValue);
  }, []);
  return value;
}
