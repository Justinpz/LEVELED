import React from 'react';
import { View, Text, ImageBackground, StyleSheet } from 'react-native';
import { colors, fonts, glass } from '../theme';
import { PixelButton } from './ui';
import { uiImage } from '../assets';

// First-run splash: the Warrior's awakening. Dismisses into the game.
export default function OnboardingSplash({ onBegin }) {
  return (
    <ImageBackground source={uiImage('onboarding')} style={styles.bg} resizeMode="cover">
      <View style={styles.scrim}>
        <View style={styles.top}>
          <Text style={styles.title}>LEVELED</Text>
          <Text style={styles.sub}>Train in the real world. Ascend in this one.</Text>
        </View>
        <View style={styles.bottom}>
          <Text style={styles.class}>THE PACT · FEED THE BEAST</Text>
          <Text style={styles.blurb}>
            A beast is bound to you. Every rep feeds it. Slay the daily mob, watch it evolve —
            from ember hatchling to mythic apex. Miss a day, and it hungers.
          </Text>
          <View style={{ marginTop: 20 }}>
            <PixelButton label="Begin the Ascent" onPress={onBegin} />
          </View>
        </View>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: colors.bg },
  scrim: { flex: 1, backgroundColor: glass.scrim(0.45), justifyContent: 'space-between', padding: 28 },
  top: { alignItems: 'center', marginTop: 56 },
  title: {
    fontFamily: fonts.heading, color: '#fff', fontSize: 52, letterSpacing: 10,
    textShadowColor: colors.accent, textShadowRadius: 18,
  },
  sub: { fontFamily: fonts.body, color: colors.text, marginTop: 4, textAlign: 'center', letterSpacing: 0.5 },
  bottom: { backgroundColor: glass.panelStrong, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 18, marginBottom: 24 },
  class: { fontFamily: fonts.heading, color: colors.accentAlt, fontSize: 20, letterSpacing: 4, marginBottom: 8 },
  blurb: { fontFamily: fonts.body, color: colors.text, lineHeight: 20 },
});
