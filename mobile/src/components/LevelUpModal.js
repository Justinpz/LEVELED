import React from 'react';
import { Modal, View, Text, Pressable, ImageBackground, StyleSheet } from 'react-native';
import { colors, fonts, glass } from '../theme';
import { uiImage } from '../assets';

// Full-screen level-up ritual. Pass the levelUps array from POST /game/workouts/log.
export default function LevelUpModal({ levelUps, onClose }) {
  const visible = !!(levelUps && levelUps.length);
  const art = uiImage('levelUp');
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <ImageBackground source={art} style={styles.art} resizeMode="cover">
          <View style={styles.center}>
            <Text style={styles.kicker}>▲ ▲ ▲</Text>
            <Text style={styles.title}>LEVEL UP</Text>
            {(levelUps || []).map((lu, i) => (
              <Text key={i} style={[styles.line, { color: colors[lu.bodyPart] || colors.accent }]}>
                {lu.bodyPart} → Lv {lu.to}  ·  {lu.band}
              </Text>
            ))}
            <Text style={styles.tap}>tap to continue</Text>
          </View>
        </ImageBackground>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: glass.scrim(0.85) },
  art: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  kicker: { fontFamily: fonts.body, color: colors.accent, fontSize: 20, marginBottom: 8, letterSpacing: 4 },
  title: {
    fontFamily: fonts.heading, color: '#fff', fontSize: 56,
    letterSpacing: 8, textShadowColor: colors.accent, textShadowRadius: 16, marginBottom: 20,
  },
  line: { fontFamily: fonts.body, fontSize: 18, fontWeight: '700', marginBottom: 6 },
  tap: { fontFamily: fonts.body, color: colors.textDim, marginTop: 28 },
});
