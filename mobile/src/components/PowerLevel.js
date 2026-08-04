import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { colors, fonts } from '../theme';

// The headline stat — one big climbing number. Counts up when it changes so
// gains feel like gains.
export default function PowerLevel({ value }) {
  const anim = useRef(new Animated.Value(value)).current;
  const [shown, setShown] = useState(value);
  const prev = useRef(value);

  useEffect(() => {
    if (value === prev.current) return;
    anim.setValue(prev.current);
    prev.current = value;
    const id = anim.addListener(({ value: v }) => setShown(Math.round(v)));
    Animated.timing(anim, { toValue: value, duration: 1400, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start(() => {
      anim.removeListener(id);
      setShown(value);
    });
    return () => anim.removeListener(id);
  }, [value, anim]);

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>POWER LEVEL</Text>
      <Text style={styles.value}>{shown.toLocaleString()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  label: {
    fontFamily: fonts.body, color: colors.textDim, fontSize: 10,
    fontWeight: '700', letterSpacing: 3,
  },
  value: {
    fontFamily: fonts.heading, color: colors.accent, fontSize: 44, letterSpacing: 2,
    textShadowColor: colors.accent, textShadowRadius: 18, marginTop: -2,
  },
});
