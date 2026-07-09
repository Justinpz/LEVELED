import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TextInput, StyleSheet, ActivityIndicator, RefreshControl, Pressable } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api';
import { colors, spacing, fonts } from '../theme';
import { Panel, SectionTitle, PixelButton } from '../components/ui';
import ScreenBackground from '../components/ScreenBackground';

// Rations — log food against calorie/protein goals; the health meter moves
// with intake (fills toward the goal, drains when you blow far past it).
export default function FoodScreen() {
  const [day, setDay] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [name, setName] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [busy, setBusy] = useState(false);
  const [editGoals, setEditGoals] = useState(false);
  const [calGoal, setCalGoal] = useState('');
  const [protGoal, setProtGoal] = useState('');

  const load = useCallback(async () => {
    try {
      setError(null);
      setDay(await api.getFoodToday());
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const add = async () => {
    if (!name.trim() || !calories.trim()) return;
    setBusy(true); setError(null);
    try {
      setDay(await api.logFood({ name: name.trim(), calories: Number(calories), protein: Number(protein) || 0 }));
      setName(''); setCalories(''); setProtein('');
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
      setDay(await api.setFoodGoals({ calorieGoal: Number(calGoal) || undefined, proteinGoal: Number(protGoal) || undefined }));
      setEditGoals(false);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
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
          <Pressable onPress={() => { setEditGoals(!editGoals); setCalGoal(String(goals.calories)); setProtGoal(String(goals.protein)); }}>
            <Text style={styles.editGoals}>{editGoals ? 'cancel' : 'edit goals'}</Text>
          </Pressable>
        </View>
        <Text style={styles.meterStats}>
          {totals.calories} / {goals.calories} kcal · {totals.protein} / {goals.protein}g protein
        </Text>
        {editGoals ? (
          <View style={styles.goalRow}>
            <TextInput style={styles.goalInput} keyboardType="numeric" value={calGoal} onChangeText={setCalGoal}
              placeholder="kcal goal" placeholderTextColor={colors.textDim} />
            <TextInput style={styles.goalInput} keyboardType="numeric" value={protGoal} onChangeText={setProtGoal}
              placeholder="protein g" placeholderTextColor={colors.textDim} />
            <Pressable disabled={busy} onPress={saveGoals}><Text style={styles.save}>Save</Text></Pressable>
          </View>
        ) : null}
      </Panel>

      <Panel>
        <SectionTitle>Log Rations</SectionTitle>
        <TextInput style={styles.input} placeholder="What did you eat?" placeholderTextColor={colors.textDim}
          value={name} onChangeText={setName} />
        <View style={styles.macroRow}>
          <TextInput style={[styles.input, styles.macroInput]} placeholder="kcal" placeholderTextColor={colors.textDim}
            keyboardType="numeric" value={calories} onChangeText={setCalories} />
          <TextInput style={[styles.input, styles.macroInput]} placeholder="protein g" placeholderTextColor={colors.textDim}
            keyboardType="numeric" value={protein} onChangeText={setProtein} />
        </View>
        <View style={{ marginTop: 10 }}>
          <PixelButton label={busy ? '…' : 'Add to the Log'} onPress={add} disabled={busy || !name.trim() || !calories.trim()} />
        </View>
      </Panel>

      <Panel>
        <SectionTitle>Today's Log</SectionTitle>
        {items.length === 0 ? <Text style={styles.emptyText}>Nothing logged. A warrior marches on his stomach.</Text> : null}
        {items.map((it) => (
          <View key={it.id} style={styles.itemRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName}>{it.name}</Text>
              <Text style={styles.itemMeta}>{it.calories} kcal · {it.protein}g protein</Text>
            </View>
            <Pressable disabled={busy} onPress={() => remove(it.id)}>
              <Text style={styles.remove}>✕</Text>
            </Pressable>
          </View>
        ))}
      </Panel>
    </ScrollView>
    </ScreenBackground>
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
  meterStats: { fontFamily: fonts.body, color: colors.textDim, fontSize: 12, marginTop: 4 },
  editGoals: { fontFamily: fonts.body, color: colors.accent, fontSize: 12 },
  goalRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 8 },
  goalInput: {
    flex: 1, backgroundColor: colors.bgPanelAlt, color: colors.text, fontFamily: fonts.body,
    borderRadius: 6, borderWidth: 2, borderColor: colors.border, paddingHorizontal: 8, paddingVertical: 6, textAlign: 'center',
  },
  save: { fontFamily: fonts.body, color: colors.success, fontWeight: '700', paddingHorizontal: 8 },
  input: {
    backgroundColor: colors.bgPanelAlt, color: colors.text, fontFamily: fonts.body,
    borderRadius: 6, borderWidth: 2, borderColor: colors.border, paddingHorizontal: 10, paddingVertical: 8,
  },
  macroRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  macroInput: { flex: 1, textAlign: 'center' },
  emptyText: { fontFamily: fonts.body, color: colors.textDim, fontSize: 12 },
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  itemName: { fontFamily: fonts.body, color: colors.text },
  itemMeta: { fontFamily: fonts.body, color: colors.textDim, fontSize: 11, marginTop: 2 },
  remove: { color: colors.danger, fontSize: 16, paddingLeft: 12 },
});
