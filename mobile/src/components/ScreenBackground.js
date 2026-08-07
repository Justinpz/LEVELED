import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors } from '../theme';

// Flat black ground — the reference layout puts art inside cards, not behind
// the whole screen. `name` is kept for call-site compatibility.
export default function ScreenBackground({ name, children }) {
  return <View style={styles.flat}>{children}</View>;
}

const styles = StyleSheet.create({
  flat: { flex: 1, backgroundColor: colors.bg },
});
