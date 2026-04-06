import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '@/lib/theme';
import * as api from '@/lib/api';
import { discoverHydra } from '@/lib/discovery';

export default function SettingsScreen() {
  const router = useRouter();
  const [serverUrl, setServerUrl] = useState(api.getBaseUrl());
  const [showUrlModal, setShowUrlModal] = useState(false);
  const [urlDraft, setUrlDraft] = useState('');
  const [discovering, setDiscovering] = useState(false);

  const openUrlModal = () => {
    setUrlDraft(serverUrl);
    setShowUrlModal(true);
  };

  const saveUrl = () => {
    const trimmed = urlDraft.trim();
    if (trimmed) {
      api.setBaseUrl(trimmed);
      setServerUrl(trimmed);
    }
    setShowUrlModal(false);
  };

  const handleRediscover = async () => {
    setDiscovering(true);
    try {
      const svc = await discoverHydra(6000);
      const url = `http://${svc.ip}:${svc.port}`;
      api.setBaseUrl(url);
      setServerUrl(url);
      Alert.alert('Found', `Connected to ${svc.name} (${svc.ip})`);
    } catch {
      Alert.alert('Not Found', 'No Hydra controller found on your network.');
    } finally {
      setDiscovering(false);
    }
  };

  const handleForceShutdown = () => {
    Alert.alert(
      'Force Shutdown',
      'This will stop all zones and close the master valve. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Shutdown',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.forceShutdown();
              Alert.alert('Done', 'All zones stopped, master valve closed.');
            } catch {
              Alert.alert('Error', 'Failed to execute shutdown.');
            }
          },
        },
      ],
    );
  };

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <SettingsRow
          icon="search"
          label="Setup New Controller"
          onPress={() => router.push('/setup')}
        />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Connection</Text>
          <SettingsRow
            icon="refresh"
            label="Re-discover Server"
            subtitle={discovering ? 'Scanning...' : (serverUrl || 'Not connected')}
            onPress={handleRediscover}
            trailing={discovering ? <ActivityIndicator size="small" color={colors.cyan} /> : undefined}
          />
          <SettingsRow
            icon="server"
            label="Manual Server URL"
            subtitle={serverUrl || 'Not configured'}
            onPress={openUrlModal}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Danger Zone</Text>
          <SettingsRow
            icon="alert-circle"
            label="Force Shutdown"
            subtitle="Stop all zones, close master valve"
            danger
            onPress={handleForceShutdown}
          />
        </View>
      </ScrollView>

      <Modal visible={showUrlModal} transparent animationType="fade">
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Server URL</Text>
            <Text style={styles.modalSubtitle}>
              Enter the Hydra server address
            </Text>
            <TextInput
              style={styles.modalInput}
              value={urlDraft}
              onChangeText={setUrlDraft}
              placeholder="http://192.168.1.50:3000"
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              autoFocus
              selectTextOnFocus
              onSubmitEditing={saveUrl}
              returnKeyType="done"
            />
            <View style={styles.modalButtons}>
              <Pressable
                style={styles.modalCancel}
                onPress={() => setShowUrlModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.modalSave} onPress={saveUrl}>
                <Text style={styles.modalSaveText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

function SettingsRow({
  icon,
  label,
  subtitle,
  danger,
  trailing,
  onPress,
}: {
  icon: string;
  label: string;
  subtitle?: string;
  danger?: boolean;
  trailing?: React.ReactNode;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <Ionicons
        name={icon as any}
        size={22}
        color={danger ? colors.red : colors.cyan}
      />
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, danger && { color: colors.red }]}>{label}</Text>
        {subtitle && <Text style={styles.rowSubtitle}>{subtitle}</Text>}
      </View>
      {trailing ?? <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md },
  section: { marginTop: spacing.lg },
  sectionTitle: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowText: { flex: 1, marginLeft: spacing.md },
  rowLabel: { color: colors.text, fontSize: 15, fontWeight: '600' },
  rowSubtitle: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  modalSubtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 4,
    marginBottom: spacing.md,
  },
  modalInput: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 14,
    color: colors.text,
    fontSize: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  modalCancel: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  modalCancelText: { color: colors.textSecondary, fontSize: 15, fontWeight: '600' },
  modalSave: {
    backgroundColor: colors.cyan,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  modalSaveText: { color: colors.bg, fontSize: 15, fontWeight: '700' },
});
