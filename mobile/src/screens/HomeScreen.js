import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, ActivityIndicator, Pressable, Animated, ImageBackground } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { api } from '../api';
import { colors, spacing, fonts, radius } from '../theme';
import { Panel, SectionTitle } from '../components/ui';
import ScreenBackground from '../components/ScreenBackground';
import CreatureFigure from '../components/CreatureFigure';
import BalanceHex from '../components/BalanceHex';
import { stageFor } from '../creature';
import { dailyMob, mobHpFrom } from '../mobs';
import { barkFor } from '../barks';
import { useSettings } from '../settingsStore';

// Dashboard — greeting + power pill, today's mob hero card, week strip,
// the beast, then stats and quests. Reference-app layout, LEVELED soul.
const localDayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export default function HomeScreen() {
  const settings = useSettings();
  const navigation = useNavigation();
  const [progress, setProgress] = useState(null);
  const [daily, setDaily] = useState(null);
  const [weekly, setWeekly] = useState(null);
  const [food, setFood] = useState(null);
  const [history, setHistory] = useState(null);
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
      const [p, d, w, f, h] = await Promise.all([
        api.getProgress(),
        api.getDailyChallenge().catch(() => null),
        api.getWeeklyChallenge().catch(() => null),
        api.getFoodToday().catch(() => null),
        api.getWorkoutHistory(15).catch(() => null),
      ]);
      setProgress(p);
      setDaily(d);
      setWeekly(w);
      setFood(f);
      setHistory(h ? h.sessions || [] : []);
      const total = p.progress.reduce((s, x) => s + x.lifetimeXp, 0);
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
  const tier = Math.min(5, Math.max(1, stage.stage));
  const translateY = bounce.interpolate({ inputRange: [0, 1], outputRange: [0, -12] });
  const scaleX = bounce.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] });

  const mob = dailyMob(localDayKey());
  const mobHp = mobHpFrom(history);
  const trainedDays = new Set((history || []).map((s) => localDayKey(new Date(s.startedAt))));
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return {
      letter: ['S', 'M', 'T', 'W', 'T', 'F', 'S'][d.getDay()],
      trained: trainedDays.has(localDayKey(d)),
      today: i === 6,
    };
  });
  const todaySlain = week[6].trained; // logged something today

  const today = new Date();
  const dateLabel = today.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
  const name = settings.displayName || 'Warrior';
  const initials = name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  const dailyList = (daily && (daily.challenges || (daily.challenge ? [daily.challenge] : []))) || [];
  const weeklyList = (weekly && (weekly.challenges || (weekly.challenge ? [weekly.challenge] : []))) || [];

  return (
    <ScreenBackground name="Home">
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: spacing.md, paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={colors.accent} />}
    >
      {/* Greeting + power pill */}
      <View style={styles.topRow}>
        <View style={styles.userRow}>
          <View style={styles.avatarCircle}><Text style={styles.avatarText}>{initials}</Text></View>
          <View>
            <Text style={styles.userName}>{name}</Text>
            <Text style={styles.userDate}>{dateLabel}</Text>
          </View>
        </View>
        <View style={styles.powerPill}>
          <Text style={styles.powerText}>{totalXp.toLocaleString()} PWR</Text>
          <Text style={styles.powerIcon}>⚡</Text>
        </View>
      </View>

      {/* Today's mob hero */}
      <Pressable onPress={() => navigation.navigate('Workout')}>
        <ImageBackground source={mob.art} style={styles.hero} imageStyle={styles.heroImg} resizeMode="cover">
          <View style={styles.heroScrim} />
          <View style={styles.heroTop}>
            <Text style={styles.heroKicker}>{todaySlain ? 'FED TODAY' : 'DAILY MOB'}</Text>
          </View>
          <View style={styles.heroBottom}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.heroTitle}>{mob.name}</Text>
              <Text style={styles.heroMeta}>{mob.epithet} · {mobHp.toLocaleString()} HP</Text>
            </View>
            <View style={[styles.heroCta, todaySlain && { backgroundColor: colors.success }]}>
              <Text style={styles.heroCtaText}>{todaySlain ? 'Slain ✓' : 'Fight'}</Text>
            </View>
          </View>
        </ImageBackground>
      </Pressable>

      {/* Week strip */}
      <Panel style={styles.weekCard}>
        <View style={styles.weekRow}>
          {week.map((d, i) => (
            <View key={i} style={styles.weekDay}>
              <View style={[
                styles.weekDot,
                d.trained && styles.weekDotDone,
                d.today && styles.weekDotToday,
              ]}>
                <Text style={[styles.weekDotText, d.trained && { color: colors.text }]}>
                  {d.trained ? '✓' : d.letter}
                </Text>
              </View>
              <Text style={[styles.weekLabel, d.today && { color: colors.text }]}>{d.letter}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.weekStreak}>
          {streak > 0 ? `🔥 ${streak} day streak` : 'no streak yet — feed it today'}
        </Text>
      </Panel>

      {/* The beast */}
      <Panel style={styles.beastCard}>
        {bark ? (
          <View style={styles.barkBubble}><Text style={styles.barkText}>{bark}</Text></View>
        ) : null}
        <Pressable onPress={() => pokeBeast(tier)} hitSlop={8}>
          <Animated.View style={{ transform: [{ translateY }, { scaleX }], alignItems: 'center' }}>
            <CreatureFigure art={stage.art} width={190} height={252} animate={settings.animations} flare={flare} />
          </Animated.View>
        </Pressable>
        <Text style={styles.powerBig}>{totalXp.toLocaleString()}</Text>
        <Text style={styles.powerLabel}>POWER LEVEL</Text>
        <Text style={styles.stageName}>Stage {stage.stage} · {stage.name}</Text>
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
      </Panel>

      {/* Stats */}
      <View style={styles.sectionRow}>
        <SectionTitle>Stats</SectionTitle>
      </View>
      <Panel>
        <Text style={styles.cardKicker}>BALANCE</Text>
        <BalanceHex progress={progress.progress} />
      </Panel>
      {food ? (
        <View style={styles.statRow}>
          <Panel style={styles.statCard}>
            <Text style={styles.cardKicker}>CALORIES</Text>
            <Text style={styles.statValue}>
              {food.totals.calories}<Text style={styles.statGoal}> / {food.goals.calories}</Text>
            </Text>
            <Text style={styles.statSub}>{food.totals.protein}g protein · {food.health.label}</Text>
          </Panel>
          <Panel style={styles.statCard}>
            <Text style={styles.cardKicker}>HEALTH</Text>
            <Text style={styles.statValue}>
              {Math.max(0, Math.min(100, food.health.score))}<Text style={styles.statGoal}> / 100</Text>
            </Text>
            <View style={styles.meterTrack}>
              <View style={[styles.meterFill, {
                width: `${Math.max(0, Math.min(100, food.health.score))}%`,
                backgroundColor: food.health.score >= 75 ? colors.success : food.health.score >= 50 ? colors.accent : colors.danger,
              }]} />
            </View>
          </Panel>
        </View>
      ) : null}

      {/* Quests */}
      <View style={styles.sectionRow}>
        <SectionTitle>Quests</SectionTitle>
      </View>
      <Panel>
        {dailyList.map((c) => <QuestLine key={`d-${c.id}`} kind="Daily" challenge={c} />)}
        {weeklyList.map((c) => <QuestLine key={`w-${c.id}`} kind="Weekly" challenge={c} />)}
        {dailyList.length + weeklyList.length === 0 ? (
          <Text style={styles.evoText}>None active</Text>
        ) : null}
      </Panel>
    </ScrollView>
    </ScreenBackground>
  );
}

