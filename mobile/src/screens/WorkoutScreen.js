import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TextInput, ScrollView, StyleSheet, ActivityIndicator, Pressable } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api';
import { colors, spacing, fonts } from '../theme';
import { Panel, SectionTitle, PixelButton } from '../components/ui';
import ScreenBackground from '../components/ScreenBackground';
import LevelUpModal from '../components/LevelUpModal';
import { useSettings } from '../settingsStore';
import { saveDraft, loadDraft, clearDraft } from '../workoutDraft';

// Log a workout -> POST /game/workouts/log -> XP tally + level-ups.
//
// Two modes:
//  - PROGRAM: an active program is selected (Programs tab) — the workout IS
//    that program: pick a day, its exercises are pre-loaded, log your sets.
//  - FREE: no program selected — search the full 873-exercise library.
export default function WorkoutScreen() {
  const settings = useSettings();
  // Restore any in-progress workout that survived a tab kill / phone lock.
  const draftRef = useRef(loadDraft());
  const [active, setActive] = useState(null); // { program, suggestedDay }
  const [dayNumber, setDayNumber] = useState(draftRef.current?.dayNumber ?? null);
  const [loadingProgram, setLoadingProgram] = useState(true);
  const [restLeft, setRestLeft] = useState(0); // rest-timer countdown (seconds)
  const [restored, setRestored] = useState(!!draftRef.current);

  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [picked, setPicked] = useState(draftRef.current?.picked || []); // [{ id, name, sets, programDayId? }]
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState(null);
  const [celebrate, setCelebrate] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Load the active program each time the tab gains focus (it can change in Programs).
  useFocusEffect(useCallback(() => {
    let live = true;
    (async () => {
      try {
        const data = await api.getActiveProgram();
        if (!live) return;
        setActive(data && data.program ? data : null);
        // A restored draft keeps its own day; otherwise follow the suggestion.
        if (data && data.program && data.suggestedDay != null && !draftRef.current) {
          setDayNumber(data.suggestedDay);
        }
      } catch {
        if (live) setActive(null);
      } finally {
        if (live) setLoadingProgram(false);
      }
    })();
    return () => { live = false; };
  }, []));

  // Free-mode library search.
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

  const program = active && active.program;
  const day = program ? program.days.find((d) => d.dayNumber === dayNumber) : null;

  // Pre-load the chosen program day's exercises as the workout.
  useEffect(() => {
    // Never clobber a restored in-progress session with the program template.
    if (draftRef.current) {
      draftRef.current = null;
      return;
    }
    if (!day || day.isRest) { if (program) setPicked([]); return; }
    setPicked(
      day.exercises.map((pe) => ({
        id: pe.exerciseId,
        name: (pe.exercise && pe.exercise.name) || pe.exerciseId.replace(/_/g, ' '),
        prescription: `${pe.sets} × ${pe.reps}`,
        sets: Array.from({ length: pe.sets }, () => ({ weight: '', reps: '' })),
        programDayId: day.id,
      }))
    );
    setResult(null);
  }, [program && program.id, dayNumber]);

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
    if (settings.restTimer) setRestLeft(settings.restSeconds);
  };

  // Rest countdown tick.
  useEffect(() => {
    if (restLeft <= 0) return undefined;
    const t = setTimeout(() => setRestLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [restLeft]);

  // Auto-save the in-progress workout on every change (clears when empty).
  useEffect(() => {
    saveDraft(picked, dayNumber);
  }, [picked, dayNumber]);

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
        programDayId: day ? day.id : undefined,
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
      if (settings.levelUpModal && res.levelUps && res.levelUps.length) setCelebrate(res.levelUps);
      setPicked([]);
      setRestLeft(0);
      setRestored(false);
      clearDraft();
    } catch (e) {
      // A network-shaped failure mid-gym is almost always the free server
      // waking from its nap — the sets are safe in the on-device draft.
      const coldStart = /failed to fetch|network|load failed|timed? ?out/i.test(e.message || '');
      setError(
        coldStart
          ? 'Server is waking up (free hosting naps when idle). Your sets are saved on this phone — tap Complete Workout again in ~30 seconds.'
          : e.message
      );
    } finally { setSubmitting(false); }
  };

  if (loadingProgram) {
    return (
      <ScreenBackground name="Workout">
        <View style={styles.centered}><ActivityIndicator color={colors.accent} /></View>
      </ScreenBackground>
    );
  }

  return (
    <ScreenBackground name="Workout">
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.md }}>
      {restored && picked.length > 0 ? (
        <Pressable onPress={() => setRestored(false)} style={styles.restoredChip}>
          <Text style={styles.restoredText}>↻ Restored your unfinished workout — nothing was lost. (tap to dismiss)</Text>
        </Pressable>
      ) : null}
      {program ? (
        <Panel>
          <SectionTitle>{program.name}</SectionTitle>
          <Text style={styles.programHint}>
            Your selected program drives today's battle. Change or clear it in the Programs tab.
          </Text>
          <View style={styles.dayRow}>
            {program.days.map((d) => (
              <Pressable key={d.id} onPress={() => setDayNumber(d.dayNumber)}
                style={[styles.dayChip, d.dayNumber === dayNumber && styles.dayChipActive]}>
                <Text style={[styles.dayChipText, d.dayNumber === dayNumber && styles.dayChipTextActive]}>
                  {d.dayNumber}{active.suggestedDay === d.dayNumber ? ' ★' : ''}
                </Text>
              </Pressable>
            ))}
          </View>
          {day ? <Text style={styles.dayName}>{day.name}{day.isRest ? ' — rest day' : ''}</Text> : null}
        </Panel>
      ) : (
        <Panel>
          <SectionTitle>Add Exercise</SectionTitle>
          <Text style={styles.programHint}>Free battle — or select a program in the Programs tab.</Text>
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
      )}

      {picked.map((p, i) => (
        <Panel key={p.id}>
          <View style={styles.exHeader}>
            <Text style={styles.exName}>{p.name}</Text>
            {p.prescription ? <Text style={styles.prescription}>{p.prescription}</Text> : null}
            <Pressable onPress={() => removeExercise(i)}><Text style={styles.remove}>✕</Text></Pressable>
          </View>
          {p.sets.map((s, j) => (
            <View key={j} style={styles.setRow}>
              <Text style={styles.setNum}>{j + 1}</Text>
              <TextInput style={styles.setInput} placeholder={settings.units} placeholderTextColor={colors.textDim}
                keyboardType="numeric" value={s.weight} onChangeText={(v) => updateSet(i, j, 'weight', v)} />
              <Text style={styles.x}>×</Text>
              <TextInput style={styles.setInput} placeholder="reps" placeholderTextColor={colors.textDim}
                keyboardType="numeric" value={s.reps} onChangeText={(v) => updateSet(i, j, 'reps', v)} />
            </View>
          ))}
          <Pressable onPress={() => addSet(i)}><Text style={styles.addSet}>+ set</Text></Pressable>
        </Panel>
      ))}

      {restLeft > 0 ? (
        <Pressable onPress={() => setRestLeft(0)} style={styles.restChip}>
          <Text style={styles.restText}>⏳ rest {restLeft}s · tap to skip</Text>
        </Pressable>
      ) : null}

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
    <LevelUpModal levelUps={celebrate} onClose={() => setCelebrate(null)} />
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  programHint: { fontFamily: fonts.body, color: colors.textDim, fontSize: 11, marginBottom: 8 },
  dayRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  dayChip: {
    minWidth: 40, alignItems: 'center', paddingVertical: 6, paddingHorizontal: 10,
    backgroundColor: colors.bgPanelAlt, borderRadius: 6, borderWidth: 2, borderColor: colors.border,
  },
  dayChipActive: { borderColor: colors.accent, backgroundColor: '#2c2138' },
  dayChipText: { fontFamily: fonts.body, color: colors.textDim, fontWeight: '700' },
  dayChipTextActive: { color: colors.accent },
  dayName: { fontFamily: fonts.body, color: colors.text, marginTop: 8, fontWeight: '700' },
  input: {
    backgroundColor: colors.bgPanelAlt, color: colors.text, fontFamily: fonts.body,
    borderRadius: 6, borderWidth: 2, borderColor: colors.border, paddingHorizontal: 10, paddingVertical: 8,
  },
  resultRow: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  resultName: { fontFamily: fonts.body, color: colors.text },
  resultParts: { fontFamily: fonts.body, color: colors.textDim, fontSize: 11 },
  exHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  exName: { fontFamily: fonts.body, color: colors.text, fontWeight: '700', flex: 1 },
  prescription: { fontFamily: fonts.body, color: colors.accent, fontSize: 11, marginRight: 8 },
  remove: { color: colors.danger, fontSize: 18, paddingLeft: 12 },
  setRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  setNum: { width: 20, color: colors.textDim, fontFamily: fonts.body },
  setInput: {
    flex: 1, backgroundColor: colors.bgPanelAlt, color: colors.text, fontFamily: fonts.body,
    borderRadius: 6, borderWidth: 2, borderColor: colors.border, paddingHorizontal: 8, paddingVertical: 6, textAlign: 'center',
  },
  x: { color: colors.textDim, paddingHorizontal: 8 },
  addSet: { color: colors.accent, fontFamily: fonts.body, marginTop: 4 },
  restChip: {
    alignSelf: 'center', backgroundColor: 'rgba(26, 20, 32, 0.9)', borderColor: colors.accent,
    borderWidth: 2, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8, marginBottom: 10,
  },
  restText: { fontFamily: fonts.body, color: colors.accent, fontWeight: '700' },
  restoredChip: {
    backgroundColor: 'rgba(26, 20, 32, 0.9)', borderColor: colors.success, borderWidth: 2,
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 10,
  },
  restoredText: { fontFamily: fonts.body, color: colors.success, fontSize: 11, textAlign: 'center' },
  err: { color: colors.danger, fontFamily: fonts.body, marginTop: 8, textAlign: 'center' },
  tally: { fontFamily: fonts.body, fontSize: 16, fontWeight: '700', marginBottom: 2 },
  levelUpBox: { marginTop: 8, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8 },
  levelUp: { fontFamily: fonts.body, color: colors.accent, marginBottom: 2 },
});
