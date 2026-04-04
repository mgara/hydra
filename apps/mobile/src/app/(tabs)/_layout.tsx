import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const CYAN = '#00D1FF';
const GRAY = '#666';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: CYAN,
        tabBarInactiveTintColor: GRAY,
        tabBarStyle: {
          backgroundColor: '#1a1a1a',
          borderTopColor: 'rgba(255,255,255,0.1)',
        },
        headerStyle: { backgroundColor: '#131313' },
        headerTintColor: CYAN,
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="water" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="zones"
        options={{
          title: 'Zones',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="grid" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
