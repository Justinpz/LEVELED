import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radius } from '../theme';
import { xpForLevel } from '../xp';

// XP progress toward the next level for one body part.
export default function XPBar({ label, level, lifetimeXp, nextLevelXp, color }) {
  // Fill within the current level band, using the real curved thresholds
  // (30k/45k/60k/90k per level depending on band).
  const prevLevelXp = xpForLevel(level);
  const span = nextLevelXp ? Math.max(1, nextLevelXp - prevLevelXp) : 1;
  const pct = nextLevelXp ? Math.min(1, Math.max(0, (lifetimeXp - prevLevelXp) / span)) : 1;
  return (
    <View style={styles.row}>
      <View style={styles.header}>
        <Text style={[styles.label, { color: color || colors.text }]}>{label}</Text>
        <Text style={styles.level}>Lv {level}</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: color || colors.xp }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { marginBottom: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  label: { fontFamily: 'monospace', fontSize: 14, fontWeight: '700' },
  level: { fontFamily: 'monospace', fontSize: 12, color: colors.textDim },
  track: {
    height: 12,
    backgroundColor: colors.bgPanelAlt,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  fill: { height: '100%' },
});
