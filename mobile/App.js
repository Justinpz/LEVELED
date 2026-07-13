import React, { useState } from 'react';
import { Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { colors } from './src/theme';
import HomeScreen from './src/screens/HomeScreen';
import WorkoutScreen from './src/screens/WorkoutScreen';
import ShopScreen from './src/screens/ShopScreen';
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

const ICONS = { Home: '⚔', Workout: '🏋', Shop: '🛡', Quests: '★', Food: '🍖', Settings: '⚙' };

export default function App() {
  const [started, setStarted] = useState(false);
  if (!started) return <OnboardingSplash onBegin={() => setStarted(true)} />;
  return (
    <NavigationContainer theme={navTheme}>
      <StatusBar style="light" />
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerStyle: { backgroundColor: colors.bgPanel },
          headerTitleStyle: { fontFamily: 'monospace', color: colors.accent, letterSpacing: 2 },
          tabBarStyle: { backgroundColor: colors.bgPanel, borderTopColor: colors.border },
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.textDim,
          tabBarLabelStyle: { fontFamily: 'monospace', fontSize: 10 },
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 18, color }}>{ICONS[route.name]}</Text>,
        })}
      >
        <Tab.Screen name="Home" component={HomeScreen} />
        <Tab.Screen name="Workout" component={WorkoutScreen} />
        <Tab.Screen name="Shop" component={ShopScreen} />
        <Tab.Screen name="Quests" component={QuestsScreen} />
        <Tab.Screen name="Food" component={FoodScreen} />
        <Tab.Screen name="Settings" component={SettingsScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
