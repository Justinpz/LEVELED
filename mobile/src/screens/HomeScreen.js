import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, ActivityIndicator, Image } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api';
import { colors, spacing, fonts } from '../theme';
import { Panel, SectionTitle } from '../components/ui';
import XPBar from '../components/XPBar';
import ScreenBackground from '../components/ScreenBackground';
import { avatarForLevel } from '../assets';

// Home hub — the character and their five progression tracks + today's quests.
export default function HomeScreen() {
  const [progress, setProgress] = useState(null);
  const [daily, setDaily] = useState(null);
  const [weekly, setWeekly] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [p, d, w] = await Promise.all([
        api.getProgress(),
        api.getDailyChallenge().catch(() => null),
        api.getWeeklyChallenge().catch(() => null),
      ]);
      setProgress(p);
      setDaily(d);
      setWeekly(w);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) return <Centered><ActivityIndicator color={colors.accent} /></Centered>;
  if (error) return <Centered><Text style={styles.err}>Can't reach the realm.{'\n'}{error}</Text></Centered>;

  const overall = progress ? Math.round(progress.progress.reduce((s, p) => s + p.level, 0) / progress.progress.length) : 1;
  const avatar = avatarForLevel(overall);

  return (
    <ScreenBackground name="Home">
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: spacing.md }}
      refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={colors.accent} />}
    >
      <Panel style={styles.hero}>
        <View style={styles.avatarBox}>
          {avatar ? (
            <Image source={avatar} style={styles.avatar} resizeMode="contain" />
          ) : (
            <Text style={styles.avatarPlaceholder}>⚔</Text>
          )}
        </View>
        <Text style={styles.className}>WARRIOR</Text>
        <Text style={styles.overall}>Avg Level {overall}</Text>
      </Panel>

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
        <QuestLine kind="Daily" challenge={daily && daily.challenge} />
        <QuestLine kind="Weekly" challenge={weekly && weekly.challenge} />
      </Panel>
    </ScrollView>
    </ScreenBackground>
  );
}

function QuestLine({ kind, challenge }) {
  return (
    <View style={styles.questLine}>
      <Text style={styles.questKind}>{kind}</Text>
      <Text style={styles.questTitle}>{challenge ? challenge.title : 'None active'}</Text>
      {challenge ? <Text style={styles.questReward}>+{challenge.rewardPts}</Text> : null}
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
  avatarBox: {
    width: 180, height: 240, alignItems: 'center', justifyContent: 'center',
    // Matches the avatar art's near-black background for seamless compositing.
    backgroundColor: '#0b0a10', borderRadius: 8, marginBottom: spacing.sm,
    borderWidth: 2, borderColor: colors.border, overflow: 'hidden',
  },
  avatar: { width: '100%', height: '100%' },
  avatarPlaceholder: { fontSize: 72, color: colors.textDim },
  className: { fontFamily: fonts.heading, fontSize: 22, fontWeight: '700', color: colors.accent, letterSpacing: 3 },
  overall: { fontFamily: fonts.body, color: colors.textDim, marginTop: 2 },
  questLine: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  questKind: { width: 64, fontFamily: fonts.body, color: colors.textDim, fontSize: 12 },
  questTitle: { flex: 1, fontFamily: fonts.body, color: colors.text },
  questReward: { fontFamily: fonts.body, color: colors.accent, fontWeight: '700' },
});