function Centered({ children }) {
  return <View style={styles.centered}>{children}</View>;
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
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarCircle: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: colors.text,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontFamily: fonts.body, fontWeight: '700', color: colors.ink, fontSize: 16 },
  userName: { fontFamily: fonts.heading, fontWeight: '700', color: colors.text, fontSize: 20 },
  userDate: { fontFamily: fonts.body, color: colors.textDim, fontSize: 12, marginTop: 1 },
  powerPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.bgPanel, borderRadius: 999, paddingVertical: 10, paddingHorizontal: 14,
  },
  powerText: { fontFamily: fonts.body, fontWeight: '700', color: colors.text, fontSize: 14 },
  powerIcon: { fontSize: 13 },
  hero: { height: 190, borderRadius: radius.lg, overflow: 'hidden', marginBottom: 12, justifyContent: 'space-between' },
  heroImg: { borderRadius: radius.lg },
  heroScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.38)' },
  heroTop: { padding: 14 },
  heroKicker: { fontFamily: fonts.body, fontWeight: '700', color: colors.text, fontSize: 10, letterSpacing: 2, opacity: 0.9 },
  heroBottom: { flexDirection: 'row', alignItems: 'flex-end', padding: 14, gap: 10 },
  heroTitle: { fontFamily: fonts.heading, fontWeight: '700', color: colors.text, fontSize: 28 },
  heroMeta: { fontFamily: fonts.body, color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 },
  heroCta: {
    backgroundColor: colors.accent, borderRadius: 999, paddingVertical: 12, paddingHorizontal: 22,
  },
  heroCtaText: { fontFamily: fonts.body, fontWeight: '700', color: colors.text, fontSize: 15 },
  weekCard: { paddingVertical: 14 },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between' },
  weekDay: { alignItems: 'center', gap: 4, flex: 1 },
  weekDot: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: colors.bgPanelAlt,
    alignItems: 'center', justifyContent: 'center',
  },
  weekDotDone: { backgroundColor: colors.accent },
  weekDotToday: { borderWidth: 2, borderColor: colors.accentAlt },
  weekDotText: { fontFamily: fonts.body, fontWeight: '700', color: colors.textDim, fontSize: 12 },
  weekLabel: { fontFamily: fonts.body, color: colors.textDim, fontSize: 10 },
  weekStreak: { fontFamily: fonts.body, color: colors.textDim, fontSize: 12, textAlign: 'center', marginTop: 10 },
  beastCard: { alignItems: 'center' },
  barkBubble: {
    backgroundColor: colors.bgPanelAlt, borderRadius: 14,
    paddingHorizontal: 12, paddingVertical: 8, marginBottom: spacing.sm, maxWidth: 300,
  },
  barkText: { fontFamily: fonts.body, color: colors.text, fontSize: 12, textAlign: 'center' },
  powerBig: { fontFamily: fonts.heading, fontWeight: '700', color: colors.text, fontSize: 40, marginTop: 4 },
  powerLabel: { fontFamily: fonts.body, color: colors.textDim, fontSize: 10, letterSpacing: 3, fontWeight: '700' },
  stageName: { fontFamily: fonts.body, color: colors.accentAlt, fontSize: 13, fontWeight: '600', marginTop: 8 },
  evoWrap: { width: '100%', marginTop: 10 },
  evoTrack: { height: 8, backgroundColor: colors.bgPanelAlt, borderRadius: 4, overflow: 'hidden' },
  evoFill: { height: '100%', backgroundColor: colors.accent },
  evoText: { fontFamily: fonts.body, color: colors.textDim, fontSize: 11, marginTop: 6, textAlign: 'center' },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  cardKicker: { fontFamily: fonts.body, fontWeight: '700', color: colors.textDim, fontSize: 10, letterSpacing: 2, marginBottom: 8 },
  statRow: { flexDirection: 'row', gap: 12 },
  statCard: { flex: 1 },
  statValue: { fontFamily: fonts.heading, fontWeight: '700', color: colors.text, fontSize: 26 },
  statGoal: { color: colors.textDim, fontSize: 15 },
  statSub: { fontFamily: fonts.body, color: colors.textDim, fontSize: 11, marginTop: 4 },
  meterTrack: { height: 8, backgroundColor: colors.bgPanelAlt, borderRadius: 4, overflow: 'hidden', marginTop: 10 },
  meterFill: { height: '100%' },
  questLine: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7 },
  questKind: { width: 60, fontFamily: fonts.body, color: colors.textDim, fontSize: 12 },
  questTitle: { flex: 1, fontFamily: fonts.body, color: colors.text, fontSize: 14 },
  questDone: { color: colors.success },
  questReward: { fontFamily: fonts.body, color: colors.accentAlt, fontWeight: '700' },
});
