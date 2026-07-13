import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TextInput, StyleSheet, Pressable, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api';
import { colors, spacing, fonts } from '../theme';
import { Panel, SectionTitle, PixelToggle } from '../components/ui';
import ScreenBackground from '../components/ScreenBackground';
import ProgramsPanel from '../components/ProgramsPanel';
import { useSettings, updateSettings, hydrateSettings } from '../settingsStore';

// Settings — the war camp. Units, rest timer, celebration/motion toggles,
// display name, and quick status of program/coach.
export default function SettingsScreen() {
  const settings = useSettings();
  const [nameDraft, setNameDraft] = useState(null); // null = not editing
  const [restDraft, setRestDraft] = useState(null);
  const [program, setProgram] = useState(undefined); // undefined = loading
  const [msg, setMsg] = useState(null);
  const [showPrograms, setShowPrograms] = useState(false);

  const load = useCallback(async () => {
    hydrateSettings();
    try {
      const data = await api.getActiveProgram();
      setProgram(data && data.program ? data.program : null);
    } catch {
      setProgram(null);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const flip = (key) => updateSettings({ [key]: !settings[key] });

  const saveName = async () => {
    await updateSettings({ displayName: (nameDraft || '').trim().slice(0, 24) });
    setNameDraft(null);
    setMsg('Name saved.');
  };

  const saveRest = async () => {
    const v = parseInt(restDraft, 10);
    if (Number.isFinite(v)) await updateSettings({ restSeconds: Math.max(15, Math.min(600, v)) });
    setRestDraft(null);
  };

  const clearProgram = async () => {
    try {
      await api.clearProgram();
      setProgram(null);
      setMsg('Program cleared — Workout tab is back to free battles.');
    } catch (e) { setMsg(e.message); }
  };

  return (
    <ScreenBackground name="Quests">
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.md }}
      refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={colors.accent} />}>
      {msg ? <Text style={styles.msg}>{msg}</Text> : null}

      <Panel>
        <SectionTitle>Warrior</SectionTitle>
        <Row label="Display name" sub="shown under WARRIOR on the home screen">
          {nameDraft === null ? (
            <Pressable onPress={() => setNameDraft(settings.displayName)}>
              <Text style={styles.value}>{settings.displayName || 'unnamed'} ✎</Text>
            </Pressable>
          ) : (
            <View style={styles.editRow}>
              <TextInput style={styles.input} value={nameDraft} onChangeText={setNameDraft}
                maxLength={24} autoFocus placeholder="name" placeholderTextColor={colors.textDim} />
              <Pressable onPress={saveName}><Text style={styles.save}>save</Text></Pressable>
            </View>
          )}
        </Row>
      </Panel>

      <Panel>
        <SectionTitle>Training</SectionTitle>
        <Row label="Weight units" sub="for logging sets">
          <View style={styles.segmented}>
            {['lbs', 'kg'].map((u) => (
              <Pressable key={u} onPress={() => updateSettings({ units: u })}
                style={[styles.segment, settings.units === u && styles.segmentActive]}>
                <Text style={[styles.segmentText, settings.units === u && styles.segmentTextActive]}>{u}</Text>
              </Pressable>
            ))}
          </View>
        </Row>
        <Row label="Rest timer" sub="countdown after you add a set">
          <PixelToggle value={settings.restTimer} onToggle={() => flip('restTimer')} onLabel="ON" offLabel="OFF" />
        </Row>
        {settings.restTimer ? (
          <Row label="Rest duration" sub="seconds between sets (15–600)">
            {restDraft === null ? (
              <Pressable onPress={() => setRestDraft(String(settings.restSeconds))}>
                <Text style={styles.value}>{settings.restSeconds}s ✎</Text>
              </Pressable>
            ) : (
              <View style={styles.editRow}>
                <TextInput style={[styles.input, { width: 70, textAlign: 'center' }]} value={restDraft}
                  onChangeText={setRestDraft} keyboardType="numeric" autoFocus />
                <Pressable onPress={saveRest}><Text style={styles.save}>save</Text></Pressable>
              </View>
            )}
          </Row>
        ) : null}
        <Row label="Active program" sub={program === undefined ? '…' : program ? program.name : 'none — free battles'}>
          {program ? (
            <Pressable onPress={clearProgram}><Text style={styles.danger}>clear</Text></Pressable>
          ) : null}
        </Row>
      </Panel>

      <Panel>
        <Pressable onPress={() => setShowPrograms(!showPrograms)}>
          <SectionTitle>{showPrograms ? '▾ Programs' : '▸ Programs'}</SectionTitle>
        </Pressable>
        {!showPrograms ? (
          <Text style={styles.hint}>
            Browse the 10 starter programs, forge one from a goal, or build your own.
            The selected program becomes the Workout tab's plan.
          </Text>
        ) : (
          <ProgramsPanel />
        )}
      </Panel>

      <Panel>
        <SectionTitle>Game Feel</SectionTitle>
        <Row label="Avatar barks" sub="he speaks when you tap him">
          <PixelToggle value={settings.barks} onToggle={() => flip('barks')} onLabel="ON" offLabel="OFF" />
        </Row>
        <Row label="Animations" sub="breathing, bounces, equip pops (turn off to reduce motion)">
          <PixelToggle value={settings.animations} onToggle={() => flip('animations')} onLabel="ON" offLabel="OFF" />
        </Row>
        <Row label="Level-up celebrations" sub="full-screen ritual when a body part levels">
          <PixelToggle value={settings.levelUpModal} onToggle={() => flip('levelUpModal')} onLabel="ON" offLabel="OFF" />
        </Row>
        <Row label="Daily Warrior: gym session first" sub="open the original gym version instead of Home Edition">
          <PixelToggle value={settings.warriorShowOriginal} onToggle={() => flip('warriorShowOriginal')} onLabel="ON" offLabel="OFF" />
        </Row>
      </Panel>

      <Panel>
        <SectionTitle>Nutrition</SectionTitle>
        <Text style={styles.hint}>
          Calorie, protein, carb and fat goals live in the Food tab — tap "edit goals" on the Health Meter.
        </Text>
      </Panel>

      <Panel>
        <SectionTitle>About</SectionTitle>
        <Text style={styles.hint}>
          LEVELED — dark-fantasy fitness RPG.{'\n'}
          Every rep is XP. Five body parts, five gear tiers, one warrior.{'\n\n'}
          AI program forging runs on the built-in generator; connect an Anthropic API key on the
          server to upgrade it to a full AI coach.
        </Text>
      </Panel>
    </ScrollView>
    </ScreenBackground>
  );
}

