import { useState, useMemo } from 'react';
import * as api from '@/lib/api';
import { useApi, usePolling } from '@/hooks/useApi';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { formatDateTime } from '@/lib/locale';

const DEFAULT_STYLE = { bg: 'bg-tertiary/10 border-tertiary/20', text: 'text-tertiary', dot: 'bg-tertiary' };
const STATUS_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  completed:   { bg: 'bg-tertiary/10 border-tertiary/20', text: 'text-tertiary', dot: 'bg-tertiary shadow-[0_0_8px_rgba(75,241,255,0.6)]' },
  rain_skip:   { bg: 'bg-secondary/10 border-secondary/20', text: 'text-secondary', dot: 'bg-secondary shadow-[0_0_8px_rgba(255,219,157,0.6)]' },
  manual_stop: { bg: 'bg-on-surface-variant/10 border-outline-variant/20', text: 'text-on-surface-variant', dot: 'bg-on-surface-variant' },
  leak_alarm:  { bg: 'bg-error/10 border-error/20', text: 'text-error', dot: 'bg-error shadow-[0_0_8px_rgba(255,180,171,0.6)]' },
  error:       { bg: 'bg-error/10 border-error/20', text: 'text-error', dot: 'bg-error shadow-[0_0_8px_rgba(255,180,171,0.6)]' },
};

function fmtDuration(seconds: number | null): string {
  if (seconds == null) return '--:--';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')} min`;
}

function fmtVolume(gal: number | null): string {
  if (gal == null) return '0 L';
  const liters = gal * 3.785;
  if (liters >= 1000) return `${(liters / 1000).toFixed(1)} kL`;
  return `${Math.round(liters)} L`;
}

function triggerLabel(log: api.ExecutionLog): string {
  if (log.trigger_type === 'scheduled') return 'Scheduled Cycle';
  return 'Manual Override';
}

