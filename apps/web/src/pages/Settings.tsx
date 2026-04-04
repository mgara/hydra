import { useState, useCallback, useEffect, useRef } from 'react';
import { useApi } from '@/hooks/useApi';
import * as api from '@/lib/api';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { StatusChip } from '@/components/StatusChip';
import { LocationPicker } from '@/components/LocationPicker';
import { Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { THEMES, useTheme } from '@/lib/theme';
import { SOIL_PROFILES, PLANT_PROFILES, getSoilProfile, getPlantProfile, formatRate, formatLength } from '@/lib/zone-profiles';

function useHasBg() {
  const { theme } = useTheme();
  return theme !== 'none';
}

export function Settings() {
  const { data: settings, refetch } = useApi(() => api.getSettings());
  const { data: configData } = useApi(() => api.getSystemConfig());
  const { data: matter } = useApi(() => api.getMatterStatus());
  const { data: zones } = useApi(() => api.getZones());
  const hasBg = useHasBg();

  const config = configData?.config;

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="font-headline text-display-sm text-on-surface">Settings</h1>

      {/* System Config (read-only) */}
      {config && (
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Icon name="memory" className="text-primary" size={20} />
            <h2 className="font-headline text-headline-md text-on-surface">System Configuration</h2>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <InfoField label="Zones" value={String(config.zoneCount)} />
            <InfoField label="Rain Sensor" value={config.hasRainSensor ? 'Enabled' : 'Disabled'} />
            <InfoField label="Per-Zone Flow" value={config.perZoneFlow ? 'Enabled' : 'Disabled'} />
            <InfoField label="Setup" value={config.setupComplete ? 'Complete' : 'Pending'} />
          </div>
        </Card>
      )}

      {/* Units */}
      <UnitsCard settings={settings} onUpdate={refetch} />

      {/* Zone Profiles — soil type + plant type */}
      <ZoneProfilesCard lengthUnit={(settings?.length_unit as 'in' | 'cm') || 'in'} />

      {/* Heat Wave Protection */}
      <HeatWaveCard settings={settings} onUpdate={refetch} />

      {/* Flow Monitoring & Safety */}
      <FlowSettingsCard />

      {/* Soil Moisture Sensors */}
      <SoilSettingsCard zones={zones} />

      {/* Matter Smart Home */}
      {matter && <MatterCard matter={matter} />}

      {/* Theme */}
      <ThemePickerCard />

      {/* Weather Location */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Icon name="public" className="text-primary" size={20} />
          <h2 className="font-headline text-headline-md text-on-surface">Weather Location</h2>
        </div>
        <LocationPicker
          currentName={settings?.weather_location_name ?? ''}
          currentLat={settings?.weather_lat ?? '0'}
          currentLon={settings?.weather_lon ?? '0'}
          onUpdate={refetch}
        />
      </Card>

      {/* Soil & Plant Reference */}
      <IrrigationReferenceCard lengthUnit={(settings?.length_unit as 'in' | 'cm') || 'in'} />

      {/* Advanced link */}
      <Link
        to="/advanced"
        className={`flex items-center justify-between rounded-2xl border border-outline-variant/15 px-6 py-4 transition-colors group ${
          hasBg ? 'glass hover:brightness-125' : 'bg-surface-container-low hover:bg-surface-container-high'
        }`}
      >
        <div className="flex items-center gap-3">
          <Icon name="admin_panel_settings" className="text-on-surface-variant group-hover:text-primary transition-colors" size={20} />
          <div>
            <p className="text-sm font-medium text-on-surface">Advanced Settings</p>
            <p className="text-xs text-on-surface-variant">GPIO assignments, controller settings, and danger zone</p>
          </div>
        </div>
        <Icon name="chevron_right" className="text-on-surface-variant" size={20} />
      </Link>
    </div>
  );
}

function ThemePickerCard() {
  const { theme, setTheme } = useTheme();

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <Icon name="palette" className="text-primary" size={20} />
        <h2 className="font-headline text-headline-md text-on-surface">Background</h2>
      </div>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
        {THEMES.map((t) => (
          <button
            key={t.id}
            onClick={() => setTheme(t.id)}
            className={`flex flex-col items-center gap-2 rounded-xl p-2 transition-all ${
              theme === t.id
                ? 'ring-2 ring-primary bg-surface-container-high'
                : 'hover:bg-surface-container-low'
            }`}
          >
            {t.image ? (
              <div
                className="w-full aspect-video rounded-lg bg-cover bg-center border border-outline-variant/20"
                style={{ backgroundImage: `url(${t.image})` }}
              />
            ) : (
              <div className="w-full aspect-video rounded-lg border border-outline-variant/20 bg-surface flex items-center justify-center">
                <Icon name="block" size={20} className="text-on-surface-variant/40" />
              </div>
            )}
            <span className={`text-xs font-medium ${
              theme === t.id ? 'text-primary' : 'text-on-surface-variant'
            }`}>
              {t.name}
            </span>
          </button>
        ))}
      </div>
    </Card>
  );
}

