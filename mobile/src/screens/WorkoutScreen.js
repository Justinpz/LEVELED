import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { View, Text, TextInput, ScrollView, StyleSheet, ActivityIndicator, Pressable, Modal, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api';
import { colors, spacing, fonts } from '../theme';
import { Panel, SectionTitle } from '../components/ui';
import ScreenBackground from '../components/ScreenBackground';
import LevelUpModal from '../components/LevelUpModal';
import { useSettings } from '../settingsStore';
import { saveDraft, loadDraft, clearDraft } from '../workoutDraft';

// The session tracker.
//
// Collapsible exercise cards (tap to open), a set grid with a PREV column
// (what you lifted last session, per set), per-exercise notes, completion
// checks, and a sticky bottom bar: progress · session volume · rest timer
// (preset sheet, beep + vibration) · FINISH (logs the workout for XP).
//
// Modes: PROGRAM (active program's day drives the card list — change it in
// Settings) or FREE (search the 873-exercise library).

const TIMER_PRESETS = [30, 45, 60, 90, 120, 150, 180];

const formatTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

function playBeep() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    [0, 0.25, 0.5].forEach((delay) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      const start = ctx.currentTime + delay;
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.exponentialRampToValueAtTime(0.35, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.18);
      osc.start(start);
      osc.stop(start + 0.2);
    });
    setTimeout(() => ctx.close().catch(() => {}), 1500);
  } catch {}
}

function vibrate(pattern) {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined') return;
  try { if (navigator.vibrate) navigator.vibrate(pattern); } catch {}
}

const hasSetData = (s) => s.weight !== '' || s.reps !== '';
const setVolume = (s) => (parseFloat(s.weight) || 0) * (parseFloat(s.reps) || 0);

