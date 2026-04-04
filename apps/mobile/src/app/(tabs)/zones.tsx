import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '@/lib/theme';
import * as api from '@/lib/api';

export default function ZonesScreen() {
  const [zones, setZones] = useState<api.Zone[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [startModal, setStartModal] = useState<api.Zone | null>(null);
  const [durationDraft, setDurationDraft] = useState('15');

  const fetchZones = useCallback(async () => {
    if (!api.getBaseUrl()) return;
    try {
      setZones(await api.getZones());
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchZones();
    const interval = setInterval(fetchZones, 3000);
    return () => clearInterval(interval);
  }, [fetchZones]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchZones();
    setRefreshing(false);
  }, [fetchZones]);

  const handleStart = (zone: api.Zone) => {
    setDurationDraft('15');
    setStartModal(zone);
  };

  const confirmStart = async () => {
    if (!startModal) return;
    const minutes = parseInt(durationDraft || '15', 10);
    if (minutes > 0) {
      await api.startZone(startModal.zone, minutes);
      fetchZones();
    }
    setStartModal(null);
  };

  const handleStop = async (zone: api.Zone) => {
    await api.stopZone(zone.zone);
    fetchZones();
  };

  if (!api.getBaseUrl()) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>Connect to a controller first</Text>
      </View>
    );
  }

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.cyan} />
        }
      >
        {zones.map((zone) => (
          <ZoneCard
            key={zone.zone}
            zone={zone}
            onStart={() => handleStart(zone)}
            onStop={() => handleStop(zone)}
          />
        ))}
        {zones.length === 0 && (
          <Text style={styles.emptyText}>No zones configured</Text>
        )}
      </ScrollView>

      <Modal visible={!!startModal} transparent animationType="fade">
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Start {startModal?.name}</Text>
            <Text style={styles.modalSubtitle}>Duration in minutes</Text>
            <TextInput
              style={styles.modalInput}
              value={durationDraft}
              onChangeText={setDurationDraft}
              placeholder="15"
              placeholderTextColor={colors.textSecondary}
              keyboardType="number-pad"
              autoFocus
              selectTextOnFocus
              onSubmitEditing={confirmStart}
              returnKeyType="done"
            />
            <View style={styles.modalButtons}>
              <Pressable
                style={styles.modalCancel}
                onPress={() => setStartModal(null)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.modalSave} onPress={confirmStart}>
                <Text style={styles.modalSaveText}>Start</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

function ZoneCard({
  zone,
  onStart,
  onStop,
}: {
  zone: api.Zone;
  onStart: () => void;
  onStop: () => void;
}) {
  const isRunning = zone.status === 'running';

  return (
    <View style={[styles.card, isRunning && styles.cardActive]}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.zoneName}>{zone.name}</Text>
          <Text style={styles.zoneNumber}>Zone {zone.zone}</Text>
        </View>
        {isRunning ? (
          <Pressable style={styles.stopButton} onPress={onStop}>
            <Ionicons name="stop" size={18} color="#fff" />
          </Pressable>
        ) : (
          <Pressable style={styles.startButton} onPress={onStart}>
            <Ionicons name="play" size={18} color={colors.bg} />
          </Pressable>
        )}
      </View>

      {isRunning && (
        <>
          {zone.remainingSeconds != null && (
            <View style={styles.progressBg}>
              <View style={[styles.progressFill, { flex: 1 }]} />
            </View>
          )}
          <View style={styles.runningInfo}>
            <Text style={styles.remaining}>
              {zone.remainingSeconds != null
                ? `${Math.floor(zone.remainingSeconds / 60)}m ${zone.remainingSeconds % 60}s remaining`
                : 'Running...'}
            </Text>
            {zone.flowGpm > 0 && (
              <Text style={styles.flowText}>{zone.flowGpm.toFixed(1)} GPM</Text>
            )}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md },
  center: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: { color: colors.textSecondary, fontSize: 16, textAlign: 'center' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardActive: {
    borderColor: colors.cyan,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  zoneName: { color: colors.text, fontSize: 16, fontWeight: '700' },
  zoneNumber: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  startButton: {
    backgroundColor: colors.cyan,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopButton: {
    backgroundColor: colors.red,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressBg: {
    height: 4,
    backgroundColor: colors.surfaceLight,
    borderRadius: 2,
    marginTop: spacing.md,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.cyan,
    borderRadius: 2,
  },
  runningInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  remaining: { color: colors.textSecondary, fontSize: 12 },
  flowText: { color: colors.cyan, fontSize: 12, fontWeight: '600' },
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
  modalTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
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
  modalCancel: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10 },
  modalCancelText: { color: colors.textSecondary, fontSize: 15, fontWeight: '600' },
  modalSave: {
    backgroundColor: colors.cyan,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  modalSaveText: { color: colors.bg, fontSize: 15, fontWeight: '700' },
});
