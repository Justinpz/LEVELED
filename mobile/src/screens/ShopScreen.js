import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, Image, Pressable, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api';
import { colors, spacing, fonts, tierColors } from '../theme';
import { Panel, SectionTitle } from '../components/ui';
import ScreenBackground from '../components/ScreenBackground';
import { gearImage } from '../assets';

// Shop — gear by slot/tier with locked (level-gated) and owned state.
export default function ShopScreen() {
  const [shop, setShop] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setShop(await api.getShop());
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const act = async (fn, id) => {
    setBusy(id);
    try { await fn(id); await load(); }
    catch (e) { setError(e.message); }
    finally { setBusy(null); }
  };

  if (loading) return <Centered><ActivityIndicator color={colors.accent} /></Centered>;
  if (error && !shop) return <Centered><Text style={styles.err}>{error}</Text></Centered>;

  const bySlot = {};
  for (const it of shop.items) (bySlot[it.slot] = bySlot[it.slot] || []).push(it);

  return (
    <ScreenBackground name="Shop">
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.md }}
      refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={colors.accent} />}>
      {error ? <Text style={styles.err}>{error}</Text> : null}
      <Panel style={styles.walletPanel}>
        <Text style={styles.wallet}>⛁ {shop.totalPoints ?? 0} pts</Text>
        <Text style={styles.walletHint}>total across all body parts · far-tier gear reveals as you level</Text>
      </Panel>
      {Object.entries(bySlot).map(([slot, items]) => (
        <Panel key={slot}>
          <SectionTitle>
            {slot} · Lv {shop.levelBySlot?.[slot] ?? '?'} · {shop.pointsBySlot?.[slot] ?? 0} pts
          </SectionTitle>
          {items.map((it) => (
            <View key={it.id} style={styles.item}>
              <View style={[styles.thumb, { borderColor: tierColors[it.tier] || colors.border }]}>
                {gearImage(it.tier, it.slot, it.id) ? (
                  <Image source={gearImage(it.tier, it.slot, it.id)} style={styles.thumbImg} resizeMode="contain" />
                ) : (
                  <Text style={[styles.thumbTier, { color: tierColors[it.tier] }]}>{it.tier[0].toUpperCase()}</Text>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>{it.name}</Text>
                <Text style={styles.itemMeta}>{it.tier} · {it.costPts} pts{it.locked ? ` · 🔒 Lv ${it.levelGate}` : ''}</Text>
              </View>
              {it.equipped ? (
                <Text style={styles.equipped}>★ Worn</Text>
              ) : it.owned ? (
                <Pressable disabled={busy === it.id} onPress={() => act(api.equipGear, it.id)}>
                  <Text style={styles.equip}>Equip</Text>
                </Pressable>
              ) : (
                <Pressable disabled={it.locked || busy === it.id} onPress={() => act(api.buyGear, it.id)}>
                  <Text style={[styles.buy, it.locked && styles.disabled]}>{busy === it.id ? '…' : 'Buy'}</Text>
                </Pressable>
              )}
            </View>
          ))}
        </Panel>
      ))}
    </ScrollView>
    </ScreenBackground>
  );
}

function Centered({ children }) { return <View style={styles.centered}>{children}</View>; }

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  centered: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  err: { color: colors.danger, fontFamily: fonts.body, marginBottom: 8, textAlign: 'center' },
  walletPanel: { alignItems: 'center', paddingVertical: 10 },
  wallet: { fontFamily: fonts.heading, color: colors.accent, fontSize: 20, fontWeight: '700', letterSpacing: 1 },
  walletHint: { fontFamily: fonts.body, color: colors.textDim, fontSize: 10, marginTop: 2 },
  item: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  thumb: { width: 40, height: 40, borderRadius: 6, borderWidth: 2, backgroundColor: colors.bgPanelAlt, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  thumbImg: { width: '100%', height: '100%' },
  thumbTier: { fontFamily: fonts.body, fontWeight: '700' },
  itemName: { fontFamily: fonts.body, color: colors.text },
  itemMeta: { fontFamily: fonts.body, color: colors.textDim, fontSize: 11 },
  buy: { fontFamily: fonts.body, color: colors.accent, fontWeight: '700', paddingHorizontal: 8 },
  equip: { fontFamily: fonts.body, color: colors.success, fontWeight: '700', paddingHorizontal: 8 },
  equipped: { fontFamily: fonts.body, color: colors.accent, fontWeight: '700', paddingHorizontal: 8 },
  disabled: { color: colors.textDim },
});
