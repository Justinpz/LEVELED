import React from 'react';
import { View, Text, ImageBackground, StyleSheet } from 'react-native';
import { colors, fonts } from '../theme';
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
          <Text style={styles.class}>CLASS · WARRIOR</Text>
          <Text style={styles.blurb}>
            Battle-hardened. Grounded power. Every lift forges the body — Arms, Legs, Chest, Back, Core —
            and the body forges the legend.
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
  scrim: { flex: 1, backgroundColor: 'rgba(11,10,16,0.45)', justifyContent: 'space-between', padding: 28 },
  top: { alignItems: 'center', marginTop: 56 },
  title: {
    fontFamily: fonts.heading, color: '#fff', fontSize: 40, fontWeight: '900', letterSpacing: 8,
    textShadowColor: colors.xp, textShadowRadius: 14,
  },
  sub: { fontFamily: fonts.body, color: colors.textDim, marginTop: 8, textAlign: 'center' },
  bottom: { backgroundColor: 'rgba(26,20,32,0.82)', borderRadius: 10, borderWidth: 2, borderColor: colors.border, padding: 18, marginBottom: 24 },
  class: { fontFamily: fonts.heading, color: colors.accent, fontSize: 16, letterSpacing: 3, marginBottom: 8 },
  blurb: { fontFamily: fonts.body, color: colors.text, lineHeight: 20 },
});
