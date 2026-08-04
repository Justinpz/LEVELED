import React, { useEffect, useRef } from 'react';
import { View, Image, StyleSheet, Animated, Easing } from 'react-native';
import { colors } from '../theme';

// The living beast — breath, restless bob/sway, and a periodic aura surge so
// it never just sits there. `flare` (a changing number) triggers the big
// feeding surge after a workout is logged.
export default function CreatureFigure({ art, width = 200, height = 266, animate = true, flare = 0 }) {
  const breath = useRef(new Animated.Value(0)).current;
  const stance = useRef(new Animated.Value(0)).current;
  const surge = useRef(new Animated.Value(0)).current;
  const feed = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!animate) {
      breath.setValue(0); stance.setValue(0); surge.setValue(0);
      return undefined;
    }
    const loops = [
      Animated.loop(Animated.sequence([
        Animated.timing(breath, { toValue: 1, duration: 2100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(breath, { toValue: 0, duration: 2100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])),
      Animated.loop(Animated.sequence([
        Animated.timing(stance, { toValue: 1, duration: 3000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(stance, { toValue: 0, duration: 3000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])),
      Animated.loop(Animated.sequence([
        Animated.delay(4200),
        Animated.timing(surge, { toValue: 1, duration: 380, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(surge, { toValue: 0, duration: 950, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])),
    ];
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [animate, breath, stance, surge]);

  // Feeding surge: quick grow + blinding aura, settling back.
  useEffect(() => {
    if (!flare) return;
    feed.setValue(0);
    Animated.sequence([
      Animated.timing(feed, { toValue: 1, duration: 420, easing: Easing.out(Easing.back(1.4)), useNativeDriver: true }),
      Animated.timing(feed, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]).start();
  }, [flare, feed]);

  const scaleY = breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.02] });
  const bobY = stance.interpolate({ inputRange: [0, 1], outputRange: [0, -5] });
  const sway = stance.interpolate({ inputRange: [0, 1], outputRange: ['-0.8deg', '0.8deg'] });
  const feedScale = feed.interpolate({ inputRange: [0, 1], outputRange: [1, 1.07] });
  const glowOpacity = Animated.add(
    Animated.add(
      breath.interpolate({ inputRange: [0, 1], outputRange: [0.16, 0.3] }),
      surge.interpolate({ inputRange: [0, 1], outputRange: [0, 0.4] })
    ),
    feed.interpolate({ inputRange: [0, 1], outputRange: [0, 0.5] })
  );
  // Rest = 1; surge peak = 1.12; feeding peak adds up to +0.2 on top.
  const glowScale = Animated.add(
    surge.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] }),
    feed.interpolate({ inputRange: [0, 1], outputRange: [0, 0.2] })
  );

  return (
    <View style={{ width, height }}>
      <Animated.View
        pointerEvents="none"
        style={[styles.glow, {
          width: width * 0.74, height: height * 0.58,
          left: width * 0.13, top: height * 0.28,
          borderRadius: width * 0.37,
          opacity: glowOpacity,
          transform: [{ scale: glowScale }],
        }]}
      />
      <Animated.View style={[{ width, height }, { transform: [{ translateY: bobY }, { rotate: sway }, { scaleY }, { scale: feedScale }] }]}>
        <Image source={art} style={styles.img} resizeMode="contain" />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  img: { width: '100%', height: '100%' },
  glow: {
    position: 'absolute',
    backgroundColor: colors.accent,
    shadowColor: colors.accent,
    shadowOpacity: 1,
    shadowRadius: 34,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
});
