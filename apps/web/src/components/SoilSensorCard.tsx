import { usePolling } from '@/hooks/useApi';
import * as api from '@/lib/api';
import { Card } from './Card';
import { Icon } from './Icon';
import type { SoilReading, SoilDevice } from '@/lib/api';
import { formatTime, formatShortDate } from '@/lib/locale';

interface SoilSensorCardProps {
  device: SoilDevice;
  liveReading?: SoilReading | null;
  zoneName?: string | null;
}

export function SoilSensorCard({ device, liveReading, zoneName }: SoilSensorCardProps) {
  const hasData = !!liveReading;
  const moistureLevel = hasData ? getMoistureLevel(liveReading.moisture) : null;
  const batteryLevel = hasData ? getBatteryLevel(liveReading.battery) : null;
  const signalLevel = hasData ? getSignalLevel(liveReading.linkQuality) : null;

  // Fetch 24h history for sparkline
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: history } = usePolling(
    () => api.getSoilReadings({ device: device.device, since, limit: 200 }),
    30000,
  );

  // Reverse so oldest→newest for sparkline
  const chartData = history ? [...history].reverse().map(r => r.moisture) : [];

  return (
    <Card accent={moistureLevel?.accent ?? 'none'} className="p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon name="sensors" className={hasData ? 'text-on-surface-variant' : 'text-on-surface-variant/40'} size={18} />
          <span className="text-label-sm uppercase tracking-widest text-on-surface-variant">
            {device.device}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {zoneName && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[0.625rem] font-bold uppercase tracking-widest text-primary">
              {zoneName}
            </span>
          )}
          {device.zone == null && (
            <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-[0.625rem] uppercase tracking-widest text-on-surface-variant">
              General
            </span>
          )}
        </div>
      </div>

      {hasData ? (
        <>
          {/* Moisture — main reading */}
          <div className="flex items-end gap-3 mb-2">
            <div className="flex-1">
              <div className="flex items-baseline gap-1">
                <span className={`font-headline text-display-sm ${moistureLevel!.textColor}`}>
                  {liveReading.moisture.toFixed(0)}
                </span>
                <span className="text-label-md text-on-surface-variant">%</span>
              </div>
              <p className="text-label-sm text-on-surface-variant opacity-70">
                {moistureLevel!.label}
              </p>
            </div>
            <div className="flex-1 max-w-[100px]">
              <MoistureBar percentage={liveReading.moisture} accent={moistureLevel!.accent} />
            </div>
          </div>

          {/* 24h sparkline */}
          {chartData.length > 1 && (
            <div className="mb-2">
              <MoistureSparkline data={chartData} accent={moistureLevel!.accent} />
              <div className="flex justify-between text-[0.5rem] text-on-surface-variant/40 mt-0.5">
                <span>24h ago</span>
                <span>now</span>
              </div>
            </div>
          )}

          {/* Temp + Battery + Signal row */}
          <div className="flex items-center gap-4 pt-2 border-t border-outline-variant/10">
            <div className="flex items-center gap-1.5">
              <Icon name="thermostat" className="text-on-surface-variant" size={14} />
              <span className="text-label-sm text-on-surface">
                {liveReading.temperature.toFixed(1)}
              </span>
              <span className="text-label-sm text-on-surface-variant">°C</span>
            </div>

            {liveReading.battery != null && (
              <div className="flex items-center gap-1.5">
                <Icon name={batteryLevel!.icon} className={batteryLevel!.color} size={14} />
                <span className={`text-label-sm ${batteryLevel!.color}`}>
                  {liveReading.battery}%
                </span>
              </div>
            )}

            {liveReading.linkQuality != null && (
              <div className="flex items-center gap-1.5">
                <Icon name="signal_cellular_alt" className={signalLevel!.color} size={14} />
                <span className={`text-label-sm ${signalLevel!.color}`}>
                  {liveReading.linkQuality}
                </span>
              </div>
            )}
          </div>

          {/* Last updated */}
          <div className="mt-2 pt-1.5 flex items-center gap-1.5 text-[0.625rem] text-on-surface-variant/50">
            <Icon name="schedule" size={11} className="text-on-surface-variant/40" />
            {formatTimestamp(liveReading.timestamp)}
          </div>
        </>
      ) : (
        /* Awaiting first reading */
        <div className="flex items-center gap-3 py-2">
          <div className="h-2 w-2 rounded-full bg-secondary animate-pulse" />
          <div>
            <p className="text-sm text-on-surface-variant">Awaiting first reading</p>
            {device.model && (
              <p className="text-[0.625rem] text-on-surface-variant/60">{device.model}</p>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

// ── Moisture sparkline (24h) ────────────────────────────

function MoistureSparkline({ data, accent }: { data: number[]; accent: 'cyan' | 'amber' | 'critical' | 'none' }) {
  const width = 200;
  const height = 40;
  const pad = 2;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const step = (width - pad * 2) / Math.max(data.length - 1, 1);

  const points = data
    .map((v, i) => {
      const x = pad + i * step;
      const y = height - pad - ((v - min) / range) * (height - pad * 2);
      return `${x},${y}`;
    })
    .join(' ');

  // Area fill path
  const firstX = pad;
  const lastX = pad + (data.length - 1) * step;
  const areaPath = `M${firstX},${height} L${points.split(' ').map(p => p).join(' L')} L${lastX},${height} Z`;

  const strokeColor = accent === 'cyan' ? 'var(--color-primary, #00D1FF)'
    : accent === 'amber' ? 'var(--color-secondary, #FFB800)'
    : accent === 'critical' ? 'var(--color-critical, #FFB4AB)'
    : 'var(--color-on-surface-variant, #999)';

  const fillColor = accent === 'cyan' ? 'rgba(0, 209, 255, 0.08)'
    : accent === 'amber' ? 'rgba(255, 184, 0, 0.08)'
    : accent === 'critical' ? 'rgba(255, 180, 171, 0.08)'
    : 'rgba(153, 153, 153, 0.05)';

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-10" preserveAspectRatio="none">
      <path d={areaPath} fill={fillColor} />
      <polyline
        points={points}
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ── Moisture bar ────────────────────────────────────────

function MoistureBar({ percentage, accent }: { percentage: number; accent: 'cyan' | 'amber' | 'critical' | 'none' }) {
  const clamped = Math.max(0, Math.min(100, percentage));
  const barColor = accent === 'cyan' ? 'bg-primary'
    : accent === 'amber' ? 'bg-secondary'
    : accent === 'critical' ? 'bg-critical'
    : 'bg-on-surface-variant';

  return (
    <div className="space-y-1">
      <div className="h-1.5 rounded-full bg-surface-container-high overflow-hidden">
        <div
          className={`h-full rounded-full ${barColor} transition-all duration-500`}
          style={{ width: `${clamped}%` }}
        />
      </div>
      <div className="flex justify-between text-[0.5rem] text-on-surface-variant opacity-50">
        <span>DRY</span>
        <span>WET</span>
      </div>
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────

function getMoistureLevel(moisture: number): { label: string; accent: 'cyan' | 'amber' | 'critical' | 'none'; textColor: string } {
  if (moisture >= 70) return { label: 'Saturated', accent: 'cyan', textColor: 'text-primary-light' };
  if (moisture >= 40) return { label: 'Adequate', accent: 'none', textColor: 'text-on-surface' };
  if (moisture >= 20) return { label: 'Dry', accent: 'amber', textColor: 'text-secondary' };
  return { label: 'Very Dry', accent: 'critical', textColor: 'text-critical' };
}

function getBatteryLevel(battery: number | null): { icon: string; color: string } {
  if (battery == null) return { icon: 'battery_unknown', color: 'text-on-surface-variant' };
  if (battery <= 10) return { icon: 'battery_alert', color: 'text-critical' };
  if (battery <= 30) return { icon: 'battery_2_bar', color: 'text-secondary' };
  if (battery <= 60) return { icon: 'battery_4_bar', color: 'text-primary-light' };
  return { icon: 'battery_full', color: 'text-emerald-400' };
}

function getSignalLevel(lq: number | null): { color: string } {
  if (lq == null) return { color: 'text-on-surface-variant' };
  if (lq >= 150) return { color: 'text-emerald-400' };
  if (lq >= 80) return { color: 'text-primary-light' };
  if (lq >= 30) return { color: 'text-secondary' };
  return { color: 'text-critical' };
}

function formatTimestamp(ts: string): string {
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();

  const time = formatTime(d);

  if (diffMs < 60000) return `Updated just now`;
  if (diffMs < 3600000) return `Updated ${Math.floor(diffMs / 60000)}m ago · ${time}`;
  if (d.toDateString() === now.toDateString()) return `Updated today at ${time}`;

  const date = formatShortDate(d);
  return `Updated ${date} at ${time}`;
}
