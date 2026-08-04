import React, { useEffect, useRef } from 'react';
import { View, Text, Image, StyleSheet, Animated, Easing } from 'react-native';
import { colors, fonts, glass } from '../theme';

// The daily mob — a boss bar for your session. HP is your volume target;
// every confirmed set chews a chunk out of it. `lastHit` ({amount, key})
// floats a damage number and shakes the portrait.
export default function MobBanner({ mob, hp, damage, slain, lastHit }) {
  const shake = useRef(new Animated.Value(0)).current;
  const float = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!lastHit || !lastHit.amount) return;
    shake.setValue(0);
    float.setValue(0);
    Animated.parallel([
      Animated.sequence([
        Animated.timing(shake, { toValue: 1, duration: 60, useNativeDriver: true }),
        Animated.timing(shake, { toValue: -1, duration: 60, useNativeDriver: true }),
        Animated.timing(shake, { toValue: 0.6, duration: 60, useNativeDriver: true }),
        Animated.timing(shake, { toValue: 0, duration: 60, useNativeDriver: true }),
      ]),
      Animated.timing(float, { toValue: 1, duration: 900, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
  }, [lastHit && lastHit.key]);

  if (!mob) return null;
  const remaining = Math.max(0, hp - damage);
  const pct = hp > 0 ? Math.min(1, damage / hp) : 0;
  const shakeX = shake.interpolate({ inputRange: [-1, 1], outputRange: [-5, 5] });
  const floatY = float.interpolate({ inputRange: [0, 1], outputRange: [8, -26] });
  const floatOpacity = float.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 1, 0] });

  return (
    <View style={[styles.card, slain && styles.cardSlain]}>
      <Animated.View style={{ transform: [{ translateX: shakeX }] }}>
        <Image source={mob.art} style={[styles.portrait, slain && styles.portraitSlain]} resizeMode="cover" />
        {slain ? <Text style={styles.skull}>☠</Text> : null}
      </Animated.View>
      <View style={styles.info}>
        <Text style={styles.kicker}>DAILY MOB</Text>
        <Text style={styles.name} numberOfLines={1}>
          {mob.name} <Text style={styles.epithet}>{mob.epithet}</Text>
        </Text>
        <View style={styles.hpTrack}>
          <View style={[styles.hpFill, { width: `${(1 - pct) * 100}%` }, slain && { width: '0%' }]} />
        </View>
        <Text style={styles.hpText}>
          {slain ? 'SLAIN — the beast feeds tonight' : `${remaining.toLocaleString()} / ${hp.toLocaleString()} HP · every set strikes`}
        </Text>
      </View>
      {lastHit && lastHit.amount ? (
        <Animated.Text
          key={lastHit.key}
          style={[styles.damage, { opacity: floatOpacity, transform: [{ translateY: floatY }] }]}
        >
          -{Math.round(lastHit.amount).toLocaleString()}
        </Animated.Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: glass.panelStrong, borderColor: colors.danger, borderWidth: 1,
    borderRadius: 12, padding: 10, marginBottom: 10, overflow: 'hidden',
  },
  cardSlain: { borderColor: colors.success },
  portrait: {
    width: 64, height: 64, borderRadius: 10,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.ink,
  },
  portraitSlain: { opacity: 0.35 },
  skull: { position: 'absolute', alignSelf: 'center', top: 16, fontSize: 26, color: colors.success },
  info: { flex: 1, minWidth: 0 },
  kicker: { fontFamily: fonts.body, color: colors.danger, fontSize: 8, fontWeight: '700', letterSpacing: 2 },
  name: { fontFamily: fonts.heading, color: colors.text, fontSize: 20, letterSpacing: 1 },
  epithet: { color: colors.textDim, fontSize: 16 },
  hpTrack: {
    height: 10, backgroundColor: colors.ink, borderRadius: 5,
    borderWidth: 1, borderColor: colors.border, overflow: 'hidden', marginTop: 4,
  },
  hpFill: { height: '100%', backgroundColor: colors.danger },
  hpText: { fontFamily: fonts.body, color: colors.textDim, fontSize: 9, marginTop: 3 },
  damage: {
    position: 'absolute', right: 14, top: 26,
    fontFamily: fonts.heading, fontSize: 24, color: colors.Chest,
    textShadowColor: colors.danger, textShadowRadius: 8,
  },
});
