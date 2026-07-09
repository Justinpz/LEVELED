import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, RefreshControl, Pressable } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api';
import { colors, spacing, fonts } from '../theme';
import { Panel, SectionTitle, PixelButton } from '../components/ui';
import ScreenBackground from '../components/ScreenBackground';

// Special tasks — 3 daily + 3 weekly challenges, plus The Daily Warrior:
// a full book session drawn (randomized) from 365 days of real training.
export default function QuestsScreen() {
  const [daily, setDaily] = useState(null);
  const [weekly, setWeekly] = useState(null);
  const [warrior, setWarrior] = useState(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [d, w, dw] = await Promise.all([
        api.getDailyChallenge(),
        api.getWeeklyChallenge(),
        api.getWarriorChallenge().catch(() => null),
      ]);
      setDaily(d); setWeekly(w); setWarrior(dw);
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const complete = async (challengeId) => {
    if (!challengeId) return;
    setBusy(challengeId); setMsg(null); setError(null);
    try {
      const res = await api.completeChallenge(challengeId);
      const parts = res.targets.join(', ');
      setMsg(`+${res.rewardPts} pts to ${parts}${res.streakShopUnlocked ? ' · Streak Shop unlocked!' : ''}`);
      await load();
    } catch (e) { setError(e.message); } finally { setBusy(null); }
  };

  if (loading) return <View style={styles.centered}><ActivityIndicator color={colors.accent} /></View>;

  const dailyList = (daily && (daily.challenges || (daily.challenge ? [daily.challenge] : []))) || [];
  const weeklyList = (weekly && (weekly.challenges || (weekly.challenge ? [weekly.challenge] : []))) || [];

  return (
    <ScreenBackground name="Quests">
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.md }}
      refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={colors.accent} />}>
      {error ? <Text style={styles.err}>{error}</Text> : null}
      {msg ? <Text style={styles.msg}>{msg}</Text> : null}

      {warrior ? (
        <Panel style={styles.warriorPanel}>
          <SectionTitle>⚔ The Daily Warrior</SectionTitle>
          <Text style={styles.quote}>“{warrior.quote}”</Text>
          <Text style={styles.author}>— {warrior.author} · Day {warrior.bookDay} of 365</Text>
          <View style={styles.divider} />
          {(warrior.homeEdition || []).map((step, i) => (
            <Text key={i} style={styles.step}>▸ {step}</Text>
          ))}
          <Pressable onPress={() => setShowOriginal(!showOriginal)}>
            <Text style={styles.toggle}>{showOriginal ? '▾ hide original gym session' : '▸ show original gym session'}</Text>
          </Pressable>
          {showOriginal ? <Text style={styles.original}>{warrior.originalSession}</Text> : null}
          <View style={{ marginTop: 10 }}>
            {warrior.completed ? (
              <Text style={styles.done}>✓ Conquered today · +{warrior.rewardPts} pts claimed</Text>
            ) : (
              <PixelButton
                label={busy === warrior.challengeId ? '…' : `Conquer (+${warrior.rewardPts} pts)`}
                onPress={() => complete(warrior.challengeId)}
                disabled={!!busy}
              />
            )}
          </View>
        </Panel>
      ) : null}

      <ChallengeList title="Daily Quests" list={dailyList} onComplete={complete} busy={busy} />
      <ChallengeList title="Weekly Quests" list={weeklyList} onComplete={complete} busy={busy} />
    </ScrollView>
    </ScreenBackground>
  );
}

function ChallengeList({ title, list, onComplete, busy }) {
  return (
    <Panel>
      <SectionTitle>{title}</SectionTitle>
      {list.length === 0 ? <Text style={styles.cMeta}>None active.</Text> : null}
      {list.map((c) => (
        <View key={c.id} style={styles.challengeRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.cName, c.completed && styles.cDone]}>
              {c.completed ? '✓ ' : ''}{c.title}
            </Text>
            <Text style={styles.cMeta}>
              {c.difficulty} · +{c.rewardPts} pts
              {c.bodyPartTargets && c.bodyPartTargets.length ? ` · ${c.bodyPartTargets.join(', ')}` : ' · all body'}
            </Text>
          </View>
          {c.completed ? null : (
            <Pressable disabled={!!busy} onPress={() => onComplete(c.id)}>
              <Text style={styles.completeBtn}>{busy === c.id ? '…' : 'Complete'}</Text>
            </Pressable>
          )}
        </View>
      ))}
    </Panel>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  centered: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  err: { color: colors.danger, fontFamily: fonts.body, marginBottom: 8, textAlign: 'center' },
  msg: { color: colors.success, fontFamily: fonts.body, marginBottom: 8, textAlign: 'center' },
  warriorPanel: { borderColor: colors.accent },
  quote: { fontFamily: fonts.body, color: colors.text, fontStyle: 'italic', fontSize: 13, lineHeight: 19 },
  author: { fontFamily: fonts.body, color: colors.accent, fontSize: 11, marginTop: 4 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 10 },
  step: { fontFamily: fonts.body, color: colors.text, fontSize: 12, lineHeight: 18, marginBottom: 4 },
  toggle: { fontFamily: fonts.body, color: colors.textDim, fontSize: 11, marginTop: 6 },
  original: { fontFamily: fonts.body, color: colors.textDim, fontSize: 11, lineHeight: 16, marginTop: 6 },
  done: { fontFamily: fonts.body, color: colors.success, fontWeight: '700', textAlign: 'center' },
  challengeRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  cName: { fontFamily: fonts.body, color: colors.text, fontSize: 14 },
  cDone: { color: colors.success },
  cMeta: { fontFamily: fonts.body, color: colors.textDim, fontSize: 11, marginTop: 2 },
  completeBtn: { fontFamily: fonts.body, color: colors.accent, fontWeight: '700', paddingLeft: 12 },
});
