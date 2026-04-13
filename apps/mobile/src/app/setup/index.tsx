import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  TextInput,
  FlatList,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '@/lib/theme';
import * as api from '@/lib/api';
import { discoverHydra } from '@/lib/discovery';
import type { HydraService } from '@/lib/discovery';
import { WIFI_STATUS_LABELS } from '@/lib/ble';
import type { WifiStatusCode } from '@/lib/ble';
import {
  requestBlePermissions,
  waitForBluetooth,
  scanForHydra,
  provisionWifi,
} from '@/lib/ble-client';
import type { HydraBleDev } from '@/lib/ble-client';

type Step =
  | 'home'        // choose: BLE provision vs mDNS discover
  | 'ble-scan'    // scanning for nearby Hydra BLE devices
  | 'ble-wifi'    // enter SSID + password for chosen device
  | 'ble-connect' // wrote credentials, monitoring WIFI_STATUS
  | 'discover'    // mDNS scan (post-BLE or direct)
  | 'manual'      // manual URL entry
  | 'done';       // connected

export default function SetupScreen() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('home');

  // BLE scan state
  const [bleDevices, setBleDevices] = useState<HydraBleDev[]>([]);
  const [bleBusy, setBleBusy] = useState(false);
  const [selectedDev, setSelectedDev] = useState<HydraBleDev | null>(null);
  const stopScanRef = useRef<(() => void) | null>(null);

  // WiFi credential state
  const [ssid, setSsid] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // BLE connect state
  const [wifiStatus, setWifiStatus] = useState<WifiStatusCode | null>(null);

  // mDNS discover state
  const [discovering, setDiscovering] = useState(false);
  const [discoverError, setDiscoverError] = useState(false);
  const [discovered, setDiscovered] = useState<HydraService | null>(null);

  // Manual URL state
  const [manualUrl, setManualUrl] = useState('');

  // Stop BLE scan on unmount / step change away from ble-scan
  useEffect(() => {
    return () => { stopScanRef.current?.(); };
  }, []);

  // ─── BLE scan ────────────────────────────────────────────────────────────────

  const startBleScan = async () => {
    setBleBusy(true);
    setBleDevices([]);
    try {
      const granted = await requestBlePermissions();
      if (!granted) {
        Alert.alert('Permission denied', 'Bluetooth permission is required to configure the controller.');
        setBleBusy(false);
        return;
      }
      await waitForBluetooth(8000);
    } catch {
      Alert.alert('Bluetooth unavailable', 'Please enable Bluetooth and try again.');
      setBleBusy(false);
      return;
    }
    setStep('ble-scan');
    setBleBusy(false);
    stopScanRef.current = scanForHydra(dev => {
      setBleDevices(prev => prev.find(d => d.id === dev.id) ? prev : [...prev, dev]);
    });
  };

  const stopBleScan = () => {
    stopScanRef.current?.();
    stopScanRef.current = null;
  };

  const selectDevice = (dev: HydraBleDev) => {
    stopBleScan();
    setSelectedDev(dev);
    setStep('ble-wifi');
  };

  // ─── WiFi provisioning ───────────────────────────────────────────────────────

  const sendWifiCredentials = async () => {
    if (!selectedDev || !ssid.trim()) return;
    setStep('ble-connect');
    setWifiStatus(1); // show "Connecting..."
    try {
      const result = await provisionWifi(
        selectedDev.id,
        ssid.trim(),
        password,
        code => setWifiStatus(code),
      );
      if (result.status === 2) {
        // Connected — now discover via mDNS (controller just joined the network)
        if (result.ip) {
          // Optimistic: use the IP the controller reported directly
          api.setBaseUrl(`http://${result.ip}:3000`);
          setDiscovered({ name: selectedDev.name, host: result.ip, ip: result.ip, port: 3000 });
          setStep('done');
        } else {
          startMdnsDiscover();
        }
      } else {
        Alert.alert(
          'WiFi Failed',
          WIFI_STATUS_LABELS[result.status],
          [{ text: 'Try Again', onPress: () => setStep('ble-wifi') }],
        );
      }
    } catch (err: any) {
      Alert.alert('BLE Error', err?.message ?? 'Failed to communicate with the controller.');
      setStep('ble-wifi');
    }
  };

  // ─── mDNS discovery ──────────────────────────────────────────────────────────

  const startMdnsDiscover = async () => {
    setStep('discover');
    setDiscovering(true);
    setDiscoverError(false);
    try {
      const svc = await discoverHydra(8000);
      setDiscovered(svc);
      api.setBaseUrl(`http://${svc.ip}:${svc.port}`);
      setStep('done');
    } catch {
      setDiscoverError(true);
    } finally {
      setDiscovering(false);
    }
  };

  const saveManualUrl = () => {
    const trimmed = manualUrl.trim();
    if (!trimmed) return;
    api.setBaseUrl(trimmed);
    setStep('done');
  };

  // ─── Render steps ────────────────────────────────────────────────────────────

  if (step === 'home') {
    return (
      <View style={styles.center}>
        <Ionicons name="water" size={64} color={colors.cyan} />
        <Text style={styles.title}>Set Up Your Controller</Text>
        <Text style={styles.subtitle}>
          Configure a new controller via Bluetooth, or find one already on your network.
        </Text>

        <Pressable style={styles.primaryButton} onPress={startBleScan} disabled={bleBusy}>
          {bleBusy
            ? <ActivityIndicator color={colors.bg} />
            : <>
                <Ionicons name="bluetooth" size={18} color={colors.bg} style={{ marginRight: 8 }} />
                <Text style={styles.primaryButtonText}>Configure via Bluetooth</Text>
              </>
          }
        </Pressable>

        <Pressable style={styles.secondaryButton} onPress={startMdnsDiscover}>
          <Text style={styles.secondaryButtonText}>Find on Network (mDNS)</Text>
        </Pressable>

        <Pressable style={styles.tertiaryButton} onPress={() => setStep('manual')}>
          <Text style={styles.tertiaryButtonText}>Enter Address Manually</Text>
        </Pressable>
      </View>
    );
  }

  if (step === 'ble-scan') {
    return (
      <View style={styles.screen}>
        <View style={styles.scanHeader}>
          <ActivityIndicator color={colors.cyan} style={{ marginRight: spacing.sm }} />
          <Text style={styles.scanTitle}>Scanning for controllers...</Text>
        </View>
        <Text style={styles.scanHint}>
          Make sure your Hydra controller is powered on and in setup mode (LED blinking blue).
        </Text>

        {bleDevices.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="bluetooth" size={48} color={colors.textSecondary} />
            <Text style={styles.emptyText}>No controllers found yet</Text>
          </View>
        ) : (
          <FlatList
            data={bleDevices}
            keyExtractor={item => item.id}
            style={styles.list}
            renderItem={({ item }) => (
              <Pressable style={styles.deviceRow} onPress={() => selectDevice(item)}>
                <Ionicons name="bluetooth" size={22} color={colors.cyan} />
                <View style={styles.deviceInfo}>
                  <Text style={styles.deviceName}>{item.name}</Text>
                  <Text style={styles.deviceId}>{item.id}</Text>
                </View>
                <Text style={styles.rssi}>{item.rssi} dBm</Text>
                <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
              </Pressable>
            )}
          />
        )}

        <Pressable style={styles.secondaryButton} onPress={() => { stopBleScan(); setStep('home'); }}>
          <Text style={styles.secondaryButtonText}>Cancel</Text>
        </Pressable>
      </View>
    );
  }

  if (step === 'ble-wifi') {
    return (
      <View style={styles.center}>
        <Ionicons name="wifi" size={56} color={colors.cyan} />
        <Text style={styles.title}>Enter WiFi Credentials</Text>
        <Text style={styles.subtitle}>
          {selectedDev?.name} will connect to your WiFi network.
        </Text>

        <View style={styles.form}>
          <Text style={styles.fieldLabel}>Network Name (SSID)</Text>
          <TextInput
            style={styles.input}
            value={ssid}
            onChangeText={setSsid}
            placeholder="MyHomeNetwork"
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>Password</Text>
          <View style={styles.passwordRow}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={colors.textSecondary}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Pressable style={styles.eyeButton} onPress={() => setShowPassword(v => !v)}>
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={22}
                color={colors.textSecondary}
              />
            </Pressable>
          </View>

          <Pressable
            style={[styles.primaryButton, !ssid.trim() && styles.disabled]}
            onPress={sendWifiCredentials}
            disabled={!ssid.trim()}
          >
            <Text style={styles.primaryButtonText}>Connect Controller</Text>
          </Pressable>

          <Pressable style={styles.secondaryButton} onPress={() => setStep('ble-scan')}>
            <Text style={styles.secondaryButtonText}>Back</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (step === 'ble-connect') {
    const statusLabel = wifiStatus !== null ? WIFI_STATUS_LABELS[wifiStatus] : 'Sending credentials...';
    const isConnecting = wifiStatus === null || wifiStatus === 1;
    return (
      <View style={styles.center}>
        {isConnecting
          ? <ActivityIndicator size="large" color={colors.cyan} />
          : <Ionicons name="wifi" size={64} color={wifiStatus === 2 ? colors.green : colors.amber} />
        }
        <Text style={styles.title}>
          {wifiStatus === 2 ? 'WiFi Connected!' : 'Connecting to WiFi'}
        </Text>
        <Text style={styles.subtitle}>{statusLabel}</Text>
        {wifiStatus === 2 && (
          <Text style={styles.subtitle}>Finding controller on network...</Text>
        )}
      </View>
    );
  }

  if (step === 'discover') {
    return (
      <View style={styles.center}>
        {discovering ? (
          <>
            <ActivityIndicator size="large" color={colors.cyan} />
            <Text style={styles.title}>Finding controller...</Text>
            <Text style={styles.subtitle}>Scanning your network for Hydra via mDNS</Text>
          </>
        ) : (
          <>
            <Ionicons name="wifi" size={64} color={discoverError ? colors.amber : colors.cyan} />
            <Text style={styles.title}>
              {discoverError ? 'Controller Not Found' : 'Find Your Controller'}
            </Text>
            <Text style={styles.subtitle}>
              {discoverError
                ? 'Make sure the controller is on and connected to the same WiFi network.'
                : 'Scan your local network for a Hydra controller.'}
            </Text>
            <Pressable style={styles.primaryButton} onPress={startMdnsDiscover}>
              <Text style={styles.primaryButtonText}>
                {discoverError ? 'Try Again' : 'Scan Network'}
              </Text>
            </Pressable>
            {discoverError && (
              <Pressable style={styles.secondaryButton} onPress={() => setStep('manual')}>
                <Text style={styles.secondaryButtonText}>Enter Address Manually</Text>
              </Pressable>
            )}
            <Pressable style={styles.tertiaryButton} onPress={() => setStep('home')}>
              <Text style={styles.tertiaryButtonText}>Back</Text>
            </Pressable>
          </>
        )}
      </View>
    );
  }

  if (step === 'manual') {
    return (
      <View style={styles.center}>
        <View style={styles.form}>
          <Ionicons name="link" size={48} color={colors.cyan} style={{ alignSelf: 'center' }} />
          <Text style={styles.title}>Enter Server Address</Text>
          <Text style={styles.subtitle}>
            Enter the IP address or hostname of your Hydra controller.
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
          <Pressable style={styles.secondaryButton} onPress={() => setStep('home')}>
            <Text style={styles.secondaryButtonText}>Back</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // done
  return (
    <View style={styles.center}>
      <Ionicons name="checkmark-circle" size={80} color={colors.green} />
      <Text style={styles.title}>All Set!</Text>
      <Text style={styles.subtitle}>
        {discovered
          ? `Connected to ${discovered.name} (${discovered.ip})`
          : 'Your Hydra controller is ready.'}
      </Text>
      <Pressable style={styles.primaryButton} onPress={() => router.replace('/(tabs)')}>
        <Text style={styles.primaryButtonText}>Go to Dashboard</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
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
  fieldLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing.xs,
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
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  eyeButton: {
    padding: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
  },
  primaryButton: {
    backgroundColor: colors.cyan,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
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
    width: '100%',
  },
  secondaryButtonText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  tertiaryButton: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  tertiaryButtonText: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  disabled: {
    opacity: 0.4,
  },
  // BLE scan
  scanHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  scanTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  scanHint: {
    color: colors.textSecondary,
    fontSize: 13,
    marginBottom: spacing.lg,
  },
  list: {
    flex: 1,
  },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  deviceInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  deviceName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  deviceId: {
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  rssi: {
    color: colors.textSecondary,
    fontSize: 12,
    marginRight: spacing.sm,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 15,
  },
});
