import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
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
