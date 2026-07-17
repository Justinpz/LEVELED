import React, { useEffect, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native';
import { colors, fonts, glass, radius, spacing } from '../theme';

// Translucent glass card with an energy accent strip along the top edge.
export function Panel({ children, style, tone = 'accent' }) {
  return (
    <View style={[styles.panel, style]}>
      <View style={[styles.panelStrip, { backgroundColor: colors[tone] || colors.accent }]} />
      {children}
    </View>
  );
}

export function SectionTitle({ children }) {
  return <Text style={styles.title}>{children}</Text>;
}

// Sharp energy button — slight skew, dark ink label on a hot fill.
export function PixelButton({ label, onPress, disabled, tone = 'accent' }) {
  const bg = disabled ? colors.border : colors[tone] || colors.accent;
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [
        styles.btn,
        {
          backgroundColor: bg,
          opacity: pressed ? 0.85 : 1,
          shadowColor: bg,
        },
      ]}
    >
      <Text style={styles.btnText}>{label}</Text>
    </Pressable>
  );
}

// On/off toggle — the "am I wearing this?" switch.
// ON: ember track, thumb right, label WORN. OFF: dim track, thumb left, label OFF.
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
    width: 48, height: 24, borderRadius: 12,
    borderWidth: 1, borderColor: colors.border,
  },
  toggleThumb: {
    position: 'absolute', top: 3, width: 16, height: 16, borderRadius: 8,
    backgroundColor: colors.text, borderWidth: 1, borderColor: colors.ink,
  },
  toggleLabel: {
    fontFamily: fonts.body, fontSize: 9, color: colors.textDim, marginTop: 2,
    fontWeight: '700', letterSpacing: 1,
  },
  toggleLabelOn: { color: colors.accent },
  panel: {
    // Semi-transparent so the screen's background art shows through the panels.
    backgroundColor: glass.panel,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  panelStrip: {
    position: 'absolute', top: 0, left: 0, right: '55%', height: 3,
    borderBottomRightRadius: 3, opacity: 0.9,
  },
  title: {
    fontFamily: fonts.heading,
    fontSize: 22,
    color: colors.text,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  btn: {
    borderRadius: radius.sm,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    transform: [{ skewX: '-6deg' }],
    shadowOpacity: 0.55,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  btnText: {
    fontFamily: fonts.body,
    fontWeight: '700',
    color: colors.ink,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    transform: [{ skewX: '6deg' }],
  },
});
