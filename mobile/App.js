import React, { useState } from 'react';
import { Text, View, Pressable, Modal, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme, useNavigation } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useFonts } from 'expo-font';
import { Teko_600SemiBold } from '@expo-google-fonts/teko';
import { Rajdhani_600SemiBold, Rajdhani_700Bold } from '@expo-google-fonts/rajdhani';
import { colors, fonts, glass } from './src/theme';
import HomeScreen from './src/screens/HomeScreen';
import WorkoutScreen from './src/screens/WorkoutScreen';
import QuestsScreen from './src/screens/QuestsScreen';
import FoodScreen from './src/screens/FoodScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import OnboardingSplash from './src/components/OnboardingSplash';
import { hydrateSettings } from './src/settingsStore';

hydrateSettings();

const Tab = createBottomTabNavigator();

const navTheme = {
  ...DefaultTheme,
  dark: true,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.accent,
    background: colors.bg,
    card: colors.bgPanel,
    text: colors.text,
    border: colors.border,
    notification: colors.accent,
  },
};

const SCREENS = ['Home', 'Workout', 'Quests', 'Food', 'Settings'];
const ICONS = { Home: '🐉', Workout: '⚔', Quests: '★', Food: '🍖', Settings: '⚙' };

// Top-left navigation dropdown — replaces the bottom tab bar entirely.
// The button opens a menu of every screen; the centered header title shows
// where you are.
function NavMenu({ current }) {
  const [open, setOpen] = useState(false);
  const navigation = useNavigation();
  return (
    <>
      <Pressable onPress={() => setOpen(true)} hitSlop={10} style={styles.menuBtn}>
        <Text style={styles.menuIcon}>☰</Text>
        <Text style={styles.menuCaret}>▾</Text>
      </Pressable>
      <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.menuBackdrop} onPress={() => setOpen(false)}>
          <View style={styles.menuCard}>
            {SCREENS.map((name) => (
              <Pressable
                key={name}
                onPress={() => { setOpen(false); if (name !== current) navigation.navigate(name); }}
                style={[styles.menuRow, name === current && styles.menuRowActive]}
              >
                <Text style={styles.menuRowIcon}>{ICONS[name]}</Text>
                <Text style={[styles.menuRowText, name === current && styles.menuRowTextActive]}>{name}</Text>
                {name === current ? <Text style={styles.menuRowMark}>◂</Text> : null}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

export default function App() {
  const [started, setStarted] = useState(false);
  const [fontsLoaded] = useFonts({
    Teko_600SemiBold,
    Rajdhani_600SemiBold,
    Rajdhani_700Bold,
  });
  if (!fontsLoaded) return null;
  if (!started) return <OnboardingSplash onBegin={() => setStarted(true)} />;
  return (
    <NavigationContainer theme={navTheme}>
      <StatusBar style="light" />
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerStyle: {
            backgroundColor: colors.bg,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          },
          headerTitleAlign: 'center',
          headerTitleStyle: {
            fontFamily: fonts.heading, color: colors.accent, fontSize: 26, letterSpacing: 3,
          },
          headerLeft: () => <NavMenu current={route.name} />,
          tabBarStyle: { display: 'none' },
        })}
      >
        <Tab.Screen name="Home" component={HomeScreen} />
        <Tab.Screen name="Workout" component={WorkoutScreen} />
        <Tab.Screen name="Quests" component={QuestsScreen} />
        <Tab.Screen name="Food" component={FoodScreen} />
        <Tab.Screen name="Settings" component={SettingsScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  menuBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    marginLeft: 14, paddingVertical: 6, paddingHorizontal: 10,
    borderWidth: 1, borderColor: colors.border, borderRadius: 8,
    backgroundColor: colors.bgPanelAlt,
  },
  menuIcon: { color: colors.accent, fontSize: 16 },
  menuCaret: { color: colors.textDim, fontSize: 10 },
  menuBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  menuCard: {
    position: 'absolute', top: 54, left: 10, minWidth: 190,
    backgroundColor: colors.bgPanel, borderRadius: 12,
    borderWidth: 1, borderColor: colors.accent, overflow: 'hidden',
    shadowColor: colors.accent, shadowOpacity: 0.35, shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 }, elevation: 8,
  },
  menuRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 12, paddingHorizontal: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  menuRowActive: { backgroundColor: glass.deep },
  menuRowIcon: { fontSize: 15, color: colors.textDim, width: 20, textAlign: 'center' },
  menuRowText: {
    fontFamily: fonts.body, color: colors.text, fontSize: 15,
    fontWeight: '700', letterSpacing: 1, flex: 1,
  },
  menuRowTextActive: { color: colors.accent },
  menuRowMark: { color: colors.accent, fontSize: 12 },
});
