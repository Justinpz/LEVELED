import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Polygon, Line, Text as SvgText } from 'react-native-svg';
import { colors, fonts, bodyParts } from '../theme';

// Six-axis balance radar — one glance answers "what's lagging?". Axes are the
// body parts; the data polygon is each part's level relative to your highest.
export default function BalanceHex({ progress, size = 210 }) {
  // Wider canvas than the hex itself so side vertex labels never clip.
  const width = size + 130;
  const cx = width / 2;
  const cy = size / 2;
  const R = size * 0.36;
  const byPart = Object.fromEntries((progress || []).map((p) => [p.bodyPart, p.level]));
  const maxLevel = Math.max(1, ...bodyParts.map((bp) => byPart[bp] || 1));

  const point = (i, r) => {
    const angle = (Math.PI / 3) * i - Math.PI / 2; // start at top, clockwise
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
  };
  const ring = (frac) => bodyParts.map((_, i) => point(i, R * frac).join(',')).join(' ');
  const dataPoints = bodyParts
    .map((bp, i) => {
      const lvl = byPart[bp] || 1;
      const frac = Math.max(0.12, lvl / maxLevel);
      return point(i, R * frac).join(',');
    })
    .join(' ');

  return (
    <View style={styles.wrap}>
      <Svg width={width} height={size}>
        {[1, 0.66, 0.33].map((f) => (
          <Polygon key={f} points={ring(f)} fill="none" stroke={colors.border} strokeWidth={1} />
        ))}
        {bodyParts.map((_, i) => {
          const [x, y] = point(i, R);
          return <Line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke={colors.border} strokeWidth={0.6} />;
        })}
        <Polygon points={dataPoints} fill={`${colors.accent}55`} stroke={colors.accent} strokeWidth={2} />
        {bodyParts.map((bp, i) => {
          const [x, y] = point(i, R + 16);
          return (
            <SvgText
              key={bp}
              x={x}
              y={y + 3}
              fill={colors[bp] || colors.text}
              fontSize={10}
              fontWeight="bold"
              textAnchor="middle"
            >
              {`${bp.toUpperCase()} ${byPart[bp] || 1}`}
            </SvgText>
          );
        })}
      </Svg>
      <Text style={styles.hint}>levels per body part — the shape shows your balance</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  hint: { fontFamily: fonts.body, color: colors.textDim, fontSize: 9, marginTop: 2 },
});
