import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, ActivityIndicator, Pressable, Animated } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api';
import { colors, spacing, fonts, glass } from '../theme';
import { Panel, SectionTitle } from '../components/ui';
import ScreenBackground from '../components/ScreenBackground';
import CreatureFigure from '../components/CreatureFigure';
import PowerLevel from '../components/PowerLevel';
import BalanceHex from '../components/BalanceHex';
import { stageFor } from '../creature';
import { barkFor } from '../barks';
import { useSettings } from '../settingsStore';

// Home hub — the beast. One creature that evolves with your lifetime
// training, one climbing Power Level, one balance hex. Feed it by lifting.
export default function HomeScreen() {
  const settings = useSettings();
  const [progress, setProgress] = useState(null);
  const [daily, setDaily] = useState(null);
  const [weekly, setWeekly] = useState(null);
  const [food, setFood] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [bark, setBark] = useState(null);
  const [flare, setFlare] = useState(0);

  const bounce = useRef(new Animated.Value(0)).current;
  const barkTimer = useRef(null);
  const prevTotal = useRef(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [p, d, w, f] = await Promise.all([
        api.getProgress(),
        api.getDailyChallenge().catch(() => null),
        api.getWeeklyChallenge().catch(() => null),
        api.getFoodToday().catch(() => null),
      ]);
      setProgress(p);
      setDaily(d);
      setWeekly(w);
      setFood(f);
      const total = p.progress.reduce((s, x) => s + x.lifetimeXp, 0);
      // Came back stronger than last look → the beast visibly feeds.
      if (prevTotal.current != null && total > prevTotal.current) setFlare(Date.now());
      prevTotal.current = total;
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  useEffect(() => () => { if (barkTimer.current) clearTimeout(barkTimer.current); }, []);

  const pokeBeast = (tier) => {
    if (settings.animations) {
      bounce.setValue(0);
      Animated.sequence([
        Animated.timing(bounce, { toValue: 1, duration: 120, useNativeDriver: true }),
        Animated.spring(bounce, { toValue: 0, friction: 3, tension: 160, useNativeDriver: true }),
      ]).start();
    }
    if (settings.barks) {
      setBark(barkFor(tier, (progress && progress.currentStreak) || 0));
      if (barkTimer.current) clearTimeout(barkTimer.current);
      barkTimer.current = setTimeout(() => setBark(null), 3500);
    }
  };

  if (loading) return <Centered><ActivityIndicator color={colors.accent} /></Centered>;
  if (error) return <Centered><Text style={styles.err}>Can't reach the realm.{'\n'}{error}</Text></Centered>;

  const totalXp = progress.progress.reduce((s, p) => s + p.lifetimeXp, 0);
  const stage = stageFor(totalXp);
  const streak = progress.currentStreak || 0;
  const tier = Math.min(5, Math.max(1, stage.stage)); // barks scale with stage
  const translateY = bounce.interpolate({ inputRange: [0, 1], outputRange: [0, -12] });
  const scaleX = bounce.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] });

  const dailyList = (daily && (daily.challenges || (daily.challenge ? [daily.challenge] : []))) || [];
  const weeklyList = (weekly && (weekly.challenges || (weekly.challenge ? [weekly.challenge] : []))) || [];

  return (
    <ScreenBackground name="Home">
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: spacing.md }}
      refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={colors.accent} />}
    >
      <Panel style={styles.hero}>
        {bark ? (
          <View style={styles.barkBubble}>
            <Text style={styles.barkText}>{bark}</Text>
          </View>
        ) : null}
        <Pressable onPress={() => pokeBeast(tier)} hitSlop={8}>
          <Animated.View style={[styles.beastBox, { transform: [{ translateY }, { scaleX }] }]}>
            <CreatureFigure art={stage.art} width={196} height={260} animate={settings.animations} flare={flare} />
          </Animated.View>
        </Pressable>
        <PowerLevel value={totalXp} />
        <Text style={styles.stageName}>STAGE {stage.stage} · {stage.name}</Text>
        {settings.displayName ? <Text style={styles.displayName}>bound to {settings.displayName}</Text> : null}
        {stage.next ? (
          <View style={styles.evoWrap}>
            <View style={styles.evoTrack}>
              <View style={[styles.evoFill, { width: `${stage.progress * 100}%` }]} />
            </View>
            <Text style={styles.evoText}>
              {(stage.next.minXp - totalXp).toLocaleString()} power until it becomes the {stage.next.name}
            </Text>
          </View>
        ) : (
          <Text style={styles.evoText}>final form — keep it fed</Text>
        )}
        <Text style={styles.overall}>{streak > 0 ? `🔥 ${streak} day streak — it hungers daily` : 'it hungers — train today'}</Text>
      </Panel>

      <Panel>
        <SectionTitle>Balance</SectionTitle>
        <BalanceHex progress={progress.progress} />
      </Panel>

      {food ? <HealthMeter food={food} /> : null}

      <Panel>
        <SectionTitle>Quests</SectionTitle>
        {dailyList.map((c) => <QuestLine key={`d-${c.id}`} kind="Daily" challenge={c} />)}
        {weeklyList.map((c) => <QuestLine key={`w-${c.id}`} kind="Weekly" challenge={c} />)}
        {dailyList.length + weeklyList.length === 0 ? (
          <Text style={styles.overall}>None active</Text>
        ) : null}
      </Panel>
    </ScrollView>
    </ScreenBackground>
  );
}

