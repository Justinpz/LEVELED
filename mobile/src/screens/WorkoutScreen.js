import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, ScrollView, FlatList, StyleSheet, ActivityIndicator, Pressable } from 'react-native';
import { api } from '../api';
import { colors, spacing, fonts } from '../theme';
import { Panel, SectionTitle, PixelButton } from '../components/ui';
import ScreenBackground from '../components/ScreenBackground';

// Log a workout -> POST /game/workouts/log -> XP tally + level-ups.
export default function WorkoutScreen() {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [picked, setPicked] = useState([]); // [{ id, name, sets:[{weight,reps}] }]
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (search.trim().length < 2) { setResults([]); return; }
      setSearching(true);
      try {
        const data = await api.getExercises(`?search=${encodeURIComponent(search)}&take=20`);
        setResults(data.items);
      } catch (e) { setError(e.message); } finally { setSearching(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const addExercise = (ex) => {
    if (picked.find((p) => p.id === ex.id)) return;
    setPicked([...picked, { id: ex.id, name: ex.name, sets: [{ weight: '', reps: '' }] }]);
    setSearch('');
    setResults([]);
  };

  const addSet = (i) => {
    const next = [...picked];
    next[i].sets.push({ weight: '', reps: '' });
    setPicked(next);
  };

  const updateSet = (i, j, field, val) => {
    const next = [...picked];
    next[i].sets[j][field] = val;
    setPicked(next);
  };

  const removeExercise = (i) => setPicked(picked.filter((_, idx) => idx !== i));

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      const payload = {
        exercises: picked.map((p) => ({
          exerciseId: p.id,
          sets: p.sets.map((s) => ({
            weight: s.weight ? Number(s.weight) : null,
            reps: s.reps ? Number(s.reps) : null,
          })),
        })),
      };
      const res = await api.logWorkout(payload);
      setResult(res);
      setPicked([]);
    } catch (e) { setError(e.message); } finally { setSubmitting(false); }
  };

  return (
    <ScreenBackground name="Workout">
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.md }}>
      <Panel>
        <SectionTitle>Add Exercise</SectionTitle>
        <TextInput
          style={styles.input}
          placeholder="Search 873 exercises…"
          placeholderTextColor={colors.textDim}
          value={search}
          onChangeText={setSearch}
        />
        {searching ? <ActivityIndicator color={colors.accent} style={{ marginTop: 8 }} /> : null}
        {results.map((ex) => (
          <Pressable key={ex.id} onPress={() => addExercise(ex)} style={styles.resultRow}>
            <Text style={styles.resultName}>{ex.name}</Text>
            <Text style={styles.resultParts}>{(ex.bodyParts || []).join(' · ')}</Text>
          </Pressable>
        ))}
      </Panel>

      {picked.map((p, i) => (
        <Panel key={p.id}>
          <View style={styles.exHeader}>
            <Text style={styles.exName}>{p.name}</Text>
            <Pressable onPress={() => removeExercise(i)}><Text style={styles.remove}>✕</Text></Pressable>
          </View>
          {p.sets.map((s, j) => (
            <View key={j} style={styles.setRow}>
              <Text style={styles.setNum}>{j + 1}</Text>
              <TextInput style={styles.setInput} placeholder="wt" placeholderTextColor={colors.textDim}
                keyboardType="numeric" value={s.weight} onChangeText={(v) => updateSet(i, j, 'weight', v)} />
              <Text style={styles.x}>×</Text>
              <TextInput style={styles.setInput} placeholder="reps" placeholderTextColor={colors.textDim}
                keyboardType="numeric" value={s.reps} onChangeText={(v) => updateSet(i, j, 'reps', v)} />
            </View>
          ))}
          <Pressable onPress={() => addSet(i)}><Text style={styles.addSet}>+ set</Text></Pressable>
        </Panel>
      ))}

      {picked.length > 0 ? (
        <PixelButton label={submitting ? 'Logging…' : 'Complete Workout'} onPress={submit} disabled={submitting} />
      ) : null}

      {error ? <Text style={styles.err}>{error}</Text> : null}

      {result ? (
        <Panel style={{ marginTop: spacing.md }}>
          <SectionTitle>XP Gained</SectionTitle>
          {Object.entries(result.tally).map(([bp, pts]) => (
            <Text key={bp} style={[styles.tally, { color: colors[bp] }]}>{bp}: +{pts}</Text>
          ))}
          {result.levelUps && result.levelUps.length > 0 ? (
            <View style={styles.levelUpBox}>
              {result.levelUps.map((lu, k) => (
                <Text key={k} style={styles.levelUp}>⬆ {lu.bodyPart} reached Lv {lu.to}! ({lu.band})</Text>
              ))}
            </View>
          ) : null}
        </Panel>
      ) : null}
    </ScrollView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  input: {
    backgroundColor: colors.bgPanelAlt, color: colors.text, fontFamily: fonts.body,
    borderRadius: 6, borderWidth: 2, borderColor: colors.border, paddingHorizontal: 10, paddingVertical: 8,
  },
  resultRow: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  resultName: { fontFamily: fonts.body, color: colors.text },
  resultParts: { fontFamily: fonts.body, color: colors.textDim, fontSize: 11 },
  exHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  exName: { fontFamily: fonts.body, color: colors.text, fontWeight: '700', flex: 1 },
  remove: { color: colors.danger, fontSize: 18, paddingLeft: 12 },
  setRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  setNum: { width: 20, color: colors.textDim, fontFamily: fonts.body },
  setInput: {
    flex: 1, backgroundColor: colors.bgPanelAlt, color: colors.text, fontFamily: fonts.body,
    borderRadius: 6, borderWidth: 2, borderColor: colors.border, paddingHorizontal: 8, paddingVertical: 6, textAlign: 'center',
  },
  x: { color: colors.textDim, paddingHorizontal: 8 },
  addSet: { color: colors.accent, fontFamily: fonts.body, marginTop: 4 },
  err: { color: colors.danger, fontFamily: fonts.body, marginTop: 8, textAlign: 'center' },
  tally: { fontFamily: fonts.body, fontSize: 16, fontWeight: '700', marginBottom: 2 },
  levelUpBox: { marginTop: 8, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8 },
  levelUp: { fontFamily: fonts.body, color: colors.accent, marginBottom: 2 },
});
