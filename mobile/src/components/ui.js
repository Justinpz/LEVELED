import React, { useEffect, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native';
import { colors, radius, spacing } from '../theme';

// Bordered panel — the base 8-bit container.
export function Panel({ children, style }) {
  return <View style={[styles.panel, style]}>{children}</View>;
}

export function SectionTitle({ children }) {
  return <Text style={styles.title}>{children}</Text>;
}

// Chunky pixel-styled button.
export function PixelButton({ label, onPress, disabled, tone = 'accent' }) {
  const bg = disabled ? colors.border : colors[tone] || colors.accent;
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bg, opacity: pressed ? 0.8 : 1 },
      ]}
    >
      <Text style={styles.btnText}>{label}</Text>
    </Pressable>
  );
}

// Pixel-styled on/off toggle — the "am I wearing this?" switch.
// ON: gold track, thumb right, label WORN. OFF: dim track, thumb left, label OFF.
export function PixelToggle({ value, onToggle, disabled, onLabel = 'WORN', offLabel = 'OFF' }) {
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: value ? 1 : 0, duration: 140, useNativeDriver: false }).start();
  }, [value, anim]);
  const left = anim.interpolate({ inputRange: [0, 1], outputRange: [2, 26] });
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
  toggleTrack: {
    width: 48, height: 24, borderRadius: 4,
    borderWidth: 2, borderColor: colors.border,
  },
  toggleThumb: {
    position: 'absolute', top: 2, width: 16, height: 16, borderRadius: 3,
    backgroundColor: '#ece4f5', borderWidth: 1, borderColor: '#00000055',
  },
  toggleLabel: {
    fontFamily: 'monospace', fontSize: 8, color: colors.textDim, marginTop: 2,
    fontWeight: '700', letterSpacing: 1,
  },
  toggleLabelOn: { color: colors.accent },
  panel: {
    // Semi-transparent so the screen's background art shows through the panels.
    backgroundColor: 'rgba(26, 20, 32, 0.72)',
    borderColor: colors.border,
    borderWidth: 2,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  title: {
    fontFamily: 'monospace',
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  btn: {
    borderRadius: radius.sm,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#00000055',
  },
  btnText: {
    fontFamily: 'monospace',
    fontWeight: '700',
    color: '#1a1420',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});
