import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, Image, Pressable, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api';
import { colors, spacing, fonts, tierColors } from '../theme';
import { Panel, SectionTitle, PixelToggle } from '../components/ui';
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

  // Wear toggle: flip instantly (one worn per slot), then confirm with the
  // server — revert by reloading if the call fails.
  const toggleWear = async (item) => {
    const wasOn = item.equipped;
    setBusy(item.id);
    setShop((prev) => ({
      ...prev,
      items: prev.items.map((it) => {
        if (it.id === item.id) return { ...it, equipped: !wasOn };
        if (!wasOn && it.slot === item.slot) return { ...it, equipped: false };
        return it;
      }),
    }));
    try {
      await (wasOn ? api.unequipGear(item.id) : api.equipGear(item.id));
    } catch (e) {
      setError(e.message);
      await load();
    } finally {
      setBusy(null);
    }
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
        <Text style={styles.walletHint}>
          points are earned and spent PER BODY PART — each section shows its own pool
        </Text>
      </Panel>
      <Panel>
        <SectionTitle>Wearing Now</SectionTitle>
        <View style={styles.wornRow}>
          {['arms', 'chest', 'back', 'legs', 'core'].map((slot) => {
            const worn = shop.items.find((it) => it.slot === slot && it.equipped);
            const img = worn ? gearImage(worn.tier, worn.slot, worn.id) : null;
            return (
              <Pressable key={slot} disabled={!worn || busy === (worn && worn.id)}
                onPress={() => worn && toggleWear(worn)} style={styles.wornSlot}>
                <View style={[styles.wornThumb, worn && { borderColor: tierColors[worn.tier] || colors.border }]}>
                  {img ? (
                    <Image source={img} style={styles.thumbImg} resizeMode="contain" />
                  ) : (
                    <Text style={styles.wornEmpty}>—</Text>
                  )}
                </View>
                <Text style={styles.wornLabel}>{slot}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.walletHint}>tap a worn piece to take it off · flip toggles below to dress</Text>
      </Panel>
      {Object.entries(bySlot).map(([slot, items]) => (
        <Panel key={slot}>
          <SectionTitle>
            {slot} · Lv {shop.levelBySlot?.[slot] ?? '?'} · {shop.pointsBySlot?.[slot] ?? 0} pts
          </SectionTitle>
          {items.map((it) => {
            const slotPts = shop.pointsBySlot?.[it.slot] ?? 0;
            const short = it.costPts - slotPts;
            const affordable = !it.locked && short <= 0;
            return (
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
                {!it.owned && !it.locked && !affordable ? (
                  <Text style={styles.needMore}>need {short} more {it.slot} pts</Text>
                ) : null}
              </View>
              {it.owned ? (
                <PixelToggle value={it.equipped} disabled={busy === it.id} onToggle={() => toggleWear(it)} />
              ) : (
                <Pressable disabled={!affordable || busy === it.id} onPress={() => act(api.buyGear, it.id)}>
                  <Text style={[styles.buy, !affordable && styles.disabled]}>{busy === it.id ? '…' : 'Buy'}</Text>
                </Pressable>
              )}
            </View>
            );
          })}
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
  wornRow: { flexDirection: 'row', justifyContent: 'space-between' },
  wornSlot: { alignItems: 'center', flex: 1 },
  wornThumb: {
    width: 48, height: 48, borderRadius: 6, borderWidth: 2, borderColor: colors.border,
    backgroundColor: colors.bgPanelAlt, alignItems: 'center', justifyContent: 'center',
  },
  wornEmpty: { color: colors.textDim, opacity: 0.5 },
  wornLabel: { fontFamily: fonts.body, color: colors.textDim, fontSize: 9, marginTop: 2 },
  wallet: { fontFamily: fonts.heading, color: colors.accent, fontSize: 20, fontWeight: '700', letterSpacing: 1 },
  walletHint: { fontFamily: fonts.body, color: colors.textDim, fontSize: 10, marginTop: 2 },
  item: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  thumb: { width: 40, height: 40, borderRadius: 6, borderWidth: 2, backgroundColor: colors.bgPanelAlt, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  thumbImg: { width: '100%', height: '100%' },
  thumbTier: { fontFamily: fonts.body, fontWeight: '700' },
  itemName: { fontFamily: fonts.body, color: colors.text },
  itemMeta: { fontFamily: fonts.body, color: colors.textDim, fontSize: 11 },
  needMore: { fontFamily: fonts.body, color: colors.danger, fontSize: 10, marginTop: 1 },
  buy: { fontFamily: fonts.body, color: colors.accent, fontWeight: '700', paddingHorizontal: 8 },
  equip: { fontFamily: fonts.body, color: colors.success, fontWeight: '700', paddingHorizontal: 8 },
  equipped: { fontFamily: fonts.body, color: colors.accent, fontWeight: '700', paddingHorizontal: 8 },
  disabled: { color: colors.textDim },
});