export default function WorkoutScreen() {
  const settings = useSettings();
  const draftRef = useRef(loadDraft());
  const [active, setActive] = useState(null);
  const [dayNumber, setDayNumber] = useState(draftRef.current?.dayNumber ?? null);
  const [loadingProgram, setLoadingProgram] = useState(true);
  const [restored, setRestored] = useState(!!draftRef.current);

  const [picked, setPicked] = useState(draftRef.current?.picked || []); // [{id,name,prescription?,bodyParts?,sets:[{weight,reps}],notes}]
  const [expandedId, setExpandedId] = useState(null);
  const [lastSets, setLastSets] = useState({}); // exerciseId -> {sets:[{weight,reps}], notes}
  const [saveStatus, setSaveStatus] = useState('idle'); // idle | saving | saved
  const saveFlashTimer = useRef(null);

  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [customPrimary, setCustomPrimary] = useState(null);
  const [creatingCustom, setCreatingCustom] = useState(false);

  const [timerState, setTimerState] = useState('idle'); // idle | running | paused | done
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerTotal, setTimerTotal] = useState(0);
  const [showTimerSheet, setShowTimerSheet] = useState(false);

  const [result, setResult] = useState(null);
  const [celebrate, setCelebrate] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // ---- program loading -------------------------------------------------------
  useFocusEffect(useCallback(() => {
    let live = true;
    (async () => {
      try {
        const data = await api.getActiveProgram();
        if (!live) return;
        setActive(data && data.program ? data : null);
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

  const program = active && active.program;
  const day = program ? program.days.find((d) => d.dayNumber === dayNumber) : null;

  // Pre-load the chosen program day's exercises (never clobbers a restored draft).
  useEffect(() => {
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
        bodyParts: (pe.exercise && pe.exercise.primaryBodyParts) || [],
        sets: Array.from({ length: pe.sets }, () => ({ weight: '', reps: '' })),
        notes: '',
        programDayId: day.id,
      }))
    );
    setResult(null);
    setExpandedId(null);
  }, [program && program.id, dayNumber]);

  // ---- PREV column data ------------------------------------------------------
  const pickedIds = picked.map((p) => p.id).join(',');
  useEffect(() => {
    const ids = picked.map((p) => p.id).filter((id) => !(id in lastSets));
    if (!ids.length) return;
    api.getLastSets(ids)
      .then((res) => setLastSets((prev) => {
        const next = { ...prev };
        for (const id of ids) next[id] = (res.lastSets && res.lastSets[id]) || { sets: [], notes: null };
        return next;
      }))
      .catch(() => {});
  }, [pickedIds]);

  // ---- draft autosave + save indicator ----------------------------------------
  useEffect(() => {
    saveDraft(picked, dayNumber);
    if (picked.length === 0) return;
    setSaveStatus('saving');
    if (saveFlashTimer.current) clearTimeout(saveFlashTimer.current);
    saveFlashTimer.current = setTimeout(() => {
      setSaveStatus('saved');
      saveFlashTimer.current = setTimeout(() => setSaveStatus('idle'), 1500);
    }, 400);
    return () => { if (saveFlashTimer.current) clearTimeout(saveFlashTimer.current); };
  }, [picked, dayNumber]);

  // ---- library search (free mode + adding extras in program mode) -------------
  useEffect(() => {
    const t = setTimeout(async () => {
      if (search.trim().length < 2) { setResults([]); return; }
      setSearching(true);
      try {
        const data = await api.getExercises(`?search=${encodeURIComponent(search)}&take=15`);
        setResults(data.items);
      } catch (e) { setError(e.message); } finally { setSearching(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  // ---- rest timer --------------------------------------------------------------
  useEffect(() => {
    if (timerState !== 'running') return undefined;
    if (timerSeconds <= 0) {
      setTimerState('done');
      playBeep();
      vibrate([300, 100, 300, 100, 300]);
      return undefined;
    }
    const t = setTimeout(() => setTimerSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [timerSeconds, timerState]);

  useEffect(() => {
    if (timerState !== 'done') return undefined;
    const t = setTimeout(() => { setTimerState('idle'); setTimerSeconds(0); setTimerTotal(0); }, 5000);
    return () => clearTimeout(t);
  }, [timerState]);

  const startTimer = (seconds) => {
    setTimerSeconds(seconds);
    setTimerTotal(seconds);
    setTimerState('running');
    setShowTimerSheet(false);
  };
  const togglePause = () => setTimerState((s) => (s === 'running' ? 'paused' : s === 'paused' ? 'running' : s));
  const stopTimer = () => { setTimerState('idle'); setTimerSeconds(0); setTimerTotal(0); };

  // ---- session mutations --------------------------------------------------------
  const addExercise = (ex) => {
    if (picked.find((p) => p.id === ex.id)) return;
    setPicked([...picked, {
      id: ex.id, name: ex.name, bodyParts: ex.primaryBodyParts || ex.bodyParts || [],
      sets: [{ weight: '', reps: '' }], notes: '',
    }]);
    setSearch('');
    setResults([]);
    setCustomOpen(false);
    setCustomPrimary(null);
    setExpandedId(ex.id);
  };

  // Create a movement the library doesn't have; it becomes a real, searchable,
  // XP-earning exercise credited to the chosen body part.
  const createCustom = async () => {
    if (!customPrimary || creatingCustom) return;
    setCreatingCustom(true);
    setError(null);
    try {
      const res = await api.createCustomExercise({ name: search.trim(), primaryBodyPart: customPrimary });
      addExercise(res.exercise);
    } catch (e) {
      setError(e.message);
    } finally {
      setCreatingCustom(false);
    }
  };

  const addSet = (i) => {
    const next = [...picked];
    next[i] = { ...next[i], sets: [...next[i].sets, { weight: '', reps: '' }] };
    setPicked(next);
    if (settings.restTimer) startTimer(settings.restSeconds);
  };

  const updateSet = (i, j, field, val) => {
    const next = [...picked];
    const sets = next[i].sets.map((s, idx) => (idx === j ? { ...s, [field]: val } : s));
    next[i] = { ...next[i], sets };
    setPicked(next);
  };

  const updateNotes = (i, notes) => {
    const next = [...picked];
    next[i] = { ...next[i], notes };
    setPicked(next);
  };

  const removeExercise = (i) => setPicked(picked.filter((_, idx) => idx !== i));

  // ---- derived ------------------------------------------------------------------
  const completedCount = picked.filter((p) => p.sets.some(hasSetData)).length;
  const totalVolume = useMemo(
    () => picked.reduce((sum, p) => sum + p.sets.reduce((s, set) => s + setVolume(set), 0), 0),
    [picked]
  );

  // ---- submit ---------------------------------------------------------------------
  const submit = async () => {
    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      const payload = {
        programDayId: day ? day.id : undefined,
        exercises: picked.map((p) => ({
          exerciseId: p.id,
          sets: p.sets.map((s, idx) => ({
            weight: s.weight ? Number(s.weight) : null,
            reps: s.reps ? Number(s.reps) : null,
            notes: idx === 0 && p.notes ? p.notes : null,
          })),
        })),
      };
      const res = await api.logWorkout(payload);
      setResult(res);
      if (settings.levelUpModal && res.levelUps && res.levelUps.length) setCelebrate(res.levelUps);
      setPicked([]);
      setLastSets({});
      stopTimer();
      setRestored(false);
      clearDraft();
    } catch (e) {
      const coldStart = /failed to fetch|network|load failed|timed? ?out/i.test(e.message || '');
      setError(
        coldStart
          ? 'Server is waking up (free hosting naps when idle). Your sets are saved on this phone — tap FINISH again in ~30 seconds.'
          : e.message
      );
    } finally { setSubmitting(false); }
  };

  // ---- render ----------------------------------------------------------------------
  if (loadingProgram) {
    return (
      <ScreenBackground name="Workout">
        <View style={styles.centered}><ActivityIndicator color={colors.accent} /></View>
      </ScreenBackground>
    );
  }

  const prevFor = (exId, setIdx) => {
    const prev = lastSets[exId];
    const s = prev && prev.sets && prev.sets[setIdx];
    if (!s || (s.weight == null && s.reps == null)) return null;
    return `${s.weight ?? '–'}×${s.reps ?? '–'}`;
  };

  const timerLow = timerState === 'running' && timerSeconds <= 10;

  return (
    <ScreenBackground name="Workout">
    <View style={{ flex: 1 }}>
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.md, paddingBottom: 110 }}>
      {restored && picked.length > 0 ? (
        <Pressable onPress={() => setRestored(false)} style={styles.restoredChip}>
          <Text style={styles.restoredText}>↻ Restored your unfinished workout — nothing was lost. (tap to dismiss)</Text>
        </Pressable>
      ) : null}

      <Panel>
        <View style={styles.headerRow}>
          <SectionTitle>{program ? program.name : 'Free Battle'}</SectionTitle>
          <Text style={[styles.saveBadge, saveStatus === 'saved' && { color: colors.success }]}>
            {saveStatus === 'saving' ? '● SAVING' : saveStatus === 'saved' ? '✓ SAVED' : ''}
          </Text>
        </View>
        {program ? (
          <>
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
            <Text style={styles.hint}>change or clear the program in ⚙ Settings</Text>
          </>
        ) : (
          <Text style={styles.hint}>no program selected — pick one in ⚙ Settings, or build a session below</Text>
        )}
      </Panel>

      {picked.map((p, i) => {
        const isExpanded = expandedId === p.id;
        const isComplete = p.sets.some(hasSetData);
        const prev = lastSets[p.id];
        return (
          <View key={p.id} style={[styles.card, isExpanded && styles.cardExpanded]}>
            <Pressable onPress={() => setExpandedId(isExpanded ? null : p.id)} style={styles.cardHeader}>
              <View style={[styles.numBox, isComplete && styles.numBoxDone]}>
                <Text style={[styles.numText, isComplete && styles.numTextDone]}>{isComplete ? '✓' : i + 1}</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.cardName} numberOfLines={1}>{p.name}</Text>
                <Text style={styles.cardMeta}>
                  {p.prescription ? `${p.prescription}` : `${p.sets.length} set${p.sets.length === 1 ? '' : 's'}`}
                  {p.bodyParts && p.bodyParts.length ? `  ·  ${p.bodyParts.join(' / ')}` : ''}
                </Text>
              </View>
              <Text style={[styles.chevron, isExpanded && { transform: [{ rotate: '180deg' }] }]}>▾</Text>
            </Pressable>

            {isExpanded ? (
              <View style={styles.cardBody}>
                <View style={styles.gridHeader}>
                  <Text style={[styles.gridHeadText, { width: 28 }]}>SET</Text>
                  <Text style={[styles.gridHeadText, { flex: 1, textAlign: 'center' }]}>{(settings.units || 'lbs').toUpperCase()}</Text>
                  <Text style={[styles.gridHeadText, { flex: 1, textAlign: 'center' }]}>REPS</Text>
                  <Text style={[styles.gridHeadText, { width: 62, textAlign: 'right' }]}>PREV</Text>
                </View>
                {p.sets.map((s, j) => (
                  <View key={j} style={styles.setRow}>
                    <Text style={styles.setNum}>{j + 1}</Text>
                    <TextInput style={styles.setInput} placeholder={settings.units} placeholderTextColor={colors.textDim}
                      keyboardType="numeric" value={s.weight} onChangeText={(v) => updateSet(i, j, 'weight', v)} />
                    <TextInput style={styles.setInput} placeholder="reps" placeholderTextColor={colors.textDim}
                      keyboardType="numeric" value={s.reps} onChangeText={(v) => updateSet(i, j, 'reps', v)} />
                    <Text style={styles.prevText}>{prevFor(p.id, j) || '—'}</Text>
                  </View>
                ))}
                <View style={styles.cardActions}>
                  <Pressable onPress={() => addSet(i)}><Text style={styles.addSet}>+ set{settings.restTimer ? ` (rest ${settings.restSeconds}s)` : ''}</Text></Pressable>
                  <Pressable onPress={() => removeExercise(i)}><Text style={styles.removeText}>remove</Text></Pressable>
                </View>
                <TextInput
                  style={styles.notesInput}
                  placeholder="Notes — form cues, how it felt…"
                  placeholderTextColor={colors.textDim}
                  value={p.notes || ''}
                  onChangeText={(v) => updateNotes(i, v)}
                  multiline
                />
                {prev && prev.notes ? (
                  <View style={styles.prevNote}>
                    <Text style={styles.prevNoteLabel}>LAST TIME</Text>
                    <Text style={styles.prevNoteText}>{prev.notes}</Text>
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>
        );
      })}

      <Panel>
        <SectionTitle>{picked.length ? 'Add Exercise' : 'Build Your Session'}</SectionTitle>
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
        {search.trim().length >= 2 && !searching ? (
          !customOpen ? (
            <Pressable onPress={() => setCustomOpen(true)} style={styles.customRow}>
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
                    style={[styles.bpChip, customPrimary === bp && { borderColor: colors[bp], backgroundColor: '#2c2138' }]}>
                    <Text style={[styles.bpChipText, customPrimary === bp && { color: colors[bp] }]}>{bp}</Text>
                  </Pressable>
                ))}
              </View>
              <View style={styles.customActions}>
                <Pressable disabled={!customPrimary || creatingCustom} onPress={createCustom}
                  style={[styles.customCreateBtn, (!customPrimary || creatingCustom) && { opacity: 0.4 }]}>
                  <Text style={styles.customCreateText}>{creatingCustom ? '…' : `CREATE “${search.trim().slice(0, 24)}”`}</Text>
                </Pressable>
                <Pressable onPress={() => { setCustomOpen(false); setCustomPrimary(null); }}>
                  <Text style={styles.customCancel}>cancel</Text>
                </Pressable>
              </View>
              <Text style={styles.hint}>saved to your library — searchable and PREV-tracked from now on</Text>
            </View>
          )
        ) : null}
      </Panel>

      {error ? <Text style={styles.err}>{error}</Text> : null}

      {result ? (
        <Panel>
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

    {/* Sticky session bar */}
    <View style={styles.bottomBar}>
      {timerState === 'running' || timerState === 'paused' ? (
        <View style={[styles.timerProgress, { width: `${timerTotal ? ((timerTotal - timerSeconds) / timerTotal) * 100 : 0}%`, backgroundColor: timerLow ? colors.danger : colors.xp }]} />
      ) : null}
      <View style={styles.barStat}>
        <Text style={styles.barLabel}>DONE</Text>
        <Text style={styles.barValue}>{completedCount}<Text style={styles.barValueDim}>/{picked.length}</Text></Text>
      </View>
      <View style={styles.barStat}>
        <Text style={styles.barLabel}>VOLUME</Text>
        <Text style={[styles.barValue, { color: colors.accent }]}>
          {Math.round(totalVolume).toLocaleString()}<Text style={styles.barValueDim}> {settings.units}</Text>
        </Text>
      </View>
      <View style={[styles.barStat, { flex: 1 }]}>
        <Text style={styles.barLabel}>REST</Text>
        {timerState === 'idle' ? (
          <Pressable onPress={() => setShowTimerSheet(true)}><Text style={styles.timerIdle}>⏳ TIMER</Text></Pressable>
        ) : timerState === 'done' ? (
          <Text style={[styles.barValue, { color: colors.success }]}>GO!</Text>
        ) : (
          <View style={styles.timerRow}>
            <Pressable onPress={togglePause}><Text style={styles.timerCtl}>{timerState === 'paused' ? '▶' : '⏸'}</Text></Pressable>
            <Text style={[styles.barValue, { color: timerLow ? colors.danger : colors.xp }]}>{formatTime(timerSeconds)}</Text>
            <Pressable onPress={stopTimer}><Text style={styles.timerCtl}>✕</Text></Pressable>
          </View>
        )}
      </View>
      <Pressable disabled={submitting || picked.length === 0} onPress={submit}
        style={[styles.finishBtn, (submitting || picked.length === 0) && { opacity: 0.4 }]}>
        <Text style={styles.finishText}>{submitting ? '…' : 'FINISH'}</Text>
      </Pressable>
    </View>

    {/* Rest timer preset sheet */}
    <Modal transparent animationType="slide" visible={showTimerSheet} onRequestClose={() => setShowTimerSheet(false)}>
      <Pressable style={styles.sheetBackdrop} onPress={() => setShowTimerSheet(false)}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <Text style={styles.sheetTitle}>REST TIMER</Text>
          <View style={styles.presetGrid}>
            {TIMER_PRESETS.map((sec) => (
              <Pressable key={sec} onPress={() => startTimer(sec)} style={styles.presetBtn}>
                <Text style={styles.presetText}>{formatTime(sec)}</Text>
              </Pressable>
            ))}
            <Pressable onPress={() => startTimer(settings.restSeconds)} style={[styles.presetBtn, { borderColor: colors.accent }]}>
              <Text style={[styles.presetText, { color: colors.accent }]}>{formatTime(settings.restSeconds)} ★</Text>
            </Pressable>
          </View>
          <Text style={styles.hint}>★ = your default (change in Settings) · beeps + vibrates when done</Text>
        </Pressable>
      </Pressable>
    </Modal>

    <LevelUpModal levelUps={celebrate} onClose={() => setCelebrate(null)} />
    </View>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  saveBadge: { fontFamily: fonts.body, color: colors.textDim, fontSize: 9, fontWeight: '700', letterSpacing: 1 },
  hint: { fontFamily: fonts.body, color: colors.textDim, fontSize: 10, marginTop: 8 },
  dayRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  dayChip: {
    minWidth: 40, alignItems: 'center', paddingVertical: 6, paddingHorizontal: 10,
    backgroundColor: colors.bgPanelAlt, borderRadius: 6, borderWidth: 2, borderColor: colors.border,
  },
  dayChipActive: { borderColor: colors.accent, backgroundColor: '#2c2138' },
  dayChipText: { fontFamily: fonts.body, color: colors.textDim, fontWeight: '700' },
  dayChipTextActive: { color: colors.accent },
  dayName: { fontFamily: fonts.body, color: colors.text, marginTop: 8, fontWeight: '700' },
  restoredChip: {
    backgroundColor: 'rgba(26, 20, 32, 0.9)', borderColor: colors.success, borderWidth: 2,
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 10,
  },
  restoredText: { fontFamily: fonts.body, color: colors.success, fontSize: 11, textAlign: 'center' },
  // cards
  card: {
    backgroundColor: 'rgba(26, 20, 32, 0.72)', borderColor: colors.border, borderWidth: 2,
    borderRadius: 8, marginBottom: spacing.sm, overflow: 'hidden',
  },
  cardExpanded: { borderColor: colors.accent },
  cardHeader: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 },
  numBox: {
    width: 28, height: 28, borderRadius: 4, backgroundColor: colors.bgPanelAlt,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border,
  },
  numBoxDone: { backgroundColor: colors.success, borderColor: colors.success },
  numText: { fontFamily: fonts.body, color: colors.textDim, fontWeight: '700', fontSize: 12 },
  numTextDone: { color: '#0e0a14' },
  cardName: { fontFamily: fonts.body, color: colors.text, fontWeight: '700', fontSize: 14 },
  cardMeta: { fontFamily: fonts.body, color: colors.textDim, fontSize: 10, marginTop: 2 },
  chevron: { color: colors.textDim, fontSize: 14, paddingHorizontal: 4 },
  cardBody: { paddingHorizontal: 12, paddingBottom: 12, borderTopWidth: 1, borderTopColor: colors.border },
  gridHeader: { flexDirection: 'row', gap: 8, marginTop: 10, marginBottom: 4, alignItems: 'center' },
  gridHeadText: { fontFamily: fonts.body, color: colors.textDim, fontSize: 8, fontWeight: '700', letterSpacing: 1 },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  setNum: { width: 28, color: colors.accent, fontFamily: fonts.body, fontWeight: '700' },
  setInput: {
    flex: 1, backgroundColor: colors.bgPanelAlt, color: colors.text, fontFamily: fonts.body,
    borderRadius: 6, borderWidth: 2, borderColor: colors.border, paddingHorizontal: 8, paddingVertical: 8, textAlign: 'center',
  },
  prevText: { width: 62, textAlign: 'right', fontFamily: fonts.body, color: colors.textDim, fontSize: 11 },
  cardActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  addSet: { color: colors.accent, fontFamily: fonts.body, fontSize: 12, paddingVertical: 4 },
  removeText: { color: colors.danger, fontFamily: fonts.body, fontSize: 11, paddingVertical: 4 },
  notesInput: {
    backgroundColor: colors.bgPanelAlt, color: colors.text, fontFamily: fonts.body, fontSize: 12,
    borderRadius: 6, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 10, paddingVertical: 8,
    marginTop: 8, minHeight: 40,
  },
  prevNote: {
    marginTop: 8, padding: 8, backgroundColor: 'rgba(14, 10, 20, 0.6)', borderRadius: 6,
    borderLeftWidth: 2, borderLeftColor: colors.accent,
  },
  prevNoteLabel: { fontFamily: fonts.body, color: colors.accent, fontSize: 8, fontWeight: '700', letterSpacing: 1 },
  prevNoteText: { fontFamily: fonts.body, color: colors.textDim, fontSize: 11, marginTop: 2, fontStyle: 'italic' },
  // search
  input: {
    backgroundColor: colors.bgPanelAlt, color: colors.text, fontFamily: fonts.body,
    borderRadius: 6, borderWidth: 2, borderColor: colors.border, paddingHorizontal: 10, paddingVertical: 8,
  },
  resultRow: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  resultName: { fontFamily: fonts.body, color: colors.text },
  resultParts: { fontFamily: fonts.body, color: colors.textDim, fontSize: 11 },
  customRow: { paddingVertical: 10 },
  customText: { fontFamily: fonts.body, color: colors.accent, fontWeight: '700', fontSize: 13 },
  customBox: {
    marginTop: 8, padding: 10, backgroundColor: 'rgba(14, 10, 20, 0.6)',
    borderRadius: 8, borderWidth: 1, borderColor: colors.border,
  },
  customLabel: { fontFamily: fonts.body, color: colors.textDim, fontSize: 9, fontWeight: '700', letterSpacing: 1, marginBottom: 8 },
  bpRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  bpChip: {
    paddingVertical: 6, paddingHorizontal: 12, backgroundColor: colors.bgPanelAlt,
    borderRadius: 6, borderWidth: 2, borderColor: colors.border,
  },
  bpChipText: { fontFamily: fonts.body, color: colors.textDim, fontWeight: '700', fontSize: 12 },
  customActions: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10 },
  customCreateBtn: {
    backgroundColor: colors.accent, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 2, borderColor: '#00000055',
  },
  customCreateText: { fontFamily: fonts.body, color: '#1a1420', fontWeight: '700', fontSize: 11, letterSpacing: 0.5 },
  customCancel: { fontFamily: fonts.body, color: colors.textDim, fontSize: 12 },
  err: { color: colors.danger, fontFamily: fonts.body, marginBottom: 8, textAlign: 'center' },
  tally: { fontFamily: fonts.body, fontSize: 16, fontWeight: '700', marginBottom: 2 },
  levelUpBox: { marginTop: 8, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8 },
  levelUp: { fontFamily: fonts.body, color: colors.accent, marginBottom: 2 },
  // bottom bar
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: 'rgba(20, 15, 28, 0.97)', borderTopWidth: 2, borderTopColor: colors.border,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  timerProgress: { position: 'absolute', top: 0, left: 0, height: 3 },
  barStat: {},
  barLabel: { fontFamily: fonts.body, color: colors.textDim, fontSize: 8, fontWeight: '700', letterSpacing: 1 },
  barValue: { fontFamily: fonts.heading, color: colors.text, fontSize: 17, fontWeight: '700', marginTop: 1 },
  barValueDim: { color: colors.textDim, fontSize: 11 },
  timerIdle: { fontFamily: fonts.body, color: colors.textDim, fontWeight: '700', fontSize: 14, marginTop: 2 },
  timerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 1 },
  timerCtl: { color: colors.textDim, fontSize: 13, padding: 2 },
  finishBtn: {
    backgroundColor: colors.accent, borderRadius: 6, paddingHorizontal: 16, paddingVertical: 10,
    borderWidth: 2, borderColor: '#00000055',
  },
  finishText: { fontFamily: fonts.body, color: '#1a1420', fontWeight: '700', letterSpacing: 1 },
  // sheet
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.bgPanel, borderTopLeftRadius: 14, borderTopRightRadius: 14,
    borderWidth: 2, borderColor: colors.border, padding: spacing.md, paddingBottom: spacing.lg,
  },
  sheetTitle: { fontFamily: fonts.heading, color: colors.text, fontWeight: '700', fontSize: 16, letterSpacing: 2, marginBottom: 12 },
  presetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  presetBtn: {
    width: '22.7%', paddingVertical: 14, alignItems: 'center', backgroundColor: colors.bgPanelAlt,
    borderRadius: 8, borderWidth: 2, borderColor: colors.border,
  },
  presetText: { fontFamily: fonts.heading, color: colors.text, fontWeight: '700', fontSize: 15 },
});
