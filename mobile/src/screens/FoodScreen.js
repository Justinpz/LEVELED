import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, ScrollView, TextInput, StyleSheet, ActivityIndicator, RefreshControl, Pressable, Modal } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api';
import { colors, spacing, fonts } from '../theme';
import { Panel, SectionTitle, PixelButton } from '../components/ui';
import ScreenBackground from '../components/ScreenBackground';

const MACROS = [
  { key: 'calories', label: 'kcal', goalKey: 'calorieGoal' },
  { key: 'protein', label: 'protein', goalKey: 'proteinGoal' },
  { key: 'carbs', label: 'carbs', goalKey: 'carbGoal' },
  { key: 'fat', label: 'fat', goalKey: 'fatGoal' },
];

// Rations — log food (all four macros matter), goals, the health meter, and a
// month calendar of day rollups (tap a day for its full story).
export default function FoodScreen() {
  const [day, setDay] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [name, setName] = useState('');
  const [macros, setMacros] = useState({ calories: '', protein: '', carbs: '', fat: '' });
  const [busy, setBusy] = useState(false);
  const [editGoals, setEditGoals] = useState(false);
  const [goalDraft, setGoalDraft] = useState({});
  const [calendar, setCalendar] = useState(null);
  const [dayDetail, setDayDetail] = useState(null); // tapped calendar day

  const load = useCallback(async () => {
    try {
      setError(null);
      const [today, cal] = await Promise.all([
        api.getFoodToday(),
        api.getFoodCalendar().catch(() => null),
      ]);
      setDay(today);
      setCalendar(cal);
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const add = async () => {
    if (!name.trim() || !macros.calories.trim()) return;
    setBusy(true); setError(null);
    try {
      setDay(await api.logFood({
        name: name.trim(),
        calories: Number(macros.calories),
        protein: Number(macros.protein) || 0,
        carbs: Number(macros.carbs) || 0,
        fat: Number(macros.fat) || 0,
      }));
      setName(''); setMacros({ calories: '', protein: '', carbs: '', fat: '' });
      api.getFoodCalendar().then(setCalendar).catch(() => {});
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  const remove = async (id) => {
    setBusy(true);
    try { setDay(await api.deleteFood(id)); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  const saveGoals = async () => {
    setBusy(true); setError(null);
    try {
      const body = {};
      for (const m of MACROS) if (goalDraft[m.goalKey]) body[m.goalKey] = Number(goalDraft[m.goalKey]);
      setDay(await api.setFoodGoals(body));
      setEditGoals(false);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  const openDay = async (date) => {
    try { setDayDetail(await api.getFoodDay(date)); }
    catch (e) { setError(e.message); }
  };

  if (loading) return <View style={styles.centered}><ActivityIndicator color={colors.accent} /></View>;
  if (error && !day) return <View style={styles.centered}><Text style={styles.err}>{error}</Text></View>;

  const { health, totals, goals, items } = day;
  const pct = Math.max(0, Math.min(100, health.score));

  return (
    <ScreenBackground name="Home">
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.md }}
      refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={colors.accent} />}>
      {error ? <Text style={styles.err}>{error}</Text> : null}

      <Panel>
        <SectionTitle>Health Meter</SectionTitle>
        <View style={styles.meterTrack}>
          <View style={[styles.meterFill, { width: `${pct}%`, backgroundColor: meterColor(health) }]} />
        </View>
        <View style={styles.meterRow}>
          <Text style={styles.meterLabel}>{health.label} · {health.score}/100</Text>
          <Pressable onPress={() => {
            setEditGoals(!editGoals);
            setGoalDraft({ calorieGoal: String(goals.calories), proteinGoal: String(goals.protein), carbGoal: String(goals.carbs ?? 250), fatGoal: String(goals.fat ?? 70) });
          }}>
            <Text style={styles.editGoals}>{editGoals ? 'cancel' : 'edit goals'}</Text>
          </Pressable>
        </View>
        <View style={styles.macroBars}>
          <MacroBar label="Calories" have={totals.calories} goal={goals.calories} unit="" />
          <MacroBar label="Protein" have={totals.protein} goal={goals.protein} unit="g" />
          <MacroBar label="Carbs" have={totals.carbs ?? 0} goal={goals.carbs ?? 0} unit="g" />
          <MacroBar label="Fat" have={totals.fat ?? 0} goal={goals.fat ?? 0} unit="g" />
        </View>
        {editGoals ? (
          <View>
            <View style={styles.goalRow}>
              {['calorieGoal', 'proteinGoal', 'carbGoal', 'fatGoal'].map((k) => (
                <TextInput key={k} style={styles.goalInput} keyboardType="numeric"
                  value={goalDraft[k] ?? ''} onChangeText={(v) => setGoalDraft({ ...goalDraft, [k]: v })}
                  placeholder={k.replace('Goal', '')} placeholderTextColor={colors.textDim} />
              ))}
            </View>
            <Text style={styles.goalHint}>kcal · protein g · carbs g · fat g</Text>
            <Pressable disabled={busy} onPress={saveGoals}><Text style={styles.save}>Save goals</Text></Pressable>
          </View>
        ) : null}
      </Panel>

      <Panel>
        <SectionTitle>Log Rations</SectionTitle>
        <TextInput style={styles.input} placeholder="What did you eat?" placeholderTextColor={colors.textDim}
          value={name} onChangeText={setName} />
        <View style={styles.macroRow}>
          {MACROS.map((m) => (
            <TextInput key={m.key} style={[styles.input, styles.macroInput]} placeholder={m.label}
              placeholderTextColor={colors.textDim} keyboardType="numeric"
              value={macros[m.key]} onChangeText={(v) => setMacros({ ...macros, [m.key]: v })} />
          ))}
        </View>
        <View style={{ marginTop: 10 }}>
          <PixelButton label={busy ? '…' : 'Add to the Log'} onPress={add}
            disabled={busy || !name.trim() || !macros.calories.trim()} />
        </View>
      </Panel>

      <Panel>
        <SectionTitle>Today's Log</SectionTitle>
        {items.length === 0 ? <Text style={styles.emptyText}>Nothing logged. A warrior marches on his stomach.</Text> : null}
        {items.map((it) => (
          <View key={it.id} style={styles.itemRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName}>{it.name}</Text>
              <Text style={styles.itemMeta}>
                {it.calories} kcal · {it.protein}g P · {it.carbs ?? 0}g C · {it.fat ?? 0}g F
              </Text>
            </View>
            <Pressable disabled={busy} onPress={() => remove(it.id)}>
              <Text style={styles.remove}>✕</Text>
            </Pressable>
          </View>
        ))}
      </Panel>

      {calendar ? <CalendarPanel calendar={calendar} onDayPress={openDay} /> : null}
    </ScrollView>

    <DayDetailModal detail={dayDetail} onClose={() => setDayDetail(null)} />
    </ScreenBackground>
  );
}

function MacroBar({ label, have, goal, unit }) {
  const pct = goal > 0 ? Math.min(100, (have / goal) * 100) : 0;
  const over = goal > 0 && have > goal * (label === 'Calories' ? 1.15 : 1.3);
  return (
    <View style={styles.macroBarRow}>
      <Text style={styles.macroBarLabel}>{label}</Text>
      <View style={styles.macroBarTrack}>
        <View style={[styles.macroBarFill, { width: `${pct}%`, backgroundColor: over ? colors.danger : colors.xp }]} />
      </View>
      <Text style={styles.macroBarStats}>{have}/{goal}{unit}</Text>
    </View>
  );
}

// Month grid: one compact cell per day — health dot color + ✓ marks for goals
// met / workouts done. Tap a day for the full detail modal.
function CalendarPanel({ calendar, onDayPress }) {
  const { month, days } = calendar;
  const byDate = Object.fromEntries(days.map((d) => [d.date, d]));
  const [y, m] = month.split('-').map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const firstDow = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(`${month}-${String(d).padStart(2, '0')}`);

  const dot = (d) => {
    if (!d) return colors.border;
    if (d.health == null) return d.workouts ? colors.xp : colors.border;
    if (d.health >= 75) return colors.success;
    if (d.health >= 50) return colors.accent;
    return colors.danger;
  };
  const metCount = (d) => (d ? Object.values(d.goalsMet).filter(Boolean).length : 0);

  return (
    <Panel>
      <SectionTitle>Campaign Calendar · {month}</SectionTitle>
      <View style={styles.dowRow}>
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <Text key={i} style={styles.dow}>{d}</Text>
        ))}
      </View>
      <View style={styles.calGrid}>
        {cells.map((date, i) => {
          if (!date) return <View key={`x${i}`} style={styles.calCell} />;
          const d = byDate[date];
          const has = !!d;
          return (
            <Pressable key={date} style={[styles.calCell, has && styles.calCellActive]}
              onPress={() => has && onDayPress(date)}>
              <Text style={[styles.calDay, has && { color: colors.text }]}>{Number(date.slice(-2))}</Text>
              {has ? (
                <>
                  <View style={[styles.calDot, { backgroundColor: dot(d) }]} />
                  <Text style={styles.calMeta}>
                    {metCount(d) ? `${metCount(d)}✓` : ''}{d.workouts ? ' 🏋' : ''}
                  </Text>
                </>
              ) : null}
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.calLegend}>dot = health · n✓ = macro goals met · 🏋 = trained · tap a day</Text>
    </Panel>
  );
}

function DayDetailModal({ detail, onClose }) {
  if (!detail) return null;
  const met = detail.goalsMet || {};
  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={() => {}}>
          <Text style={styles.modalTitle}>⚔ {detail.date}</Text>
          {detail.health ? (
            <Text style={styles.modalHealth}>Health {detail.health.score}/100 · {detail.health.label}</Text>
          ) : (
            <Text style={styles.modalHealth}>No rations logged</Text>
          )}
          <Text style={styles.modalMacros}>
            {detail.totals.calories} kcal {met.calories ? '✓' : ''} · {detail.totals.protein}g P {met.protein ? '✓' : ''} ·{' '}
            {detail.totals.carbs}g C {met.carbs ? '✓' : ''} · {detail.totals.fat}g F {met.fat ? '✓' : ''}
          </Text>

          {detail.items.length ? (
            <>
              <Text style={styles.modalSection}>Rations</Text>
              {detail.items.map((it) => (
                <Text key={it.id} style={styles.modalLine}>
                  {it.name} — {it.calories} kcal · {it.protein}P/{it.carbs ?? 0}C/{it.fat ?? 0}F
                </Text>
              ))}
            </>
          ) : null}

          {detail.workouts.length ? (
            <>
              <Text style={styles.modalSection}>Battles Fought</Text>
              {detail.workouts.map((w, i) => (
                <Text key={i} style={styles.modalLine}>
                  🏋 {w.exercises} exercises · {w.sets} sets · +{w.xp} XP
                </Text>
              ))}
            </>
          ) : null}

          {detail.challenges.length ? (
            <>
              <Text style={styles.modalSection}>Quests Conquered</Text>
              {detail.challenges.map((c, i) => (
                <Text key={i} style={styles.modalLine}>★ {c.title} (+{c.rewardPts})</Text>
              ))}
            </>
          ) : null}

          <Pressable onPress={onClose}><Text style={styles.modalClose}>close</Text></Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function meterColor(health) {
  if (health.label === 'Overfed') return colors.danger;
  if (health.score >= 75) return colors.success;
  if (health.score >= 50) return colors.accent;
  return colors.danger;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  centered: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  err: { color: colors.danger, fontFamily: fonts.body, marginBottom: 8, textAlign: 'center' },
  meterTrack: {
    height: 18, backgroundColor: colors.bgPanelAlt, borderRadius: 9,
    borderWidth: 2, borderColor: colors.border, overflow: 'hidden',
  },
  meterFill: { height: '100%' },
  meterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  meterLabel: { fontFamily: fonts.body, color: colors.text, fontWeight: '700' },
  editGoals: { fontFamily: fonts.body, color: colors.accent, fontSize: 12 },
  macroBars: { marginTop: 8 },
  macroBarRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  macroBarLabel: { width: 62, fontFamily: fonts.body, color: colors.textDim, fontSize: 10 },
  macroBarTrack: {
    flex: 1, height: 8, backgroundColor: colors.bgPanelAlt, borderRadius: 4,
    borderWidth: 1, borderColor: colors.border, overflow: 'hidden',
  },
  macroBarFill: { height: '100%' },
  macroBarStats: { width: 84, textAlign: 'right', fontFamily: fonts.body, color: colors.textDim, fontSize: 10 },
  goalRow: { flexDirection: 'row', gap: 6, marginTop: 10 },
  goalInput: {
    flex: 1, backgroundColor: colors.bgPanelAlt, color: colors.text, fontFamily: fonts.body,
    borderRadius: 6, borderWidth: 2, borderColor: colors.border, paddingHorizontal: 6, paddingVertical: 6,
    textAlign: 'center', fontSize: 12,
  },
  goalHint: { fontFamily: fonts.body, color: colors.textDim, fontSize: 9, marginTop: 4, textAlign: 'center' },
  save: { fontFamily: fonts.body, color: colors.success, fontWeight: '700', textAlign: 'center', padding: 8 },
  input: {
    backgroundColor: colors.bgPanelAlt, color: colors.text, fontFamily: fonts.body,
    borderRadius: 6, borderWidth: 2, borderColor: colors.border, paddingHorizontal: 10, paddingVertical: 8,
  },
  macroRow: { flexDirection: 'row', gap: 6, marginTop: 8 },
  macroInput: { flex: 1, textAlign: 'center', paddingHorizontal: 4, fontSize: 12 },
  emptyText: { fontFamily: fonts.body, color: colors.textDim, fontSize: 12 },
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  itemName: { fontFamily: fonts.body, color: colors.text },
  itemMeta: { fontFamily: fonts.body, color: colors.textDim, fontSize: 11, marginTop: 2 },
  remove: { color: colors.danger, fontSize: 16, paddingLeft: 12 },
  // calendar
  dowRow: { flexDirection: 'row' },
  dow: { flex: 1, textAlign: 'center', fontFamily: fonts.body, color: colors.textDim, fontSize: 9, marginBottom: 2 },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calCell: {
    width: `${100 / 7}%`, aspectRatio: 0.9, alignItems: 'center', justifyContent: 'center',
    borderWidth: 0.5, borderColor: 'rgba(44, 58, 99, 0.4)',
  },
  calCellActive: { backgroundColor: 'rgba(28, 36, 64, 0.6)' },
  calDay: { fontFamily: fonts.body, color: colors.textDim, fontSize: 10 },
  calDot: { width: 6, height: 6, borderRadius: 3, marginTop: 2 },
  calMeta: { fontFamily: fonts.body, color: colors.textDim, fontSize: 7, marginTop: 1 },
  calLegend: { fontFamily: fonts.body, color: colors.textDim, fontSize: 9, marginTop: 6, textAlign: 'center' },
  // modal
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  modalCard: {
    backgroundColor: colors.bgPanel, borderColor: colors.accent, borderWidth: 2, borderRadius: 10,
    padding: spacing.md, width: '100%', maxWidth: 420,
  },
  modalTitle: { fontFamily: fonts.heading, color: colors.accent, fontSize: 16, fontWeight: '700', letterSpacing: 1 },
  modalHealth: { fontFamily: fonts.body, color: colors.text, marginTop: 4 },
  modalMacros: { fontFamily: fonts.body, color: colors.textDim, fontSize: 11, marginTop: 2 },
  modalSection: { fontFamily: fonts.body, color: colors.accent, fontSize: 11, fontWeight: '700', marginTop: 10, textTransform: 'uppercase', letterSpacing: 1 },
  modalLine: { fontFamily: fonts.body, color: colors.text, fontSize: 12, marginTop: 3 },
  modalClose: { fontFamily: fonts.body, color: colors.textDim, textAlign: 'center', marginTop: 14, padding: 4 },
});
