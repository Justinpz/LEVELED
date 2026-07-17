import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts, radius } from '../theme';
import { xpForLevel } from '../xp';

// XP progress toward the next level for one body part — energy bar with a
// bright leading-edge tip, like a charging power gauge.
export default function XPBar({ label, level, lifetimeXp, nextLevelXp, color }) {
  // Fill within the current level band, using the real curved thresholds
  // (30k/45k/60k/90k per level depending on band).
  const prevLevelXp = xpForLevel(level);
  const span = nextLevelXp ? Math.max(1, nextLevelXp - prevLevelXp) : 1;
  const pct = nextLevelXp ? Math.min(1, Math.max(0, (lifetimeXp - prevLevelXp) / span)) : 1;
  const barColor = color || colors.xp;
  return (
    <View style={styles.row}>
      <View style={styles.header}>
        <Text style={[styles.label, { color: color || colors.text }]}>{label}</Text>
        <Text style={styles.level}>Lv {level}</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: barColor, shadowColor: barColor }]}>
          {pct > 0.02 ? <View style={styles.tip} /> : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { marginBottom: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  label: { fontFamily: fonts.body, fontSize: 15, fontWeight: '700', letterSpacing: 0.5 },
  level: { fontFamily: fonts.body, fontSize: 13, color: colors.textDim },
  track: {
    height: 12,
    backgroundColor: colors.ink,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
    shadowOpacity: 0.8,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  tip: {
    position: 'absolute', right: 0, top: 0, bottom: 0, width: 4,
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
});
