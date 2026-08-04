// Daily mobs — every day one monster spawns on the Workout screen. Its HP is
// a volume target sized from your own recent sessions; every confirmed set is
// a strike. Kill it and the beast feeds.

export const MOBS = [
  { key: 'mob_01', name: 'GRAVEMAW', epithet: 'the Unbroken' },
  { key: 'mob_02', name: 'ASHFANG', epithet: 'the Prowler' },
  { key: 'mob_03', name: 'IRONHIDE', epithet: 'the Colossus' },
  { key: 'mob_04', name: 'VOIDCRAWLER', epithet: 'the Patient' },
  { key: 'mob_05', name: 'EMBERWRAITH', epithet: 'the Burning' },
  { key: 'mob_06', name: 'STONEJAW', epithet: 'the Sentinel' },
  { key: 'mob_07', name: 'THORNBACK', epithet: 'the Coiled' },
  { key: 'mob_08', name: 'GLOOMHOWL', epithet: 'the Restless' },
  { key: 'mob_09', name: 'CINDERGHOUL', epithet: 'the Hollow' },
  { key: 'mob_10', name: 'FROSTMAUL', epithet: 'the Grim' },
  { key: 'mob_11', name: 'DREADSPINE', epithet: 'the Ancient' },
  { key: 'mob_12', name: 'NIGHTREAVER', epithet: 'the Last' },
];

export const MOB_ART = {
  mob_01: require('../assets/mobs/mob_01.png'),
  mob_02: require('../assets/mobs/mob_02.png'),
  mob_03: require('../assets/mobs/mob_03.png'),
  mob_04: require('../assets/mobs/mob_04.png'),
  mob_05: require('../assets/mobs/mob_05.png'),
  mob_06: require('../assets/mobs/mob_06.png'),
  mob_07: require('../assets/mobs/mob_07.png'),
  mob_08: require('../assets/mobs/mob_08.png'),
  mob_09: require('../assets/mobs/mob_09.png'),
  mob_10: require('../assets/mobs/mob_10.png'),
  mob_11: require('../assets/mobs/mob_11.png'),
  mob_12: require('../assets/mobs/mob_12.png'),
};

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h * 31 + s.charCodeAt(i)) >>> 0);
  return h;
}

// The mob of the day — deterministic from the date so it survives reloads.
export function dailyMob(dateStr) {
  const mob = MOBS[hashStr(dateStr) % MOBS.length];
  return { ...mob, art: MOB_ART[mob.key] };
}

// One set's damage. Weighted work = weight × reps; bodyweight work (no weight
// logged) counts 50 per rep so calisthenics sessions still hurt the mob.
// mobHpFrom uses the SAME formula, so the fight stays fair either way.
export function setScore(weight, reps) {
  const w = parseFloat(weight) || 0;
  const r = parseFloat(reps) || 0;
  return w > 0 ? w * r : r * 50;
}

// HP target from the player's own history: median session volume, +5% so a
// kill means slightly beating your normal day. Sane bounds for new players.
export function mobHpFrom(sessions) {
  const volumes = (sessions || [])
    .map((s) =>
      (s.exercises || []).reduce(
        (sum, ex) => sum + (ex.sets || []).reduce((v, set) => v + setScore(set.weight, set.reps), 0),
        0
      )
    )
    .filter((v) => v > 0)
    .sort((a, b) => a - b);
  if (!volumes.length) return 5000;
  const median = volumes[Math.floor(volumes.length / 2)];
  return Math.max(2000, Math.round((median * 1.05) / 50) * 50);
}
