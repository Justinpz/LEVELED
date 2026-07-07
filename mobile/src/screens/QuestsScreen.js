import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api';
import { colors, spacing, fonts } from '../theme';
import { Panel, SectionTitle, PixelButton } from '../components/ui';

// Special tasks — daily & weekly challenges; completing routes XP to body parts.
export default function QuestsScreen() {
  const [daily, setDaily] = useState(null);
  const [weekly, setWeekly] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [d, w] = await Promise.all([api.getDailyChallenge(), api.getWeeklyChallenge()]);
      setDaily(d); setWeekly(w);
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const complete = async (challenge) => {
    if (!challenge) return;
    setBusy(true); setMsg(null);
    try {
      const res = await api.completeChallenge(challenge.id);
      const parts = res.targets.join(', ');
      setMsg(`+${res.rewardPts} pts to ${parts}${res.streakShopUnlocked ? ' · Streak Shop unlocked!' : ''}`);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  if (loading) return <View style={styles.centered}><ActivityIndicator color={colors.accent} /></View>;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.md }}
      refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={colors.accent} />}>
      {error ? <Text style={styles.err}>{error}</Text> : null}
      {msg ? <Text style={styles.msg}>{msg}</Text> : null}
      <ChallengeCard title="Daily Challenge" challenge={daily && daily.challenge} onComplete={complete} busy={busy} />
      <ChallengeCard title="Weekly Challenge" challenge={weekly && weekly.challenge} onComplete={complete} busy={busy} />
    </ScrollView>
  );
}

function ChallengeCard({ title, challenge, onComplete, busy }) {
  return (
    <Panel>
      <SectionTitle>{title}</SectionTitle>
      {challenge ? (
        <>
          <Text style={styles.cName}>{challenge.title}</Text>
          <Text style={styles.cMeta}>
            {challenge.difficulty} · +{challenge.rewardPts} pts
            {challenge.bodyPartTargets && challenge.bodyPartTargets.length ? ` · ${challenge.bodyPartTargets.join(', ')}` : ' · all body'}
          </Text>
          <View style={{ marginTop: 10 }}>
            <PixelButton label={busy ? '…' : 'Complete'} onPress={() => onComplete(challenge)} disabled={busy} />
          </View>
        </>
      ) : (
        <Text style={styles.cMeta}>None active.</Text>
      )}
    </Panel>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centered: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  err: { color: colors.danger, fontFamily: fonts.body, marginBottom: 8, textAlign: 'center' },
  msg: { color: colors.success, fontFamily: fonts.body, marginBottom: 8, textAlign: 'center' },
  cName: { fontFamily: fonts.body, color: colors.text, fontSize: 16 },
  cMeta: { fontFamily: fonts.body, color: colors.textDim, fontSize: 12, marginTop: 4 },
});
