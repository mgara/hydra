import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  TextInput,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '@/lib/theme';
import * as api from '@/lib/api';

type Step = 'scan' | 'wifi' | 'done';

export default function SetupScreen() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('scan');
  const [scanning, setScanning] = useState(false);

  // WiFi form state
  const [ssid, setSsid] = useState('');
  const [password, setPassword] = useState('');

  // Placeholder: BLE scanning will be added with react-native-ble-plx
  const startScan = () => {
    setScanning(true);
    // Simulate finding a device
    setTimeout(() => {
      setScanning(false);
      setStep('wifi');
    }, 2000);
  };

  const submitWifi = () => {
    if (!ssid) {
      Alert.alert('Error', 'Please enter the WiFi network name');
      return;
    }
    // Placeholder: will write SSID/password over BLE
    setStep('done');
    // For now, set a default URL for testing
    api.setBaseUrl('http://192.168.1.50:3000');
  };

  if (step === 'scan') {
    return (
      <View style={styles.center}>
        {scanning ? (
          <>
            <ActivityIndicator size="large" color={colors.cyan} />
            <Text style={styles.title}>Scanning for Hydra controllers...</Text>
            <Text style={styles.subtitle}>
              Make sure your controller is powered on and in pairing mode
            </Text>
          </>
        ) : (
          <>
            <Ionicons name="bluetooth" size={64} color={colors.cyan} />
            <Text style={styles.title}>Find Your Controller</Text>
            <Text style={styles.subtitle}>
              We'll scan for nearby Hydra controllers via Bluetooth
            </Text>
            <Pressable style={styles.primaryButton} onPress={startScan}>
              <Text style={styles.primaryButtonText}>Start Scanning</Text>
            </Pressable>
          </>
        )}
      </View>
    );
  }

  if (step === 'wifi') {
    return (
      <View style={styles.container}>
        <View style={styles.form}>
          <Ionicons
            name="wifi"
            size={48}
            color={colors.cyan}
            style={{ alignSelf: 'center', marginBottom: spacing.lg }}
          />
          <Text style={styles.title}>Connect to WiFi</Text>
          <Text style={styles.subtitle}>
            Enter your home WiFi credentials so the controller can connect
          </Text>

          <Text style={styles.label}>Network Name (SSID)</Text>
          <TextInput
            style={styles.input}
            value={ssid}
            onChangeText={setSsid}
            placeholder="MyHomeNetwork"
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor={colors.textSecondary}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Pressable style={styles.primaryButton} onPress={submitWifi}>
            <Text style={styles.primaryButtonText}>Connect</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // Done
  return (
    <View style={styles.center}>
      <Ionicons name="checkmark-circle" size={80} color={colors.green} />
      <Text style={styles.title}>All Set!</Text>
      <Text style={styles.subtitle}>
        Your Hydra controller is connected and ready to go
      </Text>
      <Pressable
        style={styles.primaryButton}
        onPress={() => router.replace('/(tabs)')}
      >
        <Text style={styles.primaryButtonText}>Go to Dashboard</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: spacing.lg,
  },
  center: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  form: { marginTop: spacing.xl },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: spacing.md,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
    marginTop: spacing.md,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 14,
    color: colors.text,
    fontSize: 16,
  },
  primaryButton: {
    backgroundColor: colors.cyan,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  primaryButtonText: {
    color: colors.bg,
    fontSize: 16,
    fontWeight: '700',
  },
});