function FlowSettingsCard() {
  const [flowSettings, setFlowSettings] = useState<api.FlowSettings | null>(null);
  const settingsRef = useRef(flowSettings);
  settingsRef.current = flowSettings;

  useEffect(() => {
    api.getFlowSettings().then(setFlowSettings).catch(() => {});
  }, []);

  const toggle = useCallback(async (key: 'flowMonitoringEnabled' | 'flowSafetyEnabled') => {
    const current = settingsRef.current;
    if (!current) return;
    const newValue = !current[key];
    // Optimistic update
    setFlowSettings(prev => prev ? { ...prev, [key]: newValue } : prev);
    try {
      const updated = await api.updateFlowSettings({ [key]: newValue });
      setFlowSettings(updated);
    } catch (err) {
      console.error('[FlowSettings] Toggle failed:', err);
      // Revert on failure
      setFlowSettings(prev => prev ? { ...prev, [key]: !newValue } : prev);
    }
  }, []);

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <Icon name="sensors" className="text-primary" size={20} />
        <h2 className="font-headline text-headline-md text-on-surface">Flow Sensor</h2>
      </div>

      <div className="space-y-4">
        {/* Flow Monitoring Toggle */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-on-surface">Flow Monitoring</p>
            <p className="text-xs text-on-surface-variant">
              Track real-time flow rate and record usage history
            </p>
          </div>
          <button
            onClick={() => toggle('flowMonitoringEnabled')}
            disabled={!flowSettings}
            className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50"
            style={{ backgroundColor: flowSettings?.flowMonitoringEnabled ? 'var(--color-primary, #00D1FF)' : 'var(--color-outline-variant, #444)' }}
          >
            <span
              className="pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform"
              style={{ transform: flowSettings?.flowMonitoringEnabled ? 'translateX(1.25rem)' : 'translateX(0)' }}
            />
          </button>
        </div>

        <div className="border-t border-outline-variant/15" />

        {/* Flow Safety Toggle */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-on-surface">Flow Safety</p>
            <p className="text-xs text-on-surface-variant">
              Leak detection, no-flow alerts, and excessive flow protection
            </p>
          </div>
          <button
            onClick={() => toggle('flowSafetyEnabled')}
            disabled={!flowSettings?.flowMonitoringEnabled}
            className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50"
            style={{ backgroundColor: (flowSettings?.flowSafetyEnabled && flowSettings?.flowMonitoringEnabled) ? 'var(--color-primary, #00D1FF)' : 'var(--color-outline-variant, #444)' }}
          >
            <span
              className="pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform"
              style={{ transform: (flowSettings?.flowSafetyEnabled && flowSettings?.flowMonitoringEnabled) ? 'translateX(1.25rem)' : 'translateX(0)' }}
            />
          </button>
        </div>

        {!flowSettings?.flowMonitoringEnabled && flowSettings?.flowSafetyEnabled && (
          <p className="text-xs text-secondary">
            Flow monitoring must be enabled for safety features to work.
          </p>
        )}
      </div>
    </Card>
  );
}

function MatterCard({ matter }: { matter: api.MatterStatus }) {
  const [showCode, setShowCode] = useState(false);

  return (
    <Card className="p-6" accent={matter.running ? 'cyan' : 'none'}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <MatterLogo className="w-5 h-5 text-primary" />
          <h2 className="font-headline text-headline-md text-on-surface">Matter Smart Home</h2>
        </div>
        {matter.enabled ? (
          <StatusChip
            label={matter.running ? (matter.commissioned ? 'Paired' : 'Ready') : 'Starting'}
            color={matter.running ? 'cyan' : 'amber'}
            pulse={matter.running && !matter.commissioned}
          />
        ) : (
          <StatusChip label="Disabled" color="neutral" />
        )}
      </div>

      {!matter.enabled && (
        <p className="text-sm text-on-surface-variant">
          Matter is not enabled. Set <code className="text-primary/80 bg-surface-container-high px-1.5 py-0.5 rounded text-xs font-mono">MATTER_ENABLED=true</code> in your environment to enable smart home integration.
        </p>
      )}

      {matter.enabled && matter.running && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <InfoField label="Protocol" value="Matter" />
            <InfoField label="Port" value={String(matter.port)} />
            <InfoField label="Status" value={matter.commissioned ? 'Commissioned' : 'Awaiting Pairing'} />
          </div>

          {/* Compatible platforms */}
          <div className="flex items-center gap-2 pt-2">
            <span className="text-label-sm uppercase tracking-widest text-on-surface-variant">Works with</span>
            <div className="flex items-center gap-3 text-on-surface-variant">
              <span title="Apple Home"><Icon name="home" size={16} /></span>
              <span title="Google Home"><Icon name="nest_cam_wired_stand" size={16} /></span>
              <span title="Amazon Alexa"><Icon name="speaker" size={16} /></span>
            </div>
          </div>

          {/* Pairing code section */}
          {!matter.commissioned && matter.manualPairingCode && (
            <div className="rounded-lg bg-surface-container-low border border-outline-variant/15 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-on-surface">Pairing Code</span>
                <button
                  onClick={() => setShowCode(!showCode)}
                  className="text-xs text-primary hover:text-primary-light transition-colors flex items-center gap-1"
                >
                  <Icon name={showCode ? 'visibility_off' : 'visibility'} size={14} />
                  {showCode ? 'Hide' : 'Show'}
                </button>
              </div>
              {showCode ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-label-sm uppercase tracking-widest text-on-surface-variant w-16">Manual</span>
                    <code className="font-mono text-lg tracking-[0.3em] text-primary select-all">
                      {matter.manualPairingCode}
                    </code>
                  </div>
                  {matter.qrPairingCode && (
                    <div className="flex flex-col items-center gap-3 pt-2">
                      <div className="bg-white p-3 rounded-lg">
                        <QRCodeSVG
                          value={matter.qrPairingCode}
                          size={180}
                          level="M"
                          bgColor="#ffffff"
                          fgColor="#000000"
                        />
                      </div>
                      <code className="font-mono text-[10px] text-on-surface-variant/50 break-all select-all max-w-[220px] text-center">
                        {matter.qrPairingCode}
                      </code>
                    </div>
                  )}
                  <p className="text-xs text-on-surface-variant pt-1 text-center">
                    Scan with Apple Home, Google Home, or Alexa to pair.
                  </p>
                </div>
              ) : (
                <p className="text-xs text-on-surface-variant">
                  Tap "Show" to reveal the pairing code for your smart home app.
                </p>
              )}
            </div>
          )}

          {matter.commissioned && (
            <p className="text-sm text-on-surface-variant">
              Your HYDRA controller is paired and visible in your smart home app. Each zone appears as a water valve.
            </p>
          )}
        </div>
      )}

      {matter.enabled && !matter.running && (
        <p className="text-sm text-on-surface-variant">
          Matter server is starting up. This may take a moment...
        </p>
      )}
    </Card>
  );
}

