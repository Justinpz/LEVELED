import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
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

const styles = StyleSheet.create({
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
