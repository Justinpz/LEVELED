import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, ActivityIndicator, Pressable } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api';
import { colors, spacing, fonts, glass } from '../theme';
import { Panel, SectionTitle, PixelButton } from '../components/ui';

// Programs — pick a starter, forge one from a goal (smart generator / AI),
// or build your own. The selected program becomes the Workout tab's plan.
// Rendered as a section inside Settings (the host screen provides scrolling).
export default function ProgramsPanel() {
  const [programs, setPrograms] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [goal, setGoal] = useState('');
  const [days, setDays] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(null);
  const [error, setError] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showBuilder, setShowBuilder] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [data, active] = await Promise.all([
        api.getPrograms(),
        api.getActiveProgram().catch(() => null),
      ]);
      setPrograms(data.programs || []);
      setActiveId(active && active.program ? active.program.id : null);
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const generate = async () => {
    setGenerating(true); setError(null); setGenerated(null);
    try {
      const res = await api.aiGenerateProgram({ goal, daysPerWeek: days ? Number(days) : undefined });
      setGenerated(res.program);
    } catch (e) { setError(e.message); } finally { setGenerating(false); }
  };

  const saveGenerated = async (alsoSelect) => {
    setBusy(true); setError(null);
    try {
      const res = await api.createProgram(generated);
      if (alsoSelect && res.program) await api.selectProgram(res.program.id);
      setGenerated(null); setGoal('');
      setMsg(alsoSelect ? 'Program saved & selected — see the Workout tab.' : 'Program saved.');
      await load();
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  const select = async (id) => {
    setBusy(true); setError(null); setMsg(null);
    try {
      if (id === activeId) {
        await api.clearProgram();
        setActiveId(null);
        setMsg('Program cleared — Workout tab is back to free battles.');
      } else {
        await api.selectProgram(id);
        setActiveId(id);
        setMsg('Selected — the Workout tab now runs this program.');
      }
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  if (loading) return <View style={{ paddingVertical: 24, alignItems: 'center' }}><ActivityIndicator color={colors.accent} /></View>;

  return (
    <View>
      {msg ? <Text style={styles.msg}>{msg}</Text> : null}

      <Panel>
        <SectionTitle>Forge a Program</SectionTitle>
        <Text style={styles.hint}>
          Say what you want — "quick arm workout", "quad focused, light on the knees", "3 day dumbbell plan"…
        </Text>
        <TextInput style={styles.input} placeholder="What do you want to train?" placeholderTextColor={colors.textDim}
          value={goal} onChangeText={setGoal} />
        <TextInput style={[styles.input, { marginTop: 8 }]} placeholder="Days/week (optional)" placeholderTextColor={colors.textDim}
          keyboardType="numeric" value={days} onChangeText={setDays} />
        <View style={{ marginTop: 10 }}>
          <PixelButton label={generating ? 'Forging…' : 'Generate Program'} onPress={generate} disabled={generating || !goal.trim()} />
        </View>
        {error ? <Text style={styles.err}>{error}</Text> : null}
        {generated ? (
          <View style={{ marginTop: 12 }}>
            <Text style={styles.genName}>{generated.name}</Text>
            <Text style={styles.cMeta}>{generated.description}</Text>
            {(generated.days || []).map((d) => (
              <View key={d.dayNumber} style={{ marginTop: 6 }}>
                <Text style={styles.dayLine}>Day {d.dayNumber}: {d.name}{d.isRest ? ' (rest)' : ''}</Text>
                {(d.exercises || []).map((e, i) => (
                  <Text key={i} style={styles.exLine}>   {e.exerciseId.replace(/_/g, ' ')} — {e.sets}×{e.reps}</Text>
                ))}
              </View>
            ))}
            <View style={styles.saveRow}>
              <View style={{ flex: 1 }}>
                <PixelButton label={busy ? '…' : 'Save & Select'} onPress={() => saveGenerated(true)} disabled={busy} />
              </View>
              <Pressable disabled={busy} onPress={() => saveGenerated(false)}>
                <Text style={styles.saveOnly}>save only</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </Panel>

      <Panel>
        <SectionTitle>Programs</SectionTitle>
        <Text style={styles.hint}>Select one and the Workout tab serves its days. Tap again to clear.</Text>
        {programs.length === 0 ? <Text style={styles.cMeta}>No programs yet — forge or build one.</Text> : null}
        {programs.map((p) => (
          <View key={p.id} style={styles.progRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.progName}>{p.id === activeId ? '▶ ' : ''}{p.name}</Text>
              <Text style={styles.cMeta}>
                {p.daysPerWeek} days/wk · {p.durationWeeks} wks{p.isStarter ? ' · starter' : ''}
                {p.description ? `\n${p.description}` : ''}
              </Text>
            </View>
            <Pressable disabled={busy} onPress={() => select(p.id)}>
              <Text style={[styles.selectBtn, p.id === activeId && styles.selectedBtn]}>
                {p.id === activeId ? 'Active' : 'Select'}
              </Text>
            </Pressable>
          </View>
        ))}
      </Panel>

      <Panel>
        <Pressable onPress={() => setShowBuilder(!showBuilder)}>
          <SectionTitle>{showBuilder ? '▾ Build Your Own' : '▸ Build Your Own'}</SectionTitle>
        </Pressable>
        {showBuilder ? <ProgramBuilder onSaved={async () => { setMsg('Custom program saved.'); await load(); }} /> : null}
      </Panel>
    </View>
  );
}

// Manual builder: name your program, add days, fill each day from the library.
function ProgramBuilder({ onSaved }) {
  const [name, setName] = useState('');
  const [buildDays, setBuildDays] = useState([{ name: 'Day 1', exercises: [] }]);
  const [dayIdx, setDayIdx] = useState(0);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [customOpen, setCustomOpen] = useState(false);
  const [customPrimary, setCustomPrimary] = useState(null);
  const [creatingCustom, setCreatingCustom] = useState(false);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (search.trim().length < 2) { setResults([]); return; }
      try {
        const data = await api.getExercises(`?search=${encodeURIComponent(search)}&take=10`);
        setResults(data.items);
      } catch (e) { setError(e.message); }
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const addDay = () => {
    setBuildDays([...buildDays, { name: `Day ${buildDays.length + 1}`, exercises: [] }]);
    setDayIdx(buildDays.length);
  };

  const addExercise = (ex) => {
    const next = [...buildDays];
    if (next[dayIdx].exercises.find((e) => e.id === ex.id)) return;
    next[dayIdx].exercises.push({ id: ex.id, name: ex.name, sets: '3', reps: '8-12', bodyParts: ex.bodyParts || [] });
    setBuildDays(next);
    setSearch(''); setResults([]);
    setCustomOpen(false); setCustomPrimary(null);
  };

  // Add a movement the library doesn't have — same flow as the Workout tab:
  // it becomes a real, searchable, XP-earning exercise.
  const createCustom = async () => {
    if (!customPrimary || creatingCustom) return;
    setCreatingCustom(true); setError(null);
    try {
      const res = await api.createCustomExercise({ name: search.trim(), primaryBodyPart: customPrimary });
      addExercise({ ...res.exercise, bodyParts: res.exercise.primaryBodyParts || [] });
    } catch (e) { setError(e.message); } finally { setCreatingCustom(false); }
  };

  const removeExercise = (i) => {
    const next = [...buildDays];
    next[dayIdx].exercises.splice(i, 1);
    setBuildDays(next);
  };

  const updateEx = (i, field, val) => {
    const next = [...buildDays];
    next[dayIdx].exercises[i][field] = val;
    setBuildDays(next);
  };

  const canSave = name.trim() && buildDays.some((d) => d.exercises.length > 0);

  const save = async () => {
    setSaving(true); setError(null);
    try {
      const days = buildDays
        .filter((d) => d.exercises.length > 0)
        .map((d, di) => ({
          dayNumber: di + 1,
          name: d.name,
          isRest: false,
          bodyParts: [...new Set(d.exercises.flatMap((e) => e.bodyParts))],
          exercises: d.exercises.map((e, i) => ({
            exerciseId: e.id,
            series: 'ABCD'[Math.min(Math.floor(i / 2), 3)],
            orderInSeries: (i % 2) + 1,
            sets: Number(e.sets) || 3,
            reps: e.reps || '8-12',
            restSeconds: 90,
          })),
        }));
      await api.createProgram({ name: name.trim(), description: 'Custom-built program', durationWeeks: 4, daysPerWeek: days.length, days });
      setName(''); setBuildDays([{ name: 'Day 1', exercises: [] }]); setDayIdx(0);
      onSaved && onSaved();
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  };

  const day = buildDays[dayIdx];

  return (
    <View>
      <TextInput style={styles.input} placeholder="Program name" placeholderTextColor={colors.textDim}
        value={name} onChangeText={setName} />
      <View style={styles.dayTabs}>
        {buildDays.map((d, i) => (
          <Pressable key={i} onPress={() => setDayIdx(i)}
            style={[styles.dayChip, i === dayIdx && styles.dayChipActive]}>
            <Text style={[styles.dayChipText, i === dayIdx && styles.dayChipTextActive]}>{i + 1}</Text>
          </Pressable>
        ))}
        <Pressable onPress={addDay} style={styles.dayChip}>
          <Text style={styles.dayChipText}>+</Text>
        </Pressable>
      </View>
      {day.exercises.map((e, i) => (
        <View key={e.id} style={styles.builderExRow}>
          <Text style={styles.builderExName}>{e.name}</Text>
          <TextInput style={styles.tinyInput} keyboardType="numeric" value={e.sets}
            onChangeText={(v) => updateEx(i, 'sets', v)} />
          <Text style={styles.x}>×</Text>
          <TextInput style={styles.tinyInput} value={e.reps}
            onChangeText={(v) => updateEx(i, 'reps', v)} />
          <Pressable onPress={() => removeExercise(i)}><Text style={styles.remove}>✕</Text></Pressable>
        </View>
      ))}
      <TextInput style={[styles.input, { marginTop: 8 }]} placeholder="Search exercises to add…" placeholderTextColor={colors.textDim}
        value={search} onChangeText={setSearch} />
      {results.map((ex) => (
        <Pressable key={ex.id} onPress={() => addExercise(ex)} style={styles.resultRow}>
          <Text style={styles.resultName}>{ex.name}</Text>
          <Text style={styles.cMeta}>{(ex.bodyParts || []).join(' · ')}</Text>
        </Pressable>
      ))}
      {search.trim().length >= 2 ? (
        !customOpen ? (
          <Pressable onPress={() => setCustomOpen(true)} style={{ paddingVertical: 10 }}>
            <Text style={styles.customText}>
              {results.length === 0 ? 'Not in the library? ' : ''}+ Create “{search.trim()}”
            </Text>
          </Pressable>
        ) : (
          <View style={styles.customBox}>
            <Text style={styles.customLabel}>WHICH BODY PART EARNS THE XP?</Text>
            <View style={styles.bpRow}>
              {['Arms', 'Legs', 'Chest', 'Back', 'Core'].map((bp) => (
                <Pressable key={bp} onPress={() => setCustomPrimary(bp)}
                  style={[styles.bpChip, customPrimary === bp && { borderColor: colors[bp], backgroundColor: colors.bgPanelAlt }]}>
                  <Text style={[styles.bpChipText, customPrimary === bp && { color: colors[bp] }]}>{bp}</Text>
                </Pressable>
              ))}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10 }}>
              <Pressable disabled={!customPrimary || creatingCustom} onPress={createCustom}
                style={[styles.customCreateBtn, (!customPrimary || creatingCustom) && { opacity: 0.4 }]}>
                <Text style={styles.customCreateText}>{creatingCustom ? '…' : `CREATE “${search.trim().slice(0, 24)}”`}</Text>
              </Pressable>
              <Pressable onPress={() => { setCustomOpen(false); setCustomPrimary(null); }}>
                <Text style={styles.cMeta}>cancel</Text>
              </Pressable>
            </View>
          </View>
        )
      ) : null}
      {error ? <Text style={styles.err}>{error}</Text> : null}
      <View style={{ marginTop: 10 }}>
        <PixelButton label={saving ? 'Saving…' : 'Save Program'} onPress={save} disabled={saving || !canSave} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  centered: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  hint: { fontFamily: fonts.body, color: colors.textDim, fontSize: 11, marginBottom: 8 },
  input: {
    backgroundColor: colors.bgPanelAlt, color: colors.text, fontFamily: fonts.body,
    borderRadius: 6, borderWidth: 2, borderColor: colors.border, paddingHorizontal: 10, paddingVertical: 8,
  },
  err: { color: colors.danger, fontFamily: fonts.body, marginTop: 8 },
  msg: { color: colors.success, fontFamily: fonts.body, marginBottom: 8, textAlign: 'center' },
  genName: { fontFamily: fonts.body, color: colors.accent, fontWeight: '700', fontSize: 16 },
  dayLine: { fontFamily: fonts.body, color: colors.text, fontSize: 12 },
  exLine: { fontFamily: fonts.body, color: colors.textDim, fontSize: 11 },
  saveRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 12 },
  saveOnly: { fontFamily: fonts.body, color: colors.textDim, fontSize: 12, padding: 8 },
  progRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  progName: { fontFamily: fonts.body, color: colors.text, fontWeight: '700' },
  cMeta: { fontFamily: fonts.body, color: colors.textDim, fontSize: 12, marginTop: 2 },
  selectBtn: { fontFamily: fonts.body, color: colors.accent, fontWeight: '700', paddingLeft: 12 },
  selectedBtn: { color: colors.success },
  dayTabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8, marginBottom: 4 },
  dayChip: {
    minWidth: 36, alignItems: 'center', paddingVertical: 6, paddingHorizontal: 10,
    backgroundColor: colors.bgPanelAlt, borderRadius: 6, borderWidth: 2, borderColor: colors.border,
  },
  dayChipActive: { borderColor: colors.accent },
  dayChipText: { fontFamily: fonts.body, color: colors.textDim, fontWeight: '700' },
  dayChipTextActive: { color: colors.accent },
  builderExRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border },
  builderExName: { flex: 1, fontFamily: fonts.body, color: colors.text, fontSize: 12 },
  tinyInput: {
    width: 52, backgroundColor: colors.bgPanelAlt, color: colors.text, fontFamily: fonts.body,
    borderRadius: 6, borderWidth: 2, borderColor: colors.border, paddingHorizontal: 4, paddingVertical: 4, textAlign: 'center', fontSize: 11,
  },
  x: { color: colors.textDim, paddingHorizontal: 4 },
  remove: { color: colors.danger, fontSize: 14, paddingLeft: 8 },
  resultRow: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  resultName: { fontFamily: fonts.body, color: colors.text, fontSize: 13 },
  customText: { fontFamily: fonts.body, color: colors.accent, fontWeight: '700', fontSize: 13 },
  customBox: {
    marginTop: 8, padding: 10, backgroundColor: glass.deep,
    borderRadius: 8, borderWidth: 1, borderColor: colors.border,
  },
  customLabel: { fontFamily: fonts.body, color: colors.textDim, fontSize: 9, fontWeight: '700', letterSpacing: 1, marginBottom: 8 },
  bpRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  bpChip: {
    paddingVertical: 6, paddingHorizontal: 12, backgroundColor: colors.bgPanelAlt,
    borderRadius: 6, borderWidth: 2, borderColor: colors.border,
  },
  bpChipText: { fontFamily: fonts.body, color: colors.textDim, fontWeight: '700', fontSize: 12 },
  customCreateBtn: {
    backgroundColor: colors.accent, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: colors.ink,
  },
  customCreateText: { fontFamily: fonts.body, color: colors.ink, fontWeight: '700', fontSize: 11, letterSpacing: 0.5 },
});