function Centered({ children }) {
  return <View style={styles.centered}>{children}</View>;
}

function HealthMeter({ food }) {
  const { health, totals, goals } = food;
  const pct = Math.max(0, Math.min(100, health.score));
  return (
    <Panel>
      <SectionTitle>Health</SectionTitle>
      <View style={styles.meterTrack}>
        <View style={[styles.meterFill, { width: `${pct}%`, backgroundColor: meterColor(health) }]} />
      </View>
      <View style={styles.meterRow}>
        <Text style={styles.meterLabel}>{health.label}</Text>
        <Text style={styles.meterStats}>
          {totals.calories}/{goals.calories} kcal · {totals.protein}/{goals.protein}g P
          {goals.carbs ? ` · ${totals.carbs}/${goals.carbs}g C · ${totals.fat}/${goals.fat}g F` : ''}
        </Text>
      </View>
    </Panel>
  );
}

function meterColor(health) {
  if (health.label === 'Overfed') return colors.danger;
  if (health.score >= 75) return colors.success;
  if (health.score >= 50) return colors.accent;
  return colors.danger;
}

function QuestLine({ kind, challenge }) {
  return (
    <View style={styles.questLine}>
      <Text style={styles.questKind}>{kind}</Text>
      <Text style={[styles.questTitle, challenge.completed && styles.questDone]}>
        {challenge.completed ? '✓ ' : ''}{challenge.title}
      </Text>
      <Text style={styles.questReward}>+{challenge.rewardPts}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  centered: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  err: { color: colors.danger, fontFamily: fonts.body, textAlign: 'center' },
  hero: { alignItems: 'center' },
  barkBubble: {
    backgroundColor: glass.panelStrong, borderColor: colors.accent, borderWidth: 1,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginBottom: spacing.sm,
    maxWidth: 300,
  },
  barkText: { fontFamily: fonts.body, color: colors.text, fontSize: 12, textAlign: 'center' },
  beastBox: { alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  stageName: { fontFamily: fonts.body, color: colors.accentAlt, fontSize: 12, fontWeight: '700', letterSpacing: 2, marginTop: 2 },
  displayName: { fontFamily: fonts.body, color: colors.textDim, fontSize: 11, marginTop: 2 },
  evoWrap: { width: '100%', marginTop: 10 },
  evoTrack: {
    height: 8, backgroundColor: colors.ink, borderRadius: 4,
    borderWidth: 1, borderColor: colors.border, overflow: 'hidden',
  },
  evoFill: { height: '100%', backgroundColor: colors.accentAlt },
  evoText: { fontFamily: fonts.body, color: colors.textDim, fontSize: 10, marginTop: 4, textAlign: 'center' },
  overall: { fontFamily: fonts.body, color: colors.textDim, marginTop: 8 },
  meterTrack: {
    height: 14, backgroundColor: colors.bgPanelAlt, borderRadius: 7,
    borderWidth: 2, borderColor: colors.border, overflow: 'hidden',
  },
  meterFill: { height: '100%' },
  meterRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, flexWrap: 'wrap' },
  meterLabel: { fontFamily: fonts.body, color: colors.text, fontWeight: '700', fontSize: 12 },
  meterStats: { fontFamily: fonts.body, color: colors.textDim, fontSize: 10 },
  questLine: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  questKind: { width: 64, fontFamily: fonts.body, color: colors.textDim, fontSize: 12 },
  questTitle: { flex: 1, fontFamily: fonts.body, color: colors.text },
  questDone: { color: colors.success },
  questReward: { fontFamily: fonts.body, color: colors.accent, fontWeight: '700' },
});
