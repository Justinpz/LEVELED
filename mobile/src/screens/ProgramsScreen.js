import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TextInput, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api';
import { colors, spacing, fonts } from '../theme';
import { Panel, SectionTitle, PixelButton } from '../components/ui';

// Programs — browse the starter/suggested library + AI builder (Claude).
export default function ProgramsScreen() {
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [goal, setGoal] = useState('');
  const [days, setDays] = useState('4');
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await api.getPrograms();
      setPrograms(data.programs || []);
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const generate = async () => {
    setGenerating(true); setError(null); setGenerated(null);
    try {
      const res = await api.aiGenerateProgram({ goal, daysPerWeek: Number(days) || 4 });
      setGenerated(res.program);
    } catch (e) { setError(e.message); } finally { setGenerating(false); }
  };

  if (loading) return <View style={styles.centered}><ActivityIndicator color={colors.accent} /></View>;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.md }}
      refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={colors.accent} />}>
      <Panel>
        <SectionTitle>AI Coach</SectionTitle>
        <TextInput style={styles.input} placeholder="Goal (e.g. build my back)" placeholderTextColor={colors.textDim}
          value={goal} onChangeText={setGoal} />
        <TextInput style={[styles.input, { marginTop: 8 }]} placeholder="Days/week" placeholderTextColor={colors.textDim}
          keyboardType="numeric" value={days} onChangeText={setDays} />
        <View style={{ marginTop: 10 }}>
          <PixelButton label={generating ? 'Forging…' : 'Generate Program'} onPress={generate} disabled={generating} />
        </View>
        {error ? <Text style={styles.err}>{error}</Text> : null}
        {generated ? (
          <View style={{ marginTop: 12 }}>
            <Text style={styles.genName}>{generated.name}</Text>
            <Text style={styles.cMeta}>{generated.description}</Text>
            {(generated.days || []).map((d) => (
              <Text key={d.dayNumber} style={styles.dayLine}>
                Day {d.dayNumber}: {d.name} {d.isRest ? '(rest)' : `· ${(d.exercises || []).length} exercises`}
              </Text>
            ))}
          </View>
        ) : null}
      </Panel>

      <Panel>
        <SectionTitle>Suggested Programs</SectionTitle>
        {programs.length === 0 ? <Text style={styles.cMeta}>No programs seeded yet.</Text> : null}
        {programs.map((p) => (
          <View key={p.id} style={styles.progRow}>
            <Text style={styles.progName}>{p.name}</Text>
            <Text style={styles.cMeta}>{p.daysPerWeek} days/wk · {p.durationWeeks} wks{p.isStarter ? ' · starter' : ''}</Text>
          </View>
        ))}
      </Panel>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centered: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  input: {
    backgroundColor: colors.bgPanelAlt, color: colors.text, fontFamily: fonts.body,
    borderRadius: 6, borderWidth: 2, borderColor: colors.border, paddingHorizontal: 10, paddingVertical: 8,
  },
  err: { color: colors.danger, fontFamily: fonts.body, marginTop: 8 },
  genName: { fontFamily: fonts.body, color: colors.accent, fontWeight: '700', fontSize: 16 },
  dayLine: { fontFamily: fonts.body, color: colors.text, fontSize: 12, marginTop: 4 },
  progRow: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  progName: { fontFamily: fonts.body, color: colors.text },
  cMeta: { fontFamily: fonts.body, color: colors.textDim, fontSize: 12, marginTop: 2 },
});
