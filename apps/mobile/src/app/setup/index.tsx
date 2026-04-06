import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '@/lib/theme';
import * as api from '@/lib/api';
import { discoverHydra } from '@/lib/discovery';
import type { HydraService } from '@/lib/discovery';

type Step = 'discover' | 'done';

export default function SetupScreen() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('discover');
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [manualUrl, setManualUrl] = useState('');
  const [discovered, setDiscovered] = useState<HydraService | null>(null);

  const startScan = async () => {
    setScanning(true);
    setError(false);
    try {
      const svc = await discoverHydra(8000);
      setDiscovered(svc);
      api.setBaseUrl(`http://${svc.ip}:${svc.port}`);
      setStep('done');
    } catch {
      setError(true);
    } finally {
      setScanning(false);
    }
  };

  const saveManualUrl = () => {
    const trimmed = manualUrl.trim();
    if (!trimmed) return;
    api.setBaseUrl(trimmed);
    setStep('done');
  };

  if (step === 'discover') {
    return (
      <View style={styles.center}>
        {scanning ? (
          <>
            <ActivityIndicator size="large" color={colors.cyan} />
            <Text style={styles.title}>Searching for Hydra controller...</Text>
            <Text style={styles.subtitle}>
              Make sure your controller is powered on and connected to the same network
            </Text>
          </>
        ) : showManual ? (
          <View style={styles.form}>
            <Ionicons
              name="link"
              size={48}
              color={colors.cyan}
              style={{ alignSelf: 'center' }}
            />
            <Text style={styles.title}>Enter Server Address</Text>
            <Text style={styles.subtitle}>
              Enter the IP address or hostname of your Hydra controller
            </Text>
            <TextInput
              style={styles.input}
              value={manualUrl}
              onChangeText={setManualUrl}
              placeholder="http://192.168.1.50:3000"
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              autoFocus
              onSubmitEditing={saveManualUrl}
              returnKeyType="done"
            />
            <Pressable style={styles.primaryButton} onPress={saveManualUrl}>
              <Text style={styles.primaryButtonText}>Connect</Text>
            </Pressable>
            <Pressable
              style={styles.secondaryButton}
              onPress={() => setShowManual(false)}
            >
              <Text style={styles.secondaryButtonText}>Back to Scan</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Ionicons name="wifi" size={64} color={error ? colors.amber : colors.cyan} />
            <Text style={styles.title}>
              {error ? 'No Controller Found' : 'Find Your Controller'}
            </Text>
            <Text style={styles.subtitle}>
              {error
                ? 'Make sure your controller is on and connected to the same WiFi network'
                : 'We\'ll scan your local network for a Hydra controller'}
            </Text>
            <Pressable style={styles.primaryButton} onPress={startScan}>
              <Text style={styles.primaryButtonText}>
                {error ? 'Try Again' : 'Start Scanning'}
              </Text>
            </Pressable>
            {error && (
              <Pressable
                style={styles.secondaryButton}
                onPress={() => setShowManual(true)}
              >
                <Text style={styles.secondaryButtonText}>Enter Manually</Text>
              </Pressable>
            )}
          </>
        )}
      </View>
    );
  }

  // Done
  return (
    <View style={styles.center}>
      <Ionicons name="checkmark-circle" size={80} color={colors.green} />
      <Text style={styles.title}>All Set!</Text>
      <Text style={styles.subtitle}>
        {discovered
          ? `Connected to ${discovered.name} (${discovered.ip})`
          : 'Your Hydra controller is connected and ready to go'}
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
  form: {
    width: '100%',
    paddingHorizontal: spacing.md,
  },
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
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 14,
    color: colors.text,
    fontSize: 16,
    marginTop: spacing.md,
  },
  primaryButton: {
    backgroundColor: colors.cyan,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: spacing.lg,
    width: '100%',
  },
  primaryButtonText: {
    color: colors.bg,
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  secondaryButtonText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
});
