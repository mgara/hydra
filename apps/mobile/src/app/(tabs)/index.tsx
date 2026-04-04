import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '@/lib/theme';
import * as api from '@/lib/api';

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function DashboardScreen() {
  const router = useRouter();
  const [status, setStatus] = useState<api.SystemStatus | null>(null);
  const [connected, setConnected] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStatus = useCallback(async () => {
    if (!api.getBaseUrl()) return;
    try {
      const s = await api.getSystemStatus();
      setStatus(s);
      setConnected(true);
    } catch {
      setConnected(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchStatus();
    setRefreshing(false);
  }, [fetchStatus]);

  if (!api.getBaseUrl()) {
    return (
      <View style={styles.center}>
        <Ionicons name="wifi-outline" size={64} color={colors.textSecondary} />
        <Text style={styles.emptyTitle}>No Controller Connected</Text>
        <Text style={styles.emptySubtitle}>
          Set up your Hydra controller to get started
        </Text>
        <Pressable
          style={styles.primaryButton}
          onPress={() => router.push('/setup')}
        >
          <Text style={styles.primaryButtonText}>Setup Controller</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.cyan}
        />
      }
    >
      {/* Connection status */}
      <View style={[styles.statusBadge, connected ? styles.online : styles.offline]}>
        <View style={[styles.dot, { backgroundColor: connected ? colors.green : colors.red }]} />
        <Text style={styles.statusText}>
          {connected ? 'Online' : 'Offline'}
        </Text>
      </View>

      {status && (
        <>
          {/* Master valve */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Master Valve</Text>
            <Text style={[
              styles.valveStatus,
              { color: status.masterValve === 'open' ? colors.cyan : colors.textSecondary },
            ]}>
              {status.masterValve === 'open' ? 'OPEN' : 'CLOSED'}
            </Text>
          </View>

          {/* Stats grid */}
          <View style={styles.grid}>
            <StatCard
              icon="water"
              label="Flow"
              value={`${status.flowGpm.toFixed(1)} GPM`}
            />
            <StatCard
              icon="speedometer"
              label="Pressure"
              value={`${status.pressurePsi.toFixed(0)} PSI`}
            />
            <StatCard
              icon="today"
              label="Daily Usage"
              value={`${status.dailyTotalGallons.toFixed(1)} gal`}
            />
            <StatCard
              icon="timer"
              label="Uptime"
              value={formatUptime(status.uptimeSeconds)}
            />
            <StatCard
              icon="thermometer"
              label="CPU Temp"
              value={status.cpuTempC ? `${status.cpuTempC.toFixed(1)}°C` : '—'}
            />
            <StatCard
              icon="hardware-chip"
              label="Memory"
              value={status.memoryUsagePercent ? `${status.memoryUsagePercent}%` : '—'}
            />
          </View>

          {/* Active zones */}
          {status.activeZones > 0 && (
            <View style={[styles.card, { borderLeftColor: colors.cyan, borderLeftWidth: 3 }]}>
              <Text style={styles.cardTitle}>
                {status.activeZones} Zone{status.activeZones > 1 ? 's' : ''} Running
              </Text>
            </View>
          )}

          {/* Rain delay */}
          {status.rainDelayActive && (
            <View style={[styles.card, { borderLeftColor: colors.amber, borderLeftWidth: 3 }]}>
              <Text style={styles.cardTitle}>Rain Delay Active</Text>
              {status.rainDelayUntil && (
                <Text style={styles.cardSubtitle}>
                  Until {new Date(status.rainDelayUntil).toLocaleString()}
                </Text>
              )}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

function StatCard({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <Ionicons name={icon as any} size={20} color={colors.cyan} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
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
    padding: spacing.xl,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
    marginTop: spacing.md,
  },
  emptySubtitle: {
    color: colors.textSecondary,
    fontSize: 14,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  primaryButton: {
    backgroundColor: colors.cyan,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 12,
    marginTop: spacing.lg,
  },
  primaryButtonText: {
    color: colors.bg,
    fontSize: 16,
    fontWeight: '700',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: spacing.md,
  },
  online: { backgroundColor: 'rgba(0,204,102,0.15)' },
  offline: { backgroundColor: 'rgba(255,68,68,0.15)' },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  statusText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  cardSubtitle: { color: colors.textSecondary, fontSize: 13, marginTop: 4 },
  valveStatus: { fontSize: 28, fontWeight: '800', marginTop: spacing.sm },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  statCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    width: '48%',
    flexGrow: 1,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    marginTop: spacing.sm,
  },
  statLabel: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
});
