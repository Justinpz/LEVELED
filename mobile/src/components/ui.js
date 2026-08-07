import React, { useEffect, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native';
import { colors, fonts, radius, spacing } from '../theme';

// Soft rounded graphite card — the app's basic surface.
export function Panel({ children, style }) {
  return <View style={[styles.panel, style]}>{children}</View>;
}

// Big bold left-aligned section header (reference style — no uppercase shout).
export function SectionTitle({ children }) {
  return <Text style={styles.title}>{children}</Text>;
}

// Primary CTA — full pill, blue fill, white label.
export function PixelButton({ label, onPress, disabled, tone = 'accent' }) {
  const bg = disabled ? colors.bgPanelAlt : colors[tone] || colors.accent;
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [styles.btn, { backgroundColor: bg, opacity: pressed ? 0.85 : 1 }]}
    >
      <Text style={[styles.btnText, disabled && { color: colors.textDim }]}>{label}</Text>
    </Pressable>
  );
}

// On/off switch — blue track when on.
export function PixelToggle({ value, onToggle, disabled, onLabel = 'ON', offLabel = 'OFF' }) {
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: value ? 1 : 0, duration: 140, useNativeDriver: false }).start();
  }, [value, anim]);
  const left = anim.interpolate({ inputRange: [0, 1], outputRange: [3, 25] });
  const track = anim.interpolate({ inputRange: [0, 1], outputRange: [colors.bgPanelAlt, colors.accent] });
  return (
    <Pressable
      onPress={disabled ? undefined : onToggle}
      hitSlop={8}
      style={{ opacity: disabled ? 0.5 : 1, alignItems: 'center' }}
    >
      <Animated.View style={[styles.toggleTrack, { backgroundColor: track }]}>
        <Animated.View style={[styles.toggleThumb, { left }]} />
      </Animated.View>
      <Text style={[styles.toggleLabel, value && styles.toggleLabelOn]}>{value ? onLabel : offLabel}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  toggleTrack: { width: 48, height: 26, borderRadius: 13 },
  toggleThumb: {
    position: 'absolute', top: 3, width: 20, height: 20, borderRadius: 10,
    backgroundColor: colors.text,
  },
  toggleLabel: { fontFamily: fonts.body, fontSize: 9, color: colors.textDim, marginTop: 3, fontWeight: '600' },
  toggleLabelOn: { color: colors.accentAlt },
  panel: {
    backgroundColor: colors.bgPanel,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: 12,
    overflow: 'hidden',
  },
  title: {
    fontFamily: fonts.heading,
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  btn: {
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  btnText: {
    fontFamily: fonts.body,
    fontWeight: '700',
    fontSize: 15,
    color: colors.text,
  },
});
