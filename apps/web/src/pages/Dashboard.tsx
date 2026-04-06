import { useCallback, useState, useEffect } from 'react';
import * as api from '@/lib/api';
import { usePolling, useApi } from '@/hooks/useApi';
import { ZoneCard } from '@/components/ZoneCard';
import { TelemetryCard } from '@/components/TelemetryCard';
import { FlowCard } from '@/components/FlowCard';
import { AlertBanner } from '@/components/AlertBanner';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { WeatherWidget } from '@/components/WeatherWidget';
import { formatDateTime } from '@/lib/locale';
import { ActivityFeed } from '@/components/ActivityFeed';
import { RecentLogs } from '@/components/RecentLogs';
import { SoilSensorCard } from '@/components/SoilSensorCard';


export function Dashboard() {
  const { data: zones, refetch: refetchZones } = usePolling(() => api.getZones(), 2000);
  const { data: status, refetch: refetchStatus } = usePolling(() => api.getSystemStatus(), 3000);
  const { data: alerts, refetch: refetchAlerts } = usePolling(() => api.getAlerts(), 10000);
  const { data: weather } = usePolling(() => api.getWeather().catch(() => null), 60000);
  const { data: logsData } = usePolling(() => api.getLogs({ limit: 50 }), 15000);
  const { data: rainSkips } = usePolling(() => api.getRainSkips().catch(() => []), 10000);
  const { data: schedules } = usePolling(() => api.getSchedules(), 30000);
  const { data: settings } = useApi(() => api.getSettings());
  const { data: soilSettings } = usePolling(() => api.getSoilSettings().catch(() => null), 10000);
  const soilEnabled = soilSettings?.moistureSkipEnabled ?? false;
  const { data: soilDevices } = usePolling(() => api.getSoilDevices().catch(() => []), 10000);
  const { data: soilCurrent } = usePolling(() => api.getSoilCurrent().catch(() => []), 10000);
  const { data: zoneProfiles } = useApi(() => api.getZoneProfiles());
  const [tempUnit, setTempUnit] = useState<'F' | 'C'>('F');

  useEffect(() => {
    if (settings?.temp_unit === 'C' || settings?.temp_unit === 'F') {
      setTempUnit(settings.temp_unit);
    }
  }, [settings]);

  const handleStart = useCallback(async (zone: number) => {
    await api.startZone(zone);
    refetchZones();
    refetchStatus();
  }, [refetchZones, refetchStatus]);

  const handleStop = useCallback(async (zone: number) => {
    await api.stopZone(zone);
    refetchZones();
    refetchStatus();
  }, [refetchZones, refetchStatus]);

  const handleRename = useCallback(async (zone: number, name: string) => {
    await api.updateZone(zone, { name });
    refetchZones();
  }, [refetchZones]);

  const handleDismiss = useCallback(async (id: number) => {
    await api.dismissAlert(id);
    refetchAlerts();
  }, [refetchAlerts]);

  const handleMasterToggle = useCallback(async () => {
    if (!status) return;
    const newState = status.masterValve === 'open' ? 'closed' : 'open';
    await api.setMasterValve(newState);
    refetchStatus();
    refetchZones();
  }, [status, refetchStatus, refetchZones]);

  const runningCount = zones?.filter(z => z.status === 'running').length ?? 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          {/* Mobile: Hydra logo, Desktop: "Dashboard" */}
          <h1 className="font-headline text-display-sm text-on-surface">
            <span className="hidden lg:inline">Dashboard</span>
            <span className="flex lg:hidden items-center gap-2">
              <Icon name="water_drop" size={24} className="text-primary" filled />
              Hydra
            </span>
          </h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            {runningCount > 0
              ? `${runningCount} zone${runningCount > 1 ? 's' : ''} active`
              : 'All zones idle'}
          </p>
        </div>
        <button
          onClick={() => { api.stopAllZones(); refetchZones(); refetchStatus(); }}
          className="flex items-center gap-2 rounded-xl bg-critical/10 px-4 py-2.5 text-sm text-critical hover:bg-critical/20 transition-colors"
        >
          <Icon name="power_settings_new" size={18} />
          <span className="hidden sm:inline">Stop All</span>
        </button>
      </div>

      {/* Alerts */}
      {alerts && alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.slice(0, 3).map((a) => (
            <AlertBanner key={a.id} alert={a} onDismiss={handleDismiss} />
          ))}
        </div>
      )}

      {/* Telemetry Row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Card className="p-4 cursor-pointer hover:bg-surface-container-high transition-colors" accent={status?.masterValve === 'open' ? 'cyan' : 'none'}>
          <button onClick={handleMasterToggle} className="w-full text-left">
            <span className="text-label-sm uppercase tracking-widest text-on-surface-variant block mb-1">
              Master Valve
            </span>
            <div className="flex items-center gap-2">
              <Icon
                name={status?.masterValve === 'open' ? 'lock_open' : 'lock'}
                className={status?.masterValve === 'open' ? 'text-primary' : 'text-on-surface-variant'}
                size={20}
              />
              <span className={`font-headline text-headline-md ${
                status?.masterValve === 'open' ? 'text-primary-light' : 'text-on-surface-variant'
              }`}>
                {status?.masterValve === 'open' ? 'OPEN' : 'CLOSED'}
              </span>
            </div>
          </button>
        </Card>

        <FlowCard
          flowGpm={status?.flowGpm ?? 0}
          dailyTotalGallons={status?.dailyTotalGallons ?? 0}
        />

        {weather ? (
          <WeatherSnap weather={weather} tempUnit={tempUnit} onUnitChange={setTempUnit} />
        ) : (
          <TelemetryCard icon="cloud" label="Weather" value="--" />
        )}
      </div>

      {/* Rain Delay — single consolidated card */}
      {status?.rainDelayActive && (
        <Card accent="amber" className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Icon name="water_drop" className="text-secondary" size={20} />
              <div>
                <h3 className="font-headline text-headline-sm text-on-surface">Rain Delay Active</h3>
                <p className="text-sm text-on-surface-variant">
                  Smart delay has paused all non-priority schedules.
                  {status.rainDelayUntil && <> Until {formatDateTime(status.rainDelayUntil)}</>}
                </p>
              </div>
            </div>
            <button
              onClick={async () => { await api.setRainDelay(undefined, true); refetchStatus(); refetchAlerts(); }}
              className="rounded-lg bg-secondary/10 px-3 py-1.5 text-sm text-secondary hover:bg-secondary/20 transition-colors"
            >
              Clear
            </button>
          </div>
        </Card>
      )}

      {/* Heat Wave Alert */}
      {weather?.heatWave?.active && (
        <Card accent="critical" className="p-4">
          <div className="flex items-center gap-3">
            <Icon name="local_fire_department" className="text-critical" size={22} />
            <div>
              <h3 className="font-headline text-headline-sm text-on-surface">
                Heat Wave {weather.heatWave.severity === 'extreme' ? '— Extreme' : 'Warning'}
              </h3>
              <p className="text-sm text-on-surface-variant">
                {weather.heatWave.consecutiveDays} day{weather.heatWave.consecutiveDays > 1 ? 's' : ''} above{' '}
                {weather.heatWave.peakTempF != null && (
                  <>threshold (peak {tempUnit === 'C' ? Math.round((weather.heatWave.peakTempF - 32) * 5 / 9) : Math.round(weather.heatWave.peakTempF)}°{tempUnit}). </>
                )}
                Smart zones boosted {Math.round((weather.heatWave.boostMultiplier - 1) * 100)}% to compensate.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Main 2-Column Layout: Zones + Activity (left) | Weather + Logs (right) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Left Column (8/12) */}
        <div className="xl:col-span-8 space-y-6">
          {/* Zone Irrigation Matrix */}
          <div>
            <div className="border-b border-outline-variant/10 pb-3 mb-4">
              <h2 className="font-headline text-headline-md text-on-surface">Zone Irrigation Matrix</h2>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {zones?.map((zone) => (
                <ZoneCard
                  key={zone.zone}
                  zone={zone}
                  schedules={schedules?.filter(s => s.zone === zone.zone)}
                  profile={zoneProfiles?.find(p => p.zone === zone.zone)}
                  soilMoisture={soilEnabled ? soilCurrent?.find(s => s.zone === zone.zone) : null}
                  onStart={handleStart}
                  onStop={handleStop}
                  onRename={handleRename}
                />
              ))}
            </div>
          </div>

          {/* 24-Hour Activity Feed */}
          <ActivityFeed logs={logsData?.logs ?? []} />
        </div>

        {/* Right Column (4/12) */}
        <div className="xl:col-span-4 space-y-6">
          {/* Soil Moisture Sensors */}
          {soilEnabled && soilDevices && soilDevices.length > 0 && (
            <div>
              <h2 className="font-headline text-headline-sm text-on-surface mb-3">Soil Sensors</h2>
              <div className="space-y-3">
                {soilDevices.map((d) => {
                  const live = soilCurrent?.find(s => s.friendlyName === d.device);
                  return (
                    <SoilSensorCard
                      key={d.device}
                      device={d}
                      liveReading={live}
                      zoneName={d.zone != null ? zones?.find(z => z.zone === d.zone)?.name : null}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Weather Widget */}
          {weather && (
            <WeatherWidget
              weather={weather}
              tempUnit={tempUnit}
              onUnitChange={setTempUnit}
              rainDelayActive={status?.rainDelayActive}
              rainSkips={rainSkips ?? undefined}
            />
          )}

          {/* Recent Log Entries */}
          <RecentLogs logs={logsData?.logs ?? []} />
        </div>
      </div>
    </div>
  );
}

// ── Compact weather card for telemetry row ──────────────

const WMO_ICONS: Record<number, string> = {
  0: 'sunny', 1: 'partly_cloudy_day', 2: 'partly_cloudy_day', 3: 'cloud',
  45: 'foggy', 48: 'foggy', 51: 'grain', 53: 'grain', 55: 'grain',
  61: 'rainy', 63: 'rainy', 65: 'rainy', 71: 'ac_unit', 73: 'ac_unit', 75: 'ac_unit',
  80: 'rainy', 81: 'rainy', 82: 'rainy', 95: 'thunderstorm', 96: 'thunderstorm', 99: 'thunderstorm',
};

function toC(f: number): number { return (f - 32) * 5 / 9; }

function WeatherSnap({ weather, tempUnit, onUnitChange }: {
  weather: api.WeatherData;
  tempUnit: 'F' | 'C';
  onUnitChange: (u: 'F' | 'C') => void;
}) {
  const temp = tempUnit === 'C' ? toC(weather.temperatureF) : weather.temperatureF;
  const iconName = WMO_ICONS[weather.weatherCode] ?? 'cloud';
  const precip = weather.precipitationProbability;

  const toggleUnit = async () => {
    const next = tempUnit === 'F' ? 'C' : 'F';
    onUnitChange(next);
    await api.updateSettings({ temp_unit: next });
  };

  return (
    <Card accent={precip >= 40 ? 'amber' : 'none'} className="p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon name={iconName} className="text-primary" size={18} />
        <span className="text-label-sm uppercase tracking-widest text-on-surface-variant">
          Weather
        </span>
      </div>
      <div className="flex items-baseline gap-1">
        <button onClick={toggleUnit} className="font-headline text-display-sm text-on-surface hover:text-primary transition-colors">
          {Math.round(temp)}°
        </button>
        <span className="text-label-md text-on-surface-variant">{tempUnit}</span>
      </div>
      <p className="mt-1 text-label-sm text-on-surface-variant opacity-70">
        {weather.description} · {precip}% rain
      </p>
    </Card>
  );
}