function Row({ label, sub, children }) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1, paddingRight: 10 }}>
        <Text style={styles.label}>{label}</Text>
        {sub ? <Text style={styles.sub}>{sub}</Text> : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  msg: { color: colors.success, fontFamily: fonts.body, marginBottom: 8, textAlign: 'center' },
  row: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  label: { fontFamily: fonts.body, color: colors.text, fontSize: 14 },
  sub: { fontFamily: fonts.body, color: colors.textDim, fontSize: 10, marginTop: 2 },
  value: { fontFamily: fonts.body, color: colors.accent, fontWeight: '700' },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: {
    backgroundColor: colors.bgPanelAlt, color: colors.text, fontFamily: fonts.body,
    borderRadius: 6, borderWidth: 2, borderColor: colors.border, paddingHorizontal: 8, paddingVertical: 6,
    minWidth: 120,
  },
  save: { fontFamily: fonts.body, color: colors.success, fontWeight: '700' },
  danger: { fontFamily: fonts.body, color: colors.danger, fontWeight: '700' },
  segmented: { flexDirection: 'row', borderWidth: 2, borderColor: colors.border, borderRadius: 6, overflow: 'hidden' },
  segment: { paddingVertical: 6, paddingHorizontal: 14, backgroundColor: colors.bgPanelAlt },
  segmentActive: { backgroundColor: colors.accent },
  segmentText: { fontFamily: fonts.body, color: colors.textDim, fontWeight: '700', fontSize: 12 },
  segmentTextActive: { color: '#1a1420' },
  hint: { fontFamily: fonts.body, color: colors.textDim, fontSize: 11, lineHeight: 17 },
});
