import React from 'react';
import { ImageBackground, View, StyleSheet } from 'react-native';
import { colors } from '../theme';
import { bgImage } from '../assets';

// Wraps a screen in its dark-fantasy background plate with a legibility scrim
// so foreground panels/text stay readable. Falls back to the flat bg color.
export default function ScreenBackground({ name, children, scrim = 0.55 }) {
  const src = bgImage(name);
  if (!src) return <View style={styles.flat}>{children}</View>;
  return (
    <ImageBackground source={src} style={styles.flat} resizeMode="cover">
      <View style={[styles.scrim, { backgroundColor: `rgba(14,10,20,${scrim})` }]}>
        {children}
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  flat: { flex: 1, backgroundColor: colors.bg },
  scrim: { flex: 1 },
});
