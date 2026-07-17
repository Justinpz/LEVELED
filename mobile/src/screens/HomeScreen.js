import React, { useState, useCallback, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, ActivityIndicator, Image, Pressable, Animated } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api';
import { colors, spacing, fonts, glass, tierColors } from '../theme';
import { Panel, SectionTitle } from '../components/ui';
import XPBar from '../components/XPBar';
import ScreenBackground from '../components/ScreenBackground';
import { gearImage } from '../assets';
import WarriorFigure from '../components/WarriorFigure';
import { barkFor } from '../barks';
import { useSettings } from '../settingsStore';

const SLOT_ORDER_LEFT = ['arms', 'chest'];
const SLOT_ORDER_RIGHT = ['back', 'legs', 'core'];
const SLOT_ICONS = { arms: '🛡', chest: '⛨', back: '🎒', legs: '🥾', core: '⚙' };

// Home hub — the living character (tap him!), his worn gear, five progression
// tracks, today's quests, and the food-driven health meter.
export default function HomeScreen() {
  const settings = useSettings();
  const [progress, setProgress] = useState(null);
  const [daily, setDaily] = useState(null);
  const [weekly, setWeekly] = useState(null);
  const [food, setFood] = useState(null);
  const [equipped, setEquipped] = useState({}); // slot -> gear item
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [bark, setBark] = useState(null);

  const bounce = useRef(new Animated.Value(0)).current;
  const barkTimer = useRef(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [p, d, w, f, shop] = await Promise.all([
        api.getProgress(),
        api.getDailyChallenge().catch(() => null),
        api.getWeeklyChallenge().catch(() => null),
        api.getFoodToday().catch(() => null),
        api.getShop().catch(() => null),
      ]);
      setProgress(p);
      setDaily(d);
      setWeekly(w);
      setFood(f);
      if (shop) {
        const bySlot = {};
        for (const it of shop.items) if (it.equipped) bySlot[it.slot] = it;
        setEquipped(bySlot);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const overall = progress ? Math.round(progress.progress.reduce((s, p) => s + p.level, 0) / progress.progress.length) : 1;
  const tier = Math.min(5, Math.max(1, Math.ceil(overall / 20)));
  const streak = (progress && progress.currentStreak) || 0;
  const equippedSlots = Object.keys(equipped);

  const pokeAvatar = () => {
    if (settings.animations) {
      // Flex bounce: quick squash-and-jump, like he's hitting a rep.
      bounce.setValue(0);
      Animated.sequence([
        Animated.timing(bounce, { toValue: 1, duration: 120, useNativeDriver: true }),
        Animated.spring(bounce, { toValue: 0, friction: 3, tension: 160, useNativeDriver: true }),
      ]).start();
    }
    if (settings.barks) {
      setBark(barkFor(tier, streak));
      if (barkTimer.current) clearTimeout(barkTimer.current);
      barkTimer.current = setTimeout(() => setBark(null), 3500);
    }
  };

  if (loading) return <Centered><ActivityIndicator color={colors.accent} /></Centered>;
  if (error) return <Centered><Text style={styles.err}>Can't reach the realm.{'\n'}{error}</Text></Centered>;

  const translateY = bounce.interpolate({ inputRange: [0, 1], outputRange: [0, -14] });
  const scaleX = bounce.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });

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
        <View style={styles.dollRow}>
          <View style={styles.slotColumn}>
            {SLOT_ORDER_LEFT.map((slot) => <GearSlot key={slot} slot={slot} item={equipped[slot]} />)}
          </View>
          <Pressable onPress={pokeAvatar} hitSlop={8}>
            <Animated.View style={[styles.avatarBox, { transform: [{ translateY }, { scaleX }] }]}>
              <WarriorFigure tier={tier} equippedSlots={equippedSlots} width={176} height={236} animate={settings.animations} />
            </Animated.View>
          </Pressable>
          <View style={styles.slotColumn}>
            {SLOT_ORDER_RIGHT.map((slot) => <GearSlot key={slot} slot={slot} item={equipped[slot]} />)}
          </View>
        </View>
        <Text style={styles.className}>WARRIOR</Text>
        {settings.displayName ? <Text style={styles.displayName}>{settings.displayName}</Text> : null}
        <Text style={styles.overall}>
          Avg Level {overall}{streak > 0 ? `  ·  🔥 ${streak} day${streak === 1 ? '' : 's'}` : ''}
        </Text>
        <Text style={styles.tapHint}>tap him</Text>
      </Panel>

      {food ? <HealthMeter food={food} /> : null}

      <Panel>
        <SectionTitle>Body</SectionTitle>
        {progress.progress.map((p) => (
          <XPBar
            key={p.bodyPart}
            label={p.bodyPart}
            level={p.level}
            lifetimeXp={p.lifetimeXp}
            nextLevelXp={p.nextLevelXp}
            color={colors[p.bodyPart]}
          />
        ))}
      </Panel>

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

// One paper-doll slot: the worn item's art (tier-colored border) or a dim empty socket.
function GearSlot({ slot, item }) {
  const img = item ? gearImage(item.tier, item.slot, item.id) : null;
  return (
    <View style={[styles.gearSlot, item && { borderColor: tierColors[item.tier] || colors.border }]}>
      {img ? (
        <Image source={img} style={styles.gearSlotImg} resizeMode="contain" />
      ) : (
        <Text style={styles.gearSlotEmpty}>{SLOT_ICONS[slot]}</Text>
      )}
      <Text style={styles.gearSlotLabel} numberOfLines={1}>{item ? item.name : slot}</Text>
    </View>
  );
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

function Centered({ children }) {
  return <View style={styles.centered}>{children}</View>;
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
  dollRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  slotColumn: { justifyContent: 'center', gap: 8, width: 64 },
  gearSlot: {
    width: 64, alignItems: 'center', paddingVertical: 4,
    backgroundColor: glass.deep, borderRadius: 8,
    borderWidth: 1, borderColor: colors.border,
  },
  gearSlotImg: { width: 44, height: 44 },
  gearSlotEmpty: { fontSize: 22, color: colors.textDim, opacity: 0.35, lineHeight: 44 },
  gearSlotLabel: { fontFamily: fonts.body, color: colors.textDim, fontSize: 7, marginTop: 2, maxWidth: 58 },
  avatarBox: {
    width: 180, height: 240, alignItems: 'center', justifyContent: 'center',
    // Matches the avatar art's near-black background for seamless compositing.
    backgroundColor: colors.ink, borderRadius: 8, marginBottom: spacing.sm,
    borderWidth: 1, borderColor: colors.border, overflow: 'hidden',
  },
  avatar: { width: '100%', height: '100%' },
  avatarPlaceholder: { fontSize: 72, color: colors.textDim },
  className: { fontFamily: fonts.heading, fontSize: 22, fontWeight: '700', color: colors.accent, letterSpacing: 3 },
  displayName: { fontFamily: fonts.body, color: colors.text, fontSize: 13, marginTop: 1 },
  overall: { fontFamily: fonts.body, color: colors.textDim, marginTop: 2 },
  tapHint: { fontFamily: fonts.body, color: colors.textDim, fontSize: 9, marginTop: 4, opacity: 0.6 },
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
