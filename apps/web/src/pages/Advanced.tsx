import { useState, useCallback } from 'react';
import * as api from '@/lib/api';
import { useApi } from '@/hooks/useApi';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { ConfirmDialog } from '@/components/ConfirmDialog';

type ConfirmAction = 'shutdown' | 'reset' | null;

export function Advanced() {
  const { data: settings, refetch } = useApi(() => api.getSettings());
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');

  if (!unlocked) {
    return (
      <PinGate
        pin={pin}
        setPin={setPin}
        error={pinError}
        onSubmit={() => {
          const correctPin = settings?.admin_pin ?? '1234';
          if (pin === correctPin) {
            setUnlocked(true);
            setPinError('');
          } else {
            setPinError('Incorrect PIN');
          }
        }}
      />
    );
  }

  return <AdvancedContent settings={settings} refetch={refetch} />;
}

function PinGate({
  pin,
  setPin,
  error,
  onSubmit,
}: {
  pin: string;
  setPin: (v: string) => void;
  error: string;
  onSubmit: () => void;
}) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center animate-fade-in">
      <Card className="p-8 w-full max-w-sm text-center">
        <div className="mb-6">
          <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Icon name="lock" className="text-primary" size={24} />
          </div>
          <h1 className="font-headline text-headline-md text-on-surface mb-1">Advanced Access</h1>
          <p className="text-sm text-on-surface-variant">Enter PIN to continue</p>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
          className="space-y-4"
        >
          <input
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={pin}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, '');
              setPin(v);
            }}
            placeholder="PIN"
            autoFocus
            className="w-full rounded-lg bg-surface-container-lowest px-3 py-3 text-center text-lg tracking-[0.5em] text-on-surface border-etched focus:outline-none focus:ring-1 focus:ring-primary/40 font-mono"
          />
          {error && <p className="text-sm text-critical">{error}</p>}
          <button
            type="submit"
            disabled={pin.length < 4}
            className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-medium text-on-primary hover:shadow-glow transition-all disabled:opacity-40"
          >
            Unlock
          </button>
        </form>
      </Card>
    </div>
  );
}