export function Logs() {
  const [page, setPage] = useState(1);
  const [zoneFilter, setZoneFilter] = useState<number | undefined>(undefined);
  const limit = 10;
  const offset = (page - 1) * limit;

  const { data } = useApi(
    () => api.getLogs({ limit, offset, zone: zoneFilter }),
    [page, zoneFilter],
  );
  const { data: zones } = useApi(() => api.getZones());
  const { data: status } = usePolling(() => api.getSystemStatus(), 5000);

  // Aggregate stats from all logs (fetch a larger set for stats)
  const { data: allLogs } = useApi(() => api.getLogs({ limit: 500 }));

  const stats = useMemo(() => {
    if (!allLogs?.logs) return { weeklyVolume: 0, efficiency: 0 };
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const weekLogs = allLogs.logs.filter(l => new Date(l.started_at) >= weekAgo);
    const weeklyVolume = weekLogs.reduce((sum, l) => sum + (l.volume_gallons ?? 0), 0) * 3.785 / 1000; // kL
    const completed = weekLogs.filter(l => l.status === 'completed').length;
    const efficiency = weekLogs.length > 0 ? (completed / weekLogs.length) * 100 : 100;
    return { weeklyVolume, efficiency };
  }, [allLogs]);

  // 30-day chart buckets
  const chartBuckets = useMemo(() => {
    const buckets = new Array(30).fill(0);
    if (!allLogs?.logs) return buckets;
    const now = new Date();
    for (const log of allLogs.logs) {
      const d = new Date(log.started_at);
      const daysAgo = Math.floor((now.getTime() - d.getTime()) / (24 * 60 * 60 * 1000));
      if (daysAgo >= 0 && daysAgo < 30) {
        buckets[29 - daysAgo] += (log.volume_gallons ?? 0) * 3.785 / 1000;
      }
    }
    return buckets;
  }, [allLogs]);

  const chartMax = Math.max(...chartBuckets, 0.1);
  const totalPages = data ? Math.ceil(data.total / limit) : 1;
  const activeZones = zones?.filter(z => z.status === 'running').length ?? 0;
  const totalZones = zones?.length ?? 0;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <span className="font-headline uppercase tracking-[0.2rem] text-[0.6875rem] text-on-surface-variant/60">System Monitoring</span>
          <h1 className="font-headline text-4xl font-bold text-primary mt-1">Execution Logs</h1>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-surface-container-high hover:bg-surface-container-highest transition-colors text-sm font-medium border border-outline-variant/20 rounded-md">
            <Icon name="filter_list" size={16} />
            Filter View
          </button>
          <button
            onClick={() => exportCsv(data?.logs ?? [])}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary hover:shadow-glow transition-all text-sm font-bold rounded-md"
          >
            <Icon name="download" size={16} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Aggregate Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6 border-l-2 border-primary relative overflow-hidden group">
          <p className="font-headline uppercase tracking-[0.1rem] text-[0.6875rem] text-on-surface-variant">Total Weekly Volume</p>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-4xl font-headline font-bold text-on-surface">{stats.weeklyVolume.toFixed(1)}</span>
            <span className="text-xl font-headline font-medium text-primary">kL</span>
          </div>
          <div className="absolute bottom-0 right-0 opacity-[0.06] group-hover:opacity-[0.12] transition-opacity pointer-events-none">
            <Icon name="water_drop" size={80} />
          </div>
        </Card>

        <Card className="p-6 border-l-2 border-tertiary relative overflow-hidden group">
          <p className="font-headline uppercase tracking-[0.1rem] text-[0.6875rem] text-on-surface-variant">System Efficiency</p>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-4xl font-headline font-bold text-on-surface">{stats.efficiency.toFixed(1)}</span>
            <span className="text-xl font-headline font-medium text-tertiary">%</span>
          </div>
          <div className="flex items-center gap-2 mt-4 text-[0.75rem] text-on-surface-variant">
            <Icon name="check_circle" size={14} />
            <span>{stats.efficiency >= 90 ? 'Optimal performance' : 'Below optimal'}</span>
          </div>
          <div className="absolute bottom-0 right-0 opacity-[0.06] group-hover:opacity-[0.12] transition-opacity pointer-events-none">
            <Icon name="bolt" size={80} />
          </div>
        </Card>

        <Card className="p-6 border-l-2 border-secondary relative overflow-hidden group">
          <p className="font-headline uppercase tracking-[0.1rem] text-[0.6875rem] text-on-surface-variant">Active Zone Status</p>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-4xl font-headline font-bold text-on-surface">{String(activeZones).padStart(2, '0')}</span>
            <span className="text-xl font-headline font-medium text-secondary">/ {totalZones}</span>
          </div>
          <div className="flex items-center gap-2 mt-4 text-[0.75rem] text-on-surface-variant">
            <Icon name="schedule" size={14} />
            <span>{status?.rainDelayActive ? 'Rain delay active' : `${activeZones} zone${activeZones !== 1 ? 's' : ''} running`}</span>
          </div>
          <div className="absolute bottom-0 right-0 opacity-[0.06] group-hover:opacity-[0.12] transition-opacity pointer-events-none">
            <Icon name="grid_view" size={80} />
          </div>
        </Card>
      </div>

      {/* 30-Day Water Consumption Chart */}
      <Card className="p-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h3 className="font-headline font-bold text-lg text-on-surface">30-Day Water Consumption</h3>
            <p className="text-sm text-on-surface-variant">Daily distribution of volumetric output</p>
          </div>
          <span className="flex items-center gap-2 text-xs font-medium text-on-surface-variant">
            <span className="w-3 h-3 bg-primary rounded-sm" /> Volume (kL)
          </span>
        </div>
        <div className="h-48 flex items-end justify-between gap-[3px] px-1">
          {chartBuckets.map((val, i) => (
            <div
              key={i}
              className="flex-1 bg-primary/20 hover:bg-primary/40 transition-colors rounded-t-sm relative group"
              style={{ height: `${Math.max((val / chartMax) * 100, 2)}%` }}
            >
              {val > 0 && (
                <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-surface-bright text-[10px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                  {val.toFixed(1)}
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="mt-4 pt-4 border-t border-outline-variant/10 flex justify-between text-[0.6875rem] font-medium text-on-surface-variant/40 tracking-wider">
          <span>30 DAYS AGO</span>
          <span>15 DAYS AGO</span>
          <span>CURRENT CYCLE</span>
        </div>
      </Card>

      {/* Execution Logs Table */}
      <Card className="overflow-hidden">
        {/* Filters */}
        <div className="px-6 py-4 border-b border-outline-variant/10 flex flex-wrap gap-4 items-center justify-between bg-surface-container">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <label className="font-headline uppercase tracking-widest text-[10px] text-on-surface-variant">Zone</label>
              <select
                value={zoneFilter ?? ''}
                onChange={(e) => { setZoneFilter(e.target.value ? Number(e.target.value) : undefined); setPage(1); }}
                className="bg-surface-container-lowest text-xs font-medium px-3 py-1.5 rounded border-none focus:ring-1 focus:ring-primary/40 text-on-surface"
              >
                <option value="">All Zones</option>
                {zones?.map(z => (
                  <option key={z.zone} value={z.zone}>Zone {String(z.zone).padStart(2, '0')} - {z.name}</option>
                ))}
              </select>
            </div>
          </div>
          <span className="text-xs text-on-surface-variant">{data?.total ?? 0} total events</span>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-high/50">
                <th className="px-6 py-4 font-headline uppercase tracking-widest text-[10px] text-on-surface-variant">Timestamp</th>
                <th className="px-6 py-4 font-headline uppercase tracking-widest text-[10px] text-on-surface-variant">Zone</th>
                <th className="px-6 py-4 font-headline uppercase tracking-widest text-[10px] text-on-surface-variant">Duration</th>
                <th className="px-6 py-4 font-headline uppercase tracking-widest text-[10px] text-on-surface-variant text-right">Volume</th>
                <th className="px-6 py-4 font-headline uppercase tracking-widest text-[10px] text-on-surface-variant text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10 text-sm">
              {data?.logs.map((log) => {
                const style = STATUS_STYLES[log.status] ?? DEFAULT_STYLE;
                return (
                  <tr key={log.id} className="hover:bg-primary/5 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-on-surface">{formatDateTime(log.started_at)}</div>
                      <div className="text-[10px] text-on-surface-variant uppercase tracking-tight">{triggerLabel(log)}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="flex items-center gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                        ZONE {String(log.zone).padStart(2, '0')}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono">{fmtDuration(log.duration_seconds)}</td>
                    <td className="px-6 py-4 text-right font-headline font-medium">{fmtVolume(log.volume_gallons)}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full ${style.bg} ${style.text} text-[10px] font-bold uppercase tracking-wider border`}>
                        {log.status.replace('_', ' ')}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {(!data?.logs || data.logs.length === 0) && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-on-surface-variant">No execution logs found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && data.total > limit && (
          <div className="px-6 py-4 border-t border-outline-variant/10 flex items-center justify-between bg-surface-container/30">
            <p className="text-xs text-on-surface-variant">
              Showing {offset + 1}-{Math.min(offset + limit, data.total)} of {data.total.toLocaleString()} events
            </p>
            <div className="flex items-center gap-1">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="p-1 text-on-surface-variant hover:text-on-surface transition-colors disabled:opacity-20"
              >
                <Icon name="chevron_left" size={20} />
              </button>
              <PageButtons current={page} total={totalPages} onPage={setPage} />
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                className="p-1 text-on-surface-variant hover:text-on-surface transition-colors disabled:opacity-20"
              >
                <Icon name="chevron_right" size={20} />
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

function PageButtons({ current, total, onPage }: { current: number; total: number; onPage: (p: number) => void }) {
  const pages: (number | '...')[] = [];

  if (total <= 5) {
    for (let i = 1; i <= total; i++) pages.push(i);
  } else {
    pages.push(1);
    if (current > 3) pages.push('...');
    for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) pages.push(i);
    if (current < total - 2) pages.push('...');
    pages.push(total);
  }

  return (
    <>
      {pages.map((p, i) =>
        p === '...' ? (
          <span key={`dot-${i}`} className="px-1 text-on-surface-variant text-xs">...</span>
        ) : (
          <button
            key={p}
            onClick={() => onPage(p)}
            className={`w-8 h-8 flex items-center justify-center rounded text-xs font-bold transition-colors ${
              p === current
                ? 'bg-primary text-on-primary'
                : 'hover:bg-surface-container-highest text-on-surface-variant'
            }`}
          >
            {p}
          </button>
        ),
      )}
    </>
  );
}

function exportCsv(logs: api.ExecutionLog[]) {
  const header = 'Timestamp,Zone,Duration (s),Volume (gal),Status,Trigger\n';
  const rows = logs.map(l =>
    `"${l.started_at}",${l.zone},${l.duration_seconds ?? ''},${l.volume_gallons ?? ''},${l.status},${l.trigger_type}`,
  ).join('\n');
  const blob = new Blob([header + rows], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `hydra-logs-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
