import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as api from '@/lib/api';
import { discoverHydra } from '@/lib/discovery';

export default function RootLayout() {
  useEffect(() => {
    if (api.getBaseUrl()) return;
    discoverHydra(6000)
      .then((svc) => {
        api.setBaseUrl(`http://${svc.ip}:${svc.port}`);
        console.log(`[MDNS] Auto-discovered server at ${svc.ip}:${svc.port}`);
      })
      .catch(() => {
        console.log('[MDNS] No server found on local network');
      });
  }, []);

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#131313' },
          headerTintColor: '#00D1FF',
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: '#131313' },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="setup/index"
          options={{ title: 'Setup Controller', presentation: 'modal' }}
        />
      </Stack>
    </>
  );
}