function AdvancedContent({
  settings,
  refetch,
}: {
  settings: Record<string, string> | null;
  refetch: () => void;
}) {
  const { data: configData } = useApi(() => api.getSystemConfig());
  const [saving, setSaving] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});

  const handleChange = (key: string, value: string) => {
    setEditValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = useCallback(async () => {
    if (Object.keys(editValues).length === 0) return;
    setSaving(true);
    await api.updateSettings(editValues);
    setEditValues({});
    refetch();
    setSaving(false);
  }, [editValues, refetch]);

  const handleConfirm = async () => {
    try {
      if (confirmAction === 'shutdown') {
        await api.forceShutdown();
      } else if (confirmAction === 'reset') {
        await api.resetSetup();
        window.location.href = '/';
        return;
      }
    } catch (e) {
      console.error('Action failed:', e);
    }
    setConfirmAction(null);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="font-headline text-display-sm text-on-surface">Advanced</h1>

      {/* GPIO Assignments */}
      {configData?.assignments && configData.assignments.length > 0 && (
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Icon name="developer_board" className="text-primary" size={20} />
            <h2 className="font-headline text-headline-md text-on-surface">GPIO Assignments</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-label-sm uppercase text-on-surface-variant tracking-widest">
                  <th className="text-left py-2 pr-4">Role</th>
                  <th className="text-left py-2 pr-4">Pin (BCM)</th>
                  <th className="text-left py-2 pr-4">Zone</th>
                  <th className="text-left py-2">Label</th>
                </tr>
              </thead>
              <tbody>
                {configData.assignments.map((a) => (
                  <tr key={a.id} className="border-t border-outline-variant">
                    <td className="py-2 pr-4 text-primary-light font-mono">{a.role}</td>
                    <td className="py-2 pr-4 font-headline text-on-surface">GPIO {a.pin}</td>
                    <td className="py-2 pr-4 text-on-surface-variant">{a.zone ?? '—'}</td>
                    <td className="py-2 text-on-surface-variant">{a.label}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Flow Safety Thresholds */}
      <FlowThresholds />

      {/* Controller Settings */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Icon name="tune" className="text-primary" size={20} />
            <h2 className="font-headline text-headline-md text-on-surface">Controller Settings</h2>
          </div>
          {Object.keys(editValues).length > 0 && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:shadow-glow transition-all disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          )}
        </div>

        <div className="space-y-4">
          {settings &&
            Object.entries(settings).map(([key, value]) => (
              <div key={key}>
                <label className="text-label-sm uppercase tracking-widest text-on-surface-variant block mb-1.5">
                  {key.replace(/_/g, ' ')}
                </label>
                <input
                  type="text"
                  value={editValues[key] ?? value}
                  onChange={(e) => handleChange(key, e.target.value)}
                  className="w-full rounded-lg bg-surface-container-lowest px-3 py-2.5 text-sm text-on-surface border-etched focus:outline-none focus:ring-1 focus:ring-primary/40 font-mono"
                />
              </div>
            ))}
        </div>
      </Card>

      {/* Danger Zone */}
      <Card accent="critical" className="p-6">
        <div className="flex items-center gap-2 mb-3">
          <Icon name="warning" className="text-critical" size={20} />
          <h2 className="font-headline text-headline-md text-critical">Danger Zone</h2>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-on-surface font-medium">Force Shutdown</p>
              <p className="text-xs text-on-surface-variant">Closes all valves and master valve immediately.</p>
            </div>
            <button
              onClick={() => setConfirmAction('shutdown')}
              className="rounded-xl bg-critical/10 px-4 py-2.5 text-sm font-medium text-critical hover:bg-critical/20 transition-colors"
            >
              Force Shutdown
            </button>
          </div>
          <div className="border-t border-outline-variant/15" />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-on-surface font-medium">Reset Configuration</p>
              <p className="text-xs text-on-surface-variant">Clears zones, GPIO assignments, and schedules. Re-runs the setup wizard.</p>
            </div>
            <button
              onClick={() => setConfirmAction('reset')}
              className="rounded-xl bg-critical/10 px-4 py-2.5 text-sm font-medium text-critical hover:bg-critical/20 transition-colors"
            >
              Reset Setup
            </button>
          </div>
        </div>
      </Card>

      {/* Confirmation Dialogs */}
      <ConfirmDialog
        open={confirmAction === 'shutdown'}
        title="Force Shutdown"
        message="This will immediately close all zone valves and the master valve. Any running schedules will be terminated."
        confirmLabel="Shutdown Now"
        variant="danger"
        onConfirm={handleConfirm}
        onCancel={() => setConfirmAction(null)}
      />
      <ConfirmDialog
        open={confirmAction === 'reset'}
        title="Reset Configuration"
        message="This will permanently delete all zones, GPIO assignments, and schedules. The setup wizard will run on next page load. This cannot be undone."
        confirmLabel="Reset Everything"
        variant="danger"
        onConfirm={handleConfirm}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}

function FlowThresholds() {
  const { data: flowSettings, refetch } = useApi(() => api.getFlowSettings());
  const [edits, setEdits] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);

  const hasEdits = Object.keys(edits).length > 0;

  const handleChange = (key: string, value: string) => {
    const numVal = parseFloat(value);
    if (!isNaN(numVal)) {
      setEdits(prev => ({ ...prev, [key]: numVal }));
    }
  };

  const handleSave = async () => {
    setSaving(true);
    await api.updateFlowSettings(edits);
    setEdits({});
    refetch();
    setSaving(false);
  };

  if (!flowSettings) return null;

  type NumericKey = 'flowLeakDetectDelaySeconds' | 'flowNoFlowTimeoutSeconds' | 'flowMaxGpm' | 'flowExpectedGpm' | 'flowReadingIntervalSeconds';
  const fields: { key: NumericKey; label: string; unit: string }[] = [
    { key: 'flowLeakDetectDelaySeconds', label: 'Leak Detection Delay', unit: 'seconds' },
    { key: 'flowNoFlowTimeoutSeconds', label: 'No-Flow Timeout', unit: 'seconds' },
    { key: 'flowMaxGpm', label: 'Max Flow Rate', unit: 'GPM' },
    { key: 'flowExpectedGpm', label: 'Expected Flow Rate', unit: 'GPM' },
    { key: 'flowReadingIntervalSeconds', label: 'Sampling Interval', unit: 'seconds' },
  ];

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Icon name="sensors" className="text-primary" size={20} />
          <h2 className="font-headline text-headline-md text-on-surface">Flow Safety Thresholds</h2>
        </div>
        {hasEdits && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:shadow-glow transition-all disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        )}
      </div>

      {!flowSettings.flowSafetyEnabled && (
        <p className="text-sm text-on-surface-variant mb-4">
          Flow safety is currently disabled. Enable it in Settings to activate these thresholds.
        </p>
      )}

      <div className="space-y-4">
        {fields.map(({ key, label, unit }) => (
          <div key={key}>
            <label className="text-label-sm uppercase tracking-widest text-on-surface-variant block mb-1.5">
              {label}
              <span className="ml-1 normal-case tracking-normal opacity-60">({unit})</span>
            </label>
            <input
              type="number"
              step={key.includes('Gpm') ? '0.1' : '1'}
              min="0"
              value={edits[key] ?? flowSettings[key]}
              onChange={(e) => handleChange(key, e.target.value)}
              className="w-full rounded-lg bg-surface-container-lowest px-3 py-2.5 text-sm text-on-surface border-etched focus:outline-none focus:ring-1 focus:ring-primary/40 font-mono"
            />
          </div>
        ))}
      </div>
    </Card>
  );
}