function SoilSettingsCard({ zones }: { zones?: api.ZoneState[] | null }) {
  const [soilSettings, setSoilSettings] = useState<api.SoilSettings | null>(null);
  const [devices, setDevices] = useState<api.SoilDevice[]>([]);
  const [mqttStatus, setMqttStatus] = useState<api.MqttStatus | null>(null);
  const [saving, setSaving] = useState(false);
  const [threshold, setThreshold] = useState('60');
  const settingsRef = useRef(soilSettings);
  settingsRef.current = soilSettings;

  useEffect(() => {
    api.getSoilSettings().then((s) => { setSoilSettings(s); setThreshold(String(s.moistureSkipThreshold)); }).catch(() => {});
    api.getSoilDevices().then(setDevices).catch(() => {});
    api.getMqttStatus().then(setMqttStatus).catch(() => {});
  }, []);

  const toggleEnabled = useCallback(async () => {
    const current = settingsRef.current;
    if (!current) return;
    const newValue = !current.moistureSkipEnabled;
    setSoilSettings(prev => prev ? { ...prev, moistureSkipEnabled: newValue } : prev);
    try {
      const updated = await api.updateSoilSettings({ moistureSkipEnabled: newValue });
      setSoilSettings(updated);
    } catch {
      setSoilSettings(prev => prev ? { ...prev, moistureSkipEnabled: !newValue } : prev);
    }
  }, []);

  const saveThreshold = useCallback(async () => {
    const val = parseFloat(threshold);
    if (isNaN(val) || val < 1 || val > 100) return;
    setSaving(true);
    try {
      const updated = await api.updateSoilSettings({ moistureSkipThreshold: val });
      setSoilSettings(updated);
    } catch { /* */ }
    setSaving(false);
  }, [threshold]);

  const handleZoneMapping = useCallback(async (device: string, zone: number | null) => {
    try {
      await api.setSoilZoneMapping(device, zone);
      const updated = await api.getSoilDevices();
      setDevices(updated);
    } catch { /* */ }
  }, []);

  const isOn = soilSettings?.moistureSkipEnabled ?? false;

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Icon name="grass" className="text-primary" size={20} />
          <h2 className="font-headline text-headline-md text-on-surface">Soil Sensors</h2>
        </div>
        {mqttStatus && (
          <StatusChip
            label={mqttStatus.connected ? `${mqttStatus.devices} sensor${mqttStatus.devices !== 1 ? 's' : ''}` : 'Disconnected'}
            color={mqttStatus.connected ? 'cyan' : 'neutral'}
            pulse={mqttStatus.connected && mqttStatus.devices > 0}
          />
        )}
      </div>

      {/* MQTT Status */}
      {mqttStatus && !mqttStatus.connected && (
        <div className="rounded-lg bg-surface-container-low border border-outline-variant/15 p-3 mb-4">
          <p className="text-sm text-on-surface-variant">
            MQTT broker not connected. Set <code className="text-primary/80 bg-surface-container-high px-1.5 py-0.5 rounded text-xs font-mono">MQTT_BROKER</code> in your environment (e.g. <code className="text-primary/80 bg-surface-container-high px-1.5 py-0.5 rounded text-xs font-mono">mqtt://localhost:1883</code>).
          </p>
        </div>
      )}

      <div className="space-y-4">
        {/* Moisture Skip Toggle */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-on-surface">Moisture-Based Skip</p>
            <p className="text-xs text-on-surface-variant">
              Skip irrigation when soil moisture exceeds threshold
            </p>
          </div>
          <button
            onClick={toggleEnabled}
            disabled={!soilSettings}
            className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50"
            style={{ backgroundColor: isOn ? 'var(--color-primary, #00D1FF)' : 'var(--color-outline-variant, #444)' }}
          >
            <span
              className="pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform"
              style={{ transform: isOn ? 'translateX(1.25rem)' : 'translateX(0)' }}
            />
          </button>
        </div>

        {/* Threshold */}
        {isOn && (
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="text-label-sm uppercase tracking-widest text-on-surface-variant block mb-1">
                Skip Threshold
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={threshold}
                  onChange={(e) => setThreshold(e.target.value)}
                  onBlur={saveThreshold}
                  onKeyDown={(e) => e.key === 'Enter' && saveThreshold()}
                  className="w-20 rounded-lg border border-outline-variant/20 bg-surface-container-low px-3 py-1.5 text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
                />
                <span className="text-sm text-on-surface-variant">% moisture</span>
                {saving && <span className="text-xs text-primary animate-pulse">Saving...</span>}
              </div>
            </div>
          </div>
        )}

        <div className="border-t border-outline-variant/15" />

        {/* Device → Zone Mapping */}
        <div>
          <p className="text-sm font-medium text-on-surface mb-1">Device Mapping</p>
          <p className="text-xs text-on-surface-variant mb-3">
            Assign each sensor to a zone for per-zone skip, or leave as "General" for rain detection.
          </p>

          {devices.length === 0 ? (
            <div className="rounded-lg bg-surface-container-low border border-outline-variant/15 p-4 text-center">
              <Icon name="sensors_off" className="text-on-surface-variant/40 mx-auto mb-2" size={28} />
              <p className="text-sm text-on-surface-variant">
                No sensors discovered yet. Sensors appear here once they send their first reading.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {devices.map((d) => (
                <div key={d.device} className="flex items-center justify-between gap-3 rounded-lg bg-surface-container-low border border-outline-variant/10 px-3 py-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <Icon
                      name={d.discovered ? 'sensors_off' : 'sensors'}
                      className={d.discovered ? 'text-on-surface-variant/40 shrink-0' : 'text-on-surface-variant shrink-0'}
                      size={16}
                    />
                    <div className="min-w-0">
                      <p className="text-sm text-on-surface truncate">{d.device}</p>
                      <p className="text-[0.625rem] text-on-surface-variant">
                        {d.model && <span className="text-primary/60">{d.model}</span>}
                        {d.model && ' · '}
                        {d.discovered
                          ? <span className="text-secondary">Awaiting first reading</span>
                          : <>Last seen: {formatAge(d.lastSeen)}</>
                        }
                      </p>
                    </div>
                  </div>
                  <select
                    value={d.zone ?? ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      handleZoneMapping(d.device, val ? parseInt(val, 10) : null);
                    }}
                    className="rounded-lg border border-outline-variant/20 bg-surface-container px-2.5 py-1.5 text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30 cursor-pointer"
                  >
                    <option value="">General</option>
                    {zones?.map((z) => (
                      <option key={z.zone} value={z.zone}>
                        Zone {z.zone} — {z.name}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

function formatAge(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function UnitsCard({ settings, onUpdate }: { settings?: Record<string, string> | null; onUpdate: () => void }) {
  const lengthUnit = (settings?.length_unit as 'in' | 'cm') || 'in';
  const tempUnit = (settings?.temp_unit as 'F' | 'C') || 'F';

  const setLength = useCallback(async (unit: 'in' | 'cm') => {
    await api.updateSettings({ length_unit: unit });
    onUpdate();
  }, [onUpdate]);

  const setTemp = useCallback(async (unit: 'F' | 'C') => {
    await api.updateSettings({ temp_unit: unit });
    onUpdate();
  }, [onUpdate]);

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <Icon name="straighten" className="text-primary" size={20} />
        <h2 className="font-headline text-headline-md text-on-surface">Units</h2>
      </div>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-on-surface">Temperature</p>
            <p className="text-xs text-on-surface-variant">Weather, heat wave threshold, and sensor readings</p>
          </div>
          <div className="flex rounded-lg overflow-hidden border border-outline-variant/20">
            <button
              onClick={() => setTemp('F')}
              className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                tempUnit === 'F' ? 'bg-primary text-black' : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              °F
            </button>
            <button
              onClick={() => setTemp('C')}
              className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                tempUnit === 'C' ? 'bg-primary text-black' : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              °C
            </button>
          </div>
        </div>

        <div className="border-t border-outline-variant/15" />

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-on-surface">Length</p>
            <p className="text-xs text-on-surface-variant">Soil intake rates, root depths, and precipitation</p>
          </div>
          <div className="flex rounded-lg overflow-hidden border border-outline-variant/20">
            <button
              onClick={() => setLength('in')}
              className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                lengthUnit === 'in' ? 'bg-primary text-black' : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              Inches
            </button>
            <button
              onClick={() => setLength('cm')}
              className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                lengthUnit === 'cm' ? 'bg-primary text-black' : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              cm
            </button>
          </div>
        </div>
      </div>
    </Card>
  );
}

function ZoneNameEditor({ zone, name, onRename }: { zone: number; name: string; onRename: () => void }) {
  const [draft, setDraft] = useState(name);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setDraft(name); }, [name]);

  const save = useCallback(async () => {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === name) { setDraft(name); return; }
    setSaving(true);
    await api.updateZone(zone, { name: trimmed });
    onRename();
    setSaving(false);
  }, [draft, name, zone, onRename]);

  return (
    <div>
      <p className="text-label-sm uppercase tracking-widest text-on-surface-variant mb-1.5">Zone Name</p>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => e.key === 'Enter' && save()}
          maxLength={32}
          className="flex-1 rounded-lg border border-outline-variant/20 bg-surface-container-low px-3 py-1.5 text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
        />
        {saving && <span className="text-xs text-primary animate-pulse">Saving...</span>}
      </div>
    </div>
  );
}

function ZoneProfilesCard({ lengthUnit }: { lengthUnit: 'in' | 'cm' }) {
  const { data: profiles, refetch } = useApi(() => api.getZoneProfiles());
  const [expandedZone, setExpandedZone] = useState<number | null>(null);

  const handleUpdate = useCallback(async (zone: number, field: 'soilType' | 'plantType', value: string | null) => {
    await api.updateZoneProfile(zone, { [field]: value || null });
    refetch();
  }, [refetch]);

  const handleSmartToggle = useCallback(async (zone: number, enabled: boolean) => {
    await api.updateZoneProfile(zone, { smartEnabled: enabled });
    refetch();
  }, [refetch]);

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <Icon name="landscape" className="text-primary" size={20} />
        <h2 className="font-headline text-headline-md text-on-surface">Zone Profiles</h2>
      </div>
      <p className="text-xs text-on-surface-variant mb-4">
        Set soil and plant type per zone for smarter irrigation calculations.
      </p>

      {!profiles || profiles.length === 0 ? (
        <p className="text-sm text-on-surface-variant">No zones configured.</p>
      ) : (
        <div className="space-y-2">
          {profiles.map((p) => {
            const soil = getSoilProfile(p.soilType);
            const plant = getPlantProfile(p.plantType);
            const isExpanded = expandedZone === p.zone;

            return (
              <div key={p.zone} className="rounded-lg bg-surface-container-low border border-outline-variant/10 overflow-hidden">
                {/* Summary row */}
                <button
                  onClick={() => setExpandedZone(isExpanded ? null : p.zone)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface-container transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-label-sm font-mono text-on-surface-variant w-6 shrink-0">
                      {String(p.zone).padStart(2, '0')}
                    </span>
                    <span className="text-sm font-medium text-on-surface truncate">{p.name}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {soil && (
                      <span className="flex items-center gap-1.5">
                        <span className={`h-3 w-3 rounded-full ${soil.color}`} />
                        <span className="text-[0.625rem] text-on-surface-variant">{soil.label}</span>
                      </span>
                    )}
                    {plant && (
                      <span className="flex items-center gap-1.5">
                        <Icon name={plant.icon} size={14} className="text-on-surface-variant" />
                        <span className="text-[0.625rem] text-on-surface-variant">{plant.label}</span>
                      </span>
                    )}
                    {p.smartEnabled && soil && plant && (
                      <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[0.625rem] font-bold uppercase tracking-widest text-primary">
                        Smart
                      </span>
                    )}
                    {!soil && !plant && (
                      <span className="text-[0.625rem] text-secondary">Not configured</span>
                    )}
                    <Icon name={isExpanded ? 'expand_less' : 'expand_more'} size={18} className="text-on-surface-variant" />
                  </div>
                </button>

                {/* Expanded config */}
                {isExpanded && (
                  <div className="px-4 pb-4 space-y-4 border-t border-outline-variant/10 pt-3">
                    {/* Zone Name */}
                    <ZoneNameEditor zone={p.zone} name={p.name} onRename={refetch} />

                    {/* Soil Type */}
                    <div>
                      <p className="text-label-sm uppercase tracking-widest text-on-surface-variant mb-2">Soil Type</p>
                      <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
                        {SOIL_PROFILES.map((s) => (
                          <button
                            key={s.key}
                            onClick={() => handleUpdate(p.zone, 'soilType', p.soilType === s.key ? null : s.key)}
                            className="flex flex-col items-center gap-1.5 rounded-lg p-2 transition-all hover:bg-surface-container"
                          >
                            <div className={`h-10 w-10 rounded-full ${s.color} ${
                              p.soilType === s.key ? 'ring-2 ring-primary ring-offset-2 ring-offset-surface-container-low' : ''
                            }`} />
                            <span className="text-[0.5625rem] text-on-surface-variant text-center leading-tight">{s.label}</span>
                          </button>
                        ))}
                        {p.soilType && (
                          <button
                            onClick={() => handleUpdate(p.zone, 'soilType', null)}
                            className="flex flex-col items-center gap-1.5 rounded-lg p-2 transition-all hover:bg-surface-container"
                          >
                            <div className="h-10 w-10 rounded-full bg-surface-container-high flex items-center justify-center border border-outline-variant/20">
                              <Icon name="close" size={16} className="text-on-surface-variant/60" />
                            </div>
                            <span className="text-[0.5625rem] text-on-surface-variant text-center leading-tight">Clear</span>
                          </button>
                        )}
                      </div>
                      {soil && (
                        <p className="mt-2 text-xs text-on-surface-variant">
                          Intake rate: <span className="text-on-surface font-medium">{formatRate(soil.intakeRate, lengthUnit)}</span>
                        </p>
                      )}
                    </div>

                    {/* Plant Type */}
                    <div>
                      <p className="text-label-sm uppercase tracking-widest text-on-surface-variant mb-2">Plant Type</p>
                      <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
                        {PLANT_PROFILES.map((pl) => (
                          <button
                            key={pl.key}
                            onClick={() => handleUpdate(p.zone, 'plantType', p.plantType === pl.key ? null : pl.key)}
                            className="flex flex-col items-center gap-1.5 rounded-lg p-2 transition-all hover:bg-surface-container"
                          >
                            <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                              p.plantType === pl.key ? 'bg-primary/20' : 'bg-surface-container-high'
                            }`}>
                              <Icon name={pl.icon} size={20} className={p.plantType === pl.key ? 'text-primary' : 'text-on-surface-variant'} />
                            </div>
                            <span className="text-[0.5625rem] text-on-surface-variant text-center leading-tight">{pl.label}</span>
                          </button>
                        ))}
                        {p.plantType && (
                          <button
                            onClick={() => handleUpdate(p.zone, 'plantType', null)}
                            className="flex flex-col items-center gap-1.5 rounded-lg p-2 transition-all hover:bg-surface-container"
                          >
                            <div className="h-10 w-10 rounded-full bg-surface-container-high flex items-center justify-center border border-outline-variant/20">
                              <Icon name="close" size={16} className="text-on-surface-variant/60" />
                            </div>
                            <span className="text-[0.5625rem] text-on-surface-variant text-center leading-tight">Clear</span>
                          </button>
                        )}
                      </div>
                      {plant && (
                        <p className="mt-2 text-xs text-on-surface-variant">
                          Root depth: <span className="text-on-surface font-medium">{formatLength(plant.rootDepth, lengthUnit)}</span>
                          {' · '}Crop coeff: <span className="text-on-surface font-medium">{plant.kc}</span>
                        </p>
                      )}
                    </div>

                    {/* Smart Irrigation Toggle */}
                    <div className="border-t border-outline-variant/10 pt-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-on-surface">Smart Irrigation</p>
                          <p className="text-xs text-on-surface-variant">
                            {soil && plant
                              ? 'Auto-calculate runtime from soil + plant profile + daily evaporation'
                              : 'Set both soil and plant type to enable'}
                          </p>
                        </div>
                        <button
                          onClick={() => handleSmartToggle(p.zone, !p.smartEnabled)}
                          disabled={!soil || !plant}
                          className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-30 disabled:cursor-not-allowed"
                          style={{ backgroundColor: (p.smartEnabled && soil && plant) ? 'var(--color-primary, #00D1FF)' : 'var(--color-outline-variant, #444)' }}
                        >
                          <span
                            className="pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform"
                            style={{ transform: (p.smartEnabled && soil && plant) ? 'translateX(1.25rem)' : 'translateX(0)' }}
                          />
                        </button>
                      </div>
                      {p.smartEnabled && soil && plant && (
                        <SmartPreview zone={p.zone} lengthUnit={lengthUnit} soilType={p.soilType} plantType={p.plantType} />
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function fToC(f: number): number { return (f - 32) * 5 / 9; }
function cToF(c: number): number { return c * 9 / 5 + 32; }

function HeatWaveCard({ settings, onUpdate }: { settings?: Record<string, string> | null; onUpdate: () => void }) {
  const enabled = settings?.heat_wave_boost_enabled !== 'false';
  const tempUnit = (settings?.temp_unit as 'F' | 'C') || 'F';
  const storedF = parseFloat(settings?.heat_wave_threshold_f ?? '95');
  const displayVal = tempUnit === 'C' ? Math.round(fToC(storedF)) : storedF;
  const [threshold, setThreshold] = useState(String(displayVal));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const f = parseFloat(settings?.heat_wave_threshold_f ?? '95');
    setThreshold(String(tempUnit === 'C' ? Math.round(fToC(f)) : f));
  }, [settings?.heat_wave_threshold_f, tempUnit]);

  const toggleEnabled = useCallback(async () => {
    await api.updateSettings({ heat_wave_boost_enabled: enabled ? 'false' : 'true' });
    onUpdate();
  }, [enabled, onUpdate]);

  const saveThreshold = useCallback(async () => {
    const val = parseFloat(threshold);
    if (isNaN(val)) return;
    const valF = tempUnit === 'C' ? Math.round(cToF(val)) : val;
    if (valF < 70 || valF > 130) return;
    setSaving(true);
    await api.updateSettings({ heat_wave_threshold_f: String(valF) });
    onUpdate();
    setSaving(false);
  }, [threshold, tempUnit, onUpdate]);

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <Icon name="local_fire_department" className="text-critical" size={20} />
        <h2 className="font-headline text-headline-md text-on-surface">Heat Wave Protection</h2>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-on-surface">Auto-Boost Watering</p>
            <p className="text-xs text-on-surface-variant">
              Increase smart irrigation duration during heat waves
            </p>
          </div>
          <button
            onClick={toggleEnabled}
            className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40"
            style={{ backgroundColor: enabled ? 'var(--color-primary, #00D1FF)' : 'var(--color-outline-variant, #444)' }}
          >
            <span
              className="pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform"
              style={{ transform: enabled ? 'translateX(1.25rem)' : 'translateX(0)' }}
            />
          </button>
        </div>

        {enabled && (
          <>
            <div className="border-t border-outline-variant/15" />
            <div className="flex items-center gap-3">
              <div>
                <label className="text-label-sm uppercase tracking-widest text-on-surface-variant block mb-1">
                  Temperature Threshold
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="70"
                    max="130"
                    value={threshold}
                    onChange={(e) => setThreshold(e.target.value)}
                    onBlur={saveThreshold}
                    onKeyDown={(e) => e.key === 'Enter' && saveThreshold()}
                    className="w-20 rounded-lg border border-outline-variant/20 bg-surface-container-low px-3 py-1.5 text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
                  />
                  <span className="text-sm text-on-surface-variant">°{tempUnit}</span>
                  {saving && <span className="text-xs text-primary animate-pulse">Saving...</span>}
                </div>
              </div>
            </div>
            <div className="rounded-lg bg-surface-container-low border border-outline-variant/10 p-3">
              <p className="text-xs text-on-surface-variant leading-relaxed">
                <span className="text-secondary font-medium">Warning</span> — 2+ days above {threshold}°{tempUnit} → +25% water.
                <br />
                <span className="text-critical font-medium">Extreme</span> — 3+ days or peak above {parseInt(threshold) + 10}°{tempUnit} → +50% water.
              </p>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}

function SmartPreview({ zone, lengthUnit, soilType, plantType }: { zone: number; lengthUnit: 'in' | 'cm'; soilType: string | null; plantType: string | null }) {
  const { data } = useApi(() => api.getSmartDuration(zone), [soilType, plantType]);
  if (!data) return null;

  return (
    <div className="mt-2 rounded-lg bg-surface-container-high/50 p-3 space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-on-surface-variant">Calculated runtime</span>
        <span className="text-primary font-medium font-mono">{data.minutes} min</span>
      </div>
      <div className="flex justify-between text-xs">
        <span className="text-on-surface-variant">Water needed</span>
        <span className="text-on-surface font-mono">{formatLength(data.waterNeededIn, lengthUnit)}</span>
      </div>
      <div className="flex justify-between text-xs">
        <span className="text-on-surface-variant">Method</span>
        <span className="text-on-surface">{data.et0In != null ? `Weather-based (${(data.et0In * 25.4).toFixed(1)} mm/day evaporation)` : 'Soil budget (no weather data)'}</span>
      </div>
      {data.heatWaveBoost > 1 && (
        <div className="flex justify-between text-xs">
          <span className="text-critical">Heat wave boost</span>
          <span className="text-critical font-medium">+{Math.round((data.heatWaveBoost - 1) * 100)}%</span>
        </div>
      )}
    </div>
  );
}

function IrrigationReferenceCard({ lengthUnit }: { lengthUnit: 'in' | 'cm' }) {
  const [open, setOpen] = useState(false);

  return (
    <Card className="p-6">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon name="menu_book" className="text-primary" size={20} />
          <h2 className="font-headline text-headline-md text-on-surface">Irrigation Reference</h2>
        </div>
        <Icon name={open ? 'expand_less' : 'expand_more'} size={20} className="text-on-surface-variant" />
      </button>

      {open && (
        <div className="mt-4 space-y-5">
          {/* Soil types table */}
          <div>
            <p className="text-label-sm uppercase tracking-widest text-on-surface-variant mb-2">Soil Types</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-outline-variant/15">
                    <th className="text-left py-1.5 text-on-surface-variant font-normal">Type</th>
                    <th className="text-right py-1.5 text-on-surface-variant font-normal">Intake Rate</th>
                    <th className="text-right py-1.5 text-on-surface-variant font-normal">AWC</th>
                  </tr>
                </thead>
                <tbody>
                  {SOIL_PROFILES.map(s => (
                    <tr key={s.key} className="border-b border-outline-variant/5">
                      <td className="py-1.5 text-on-surface flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 rounded-full ${s.color} shrink-0`} />
                        {s.label}
                      </td>
                      <td className="py-1.5 text-on-surface text-right font-mono">{formatRate(s.intakeRate, lengthUnit)}</td>
                      <td className="py-1.5 text-on-surface text-right font-mono">{formatLength(s.awc, lengthUnit)}/ft</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Plant types table */}
          <div>
            <p className="text-label-sm uppercase tracking-widest text-on-surface-variant mb-2">Plant Types</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-outline-variant/15">
                    <th className="text-left py-1.5 text-on-surface-variant font-normal">Type</th>
                    <th className="text-right py-1.5 text-on-surface-variant font-normal">Root Depth</th>
                    <th className="text-right py-1.5 text-on-surface-variant font-normal">Kc</th>
                    <th className="text-right py-1.5 text-on-surface-variant font-normal">MAD</th>
                  </tr>
                </thead>
                <tbody>
                  {PLANT_PROFILES.map(p => (
                    <tr key={p.key} className="border-b border-outline-variant/5">
                      <td className="py-1.5 text-on-surface flex items-center gap-2">
                        <Icon name={p.icon} size={14} className="text-on-surface-variant shrink-0" />
                        {p.label}
                      </td>
                      <td className="py-1.5 text-on-surface text-right font-mono">{formatLength(p.rootDepth, lengthUnit)}</td>
                      <td className="py-1.5 text-on-surface text-right font-mono">{p.kc}</td>
                      <td className="py-1.5 text-on-surface text-right font-mono">{Math.round(p.mad * 100)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-[0.625rem] text-on-surface-variant/60 leading-relaxed">
            Sources: USDA NRCS Soil Survey, FAO-56 (Allen et al.), EPA WaterSense.
            Kc = crop coefficient (× daily evaporation). MAD = management allowed depletion.
            AWC = available water capacity per foot of soil.
          </p>
        </div>
      )}
    </Card>
  );
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-label-sm uppercase tracking-widest text-on-surface-variant block">{label}</span>
      <span className="font-headline text-headline-sm text-on-surface">{value}</span>
    </div>
  );
}

/** Matter protocol logo — simplified M-in-circle mark */
function MatterLogo({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-label="Matter">
      <circle cx="12" cy="12" r="11" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M6.5 16V10.5L9.5 14.5L12 10.5L14.5 14.5L17.5 10.5V16"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="6.5" cy="8.5" r="1" fill="currentColor" />
      <circle cx="12" cy="8.5" r="1" fill="currentColor" />
      <circle cx="17.5" cy="8.5" r="1" fill="currentColor" />
    </svg>
  );
}
