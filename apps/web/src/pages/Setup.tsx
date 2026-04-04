import { useState, useEffect } from 'react';
import * as api from '@/lib/api';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';

export function Setup() {
  const [step, setStep] = useState(1);
  const [zoneCount, setZoneCount] = useState(7);
  const [hasRainSensor, setHasRainSensor] = useState(true);
  const [perZoneFlow, setPerZoneFlow] = useState(false);
  const [budget, setBudget] = useState<api.GpioBudget | null>(null);
  const [result, setResult] = useState<api.SetupResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Preview budget on parameter change
  useEffect(() => {
    if (step < 2) return;
    api.getGpioBudget({ zoneCount, hasRainSensor, perZoneFlow })
      .then(setBudget)
      .catch(() => setBudget(null));
  }, [step, zoneCount, hasRainSensor, perZoneFlow]);

  const maxZones = perZoneFlow ? 5 : 11;

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.executeSetup({ zoneCount, hasRainSensor, perZoneFlow });
      setResult(res);
      setStep(3);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Setup failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-surface">
      <div className="w-full max-w-2xl space-y-6 animate-fade-in">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <Icon name="water_drop" className="text-primary" size={36} />
          </div>
          <h1 className="font-headline text-display-sm text-on-surface">HYDRA Setup</h1>
          <p className="mt-2 text-sm text-on-surface-variant">
            Configure your irrigation controller
          </p>
        </div>

        {/* Progress */}
        <div className="flex items-center justify-center gap-2">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-1.5 rounded-full transition-all ${
                s <= step ? 'w-12 bg-primary' : 'w-8 bg-surface-container-high'
              }`}
            />
          ))}
        </div>

        {/* Step 1: Zone Count */}
        {step === 1 && (
          <Card className="p-8 space-y-6">
            <h2 className="font-headline text-headline-lg text-on-surface">How many zones?</h2>

            <div className="space-y-4">
              <div>
                <label className="text-label-sm uppercase tracking-widest text-on-surface-variant block mb-2">
                  Zone Count
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min={1}
                    max={maxZones}
                    value={zoneCount}
                    onChange={(e) => setZoneCount(Number(e.target.value))}
                    className="flex-1 accent-primary"
                  />
                  <span className="font-headline text-display-sm text-primary-light w-16 text-center">
                    {zoneCount}
                  </span>
                </div>
              </div>

              <ToggleOption
                label="Rain Sensor"
                description="Connect a hardware rain sensor to skip watering"
                icon="water_drop"
                checked={hasRainSensor}
                onChange={setHasRainSensor}
              />

              <ToggleOption
                label="Per-Zone Flow Sensors"
                description={`Individual flow sensors per zone (max ${perZoneFlow ? 5 : 11} zones)`}
                icon="sensors"
                checked={perZoneFlow}
                onChange={(v) => {
                  setPerZoneFlow(v);
                  if (v && zoneCount > 9) setZoneCount(9);
                }}
              />
            </div>

            <button
              onClick={() => setStep(2)}
              className="w-full rounded-xl bg-primary py-3 text-sm font-medium text-on-primary hover:shadow-glow transition-all"
            >
              Preview GPIO Budget
            </button>
          </Card>
        )}

        {/* Step 2: GPIO Preview & Confirm */}
        {step === 2 && (
          <Card className="p-8 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="font-headline text-headline-lg text-on-surface">GPIO Budget</h2>
              <button
                onClick={() => setStep(1)}
                className="text-sm text-on-surface-variant hover:text-on-surface transition-colors"
              >
                Back
              </button>
            </div>

            {budget && (
              <>
                {/* Budget Bar */}
                <div>
                  <div className="flex justify-between text-label-sm text-on-surface-variant mb-2">
                    <span>{budget.totalRequired} pins used</span>
                    <span>{budget.remaining} remaining</span>
                  </div>
                  <div className="h-3 rounded-full bg-surface-container-high overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${budget.valid ? 'bg-primary' : 'bg-critical'}`}
                      style={{ width: `${(budget.totalRequired / budget.totalAvailable) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Assignment Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-label-sm uppercase text-on-surface-variant tracking-widest">
                        <th className="text-left py-2 pr-4">Role</th>
                        <th className="text-left py-2 pr-4">Pin</th>
                        <th className="text-left py-2">Label</th>
                      </tr>
                    </thead>
                    <tbody>
                      {budget.assignments.map((a, i) => (
                        <tr key={i} className="border-t border-outline-variant">
                          <td className="py-2 pr-4 text-primary-light font-mono text-xs">{a.role}</td>
                          <td className="py-2 pr-4 font-headline text-on-surface">GPIO {a.pin}</td>
                          <td className="py-2 text-on-surface-variant">{a.label}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {!budget.valid && (
                  <div className="rounded-xl bg-critical-container/30 p-4 power-bar-critical">
                    <p className="text-sm text-critical">
                      Not enough GPIO pins. Reduce zone count or disable per-zone flow sensors.
                    </p>
                  </div>
                )}

                {error && (
                  <div className="rounded-xl bg-critical-container/30 p-4 power-bar-critical">
                    <p className="text-sm text-critical">{error}</p>
                  </div>
                )}

                <button
                  onClick={handleSubmit}
                  disabled={!budget.valid || submitting}
                  className="w-full rounded-xl bg-primary py-3 text-sm font-medium text-on-primary hover:shadow-glow transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Configuring...' : `Configure ${zoneCount} Zones`}
                </button>
              </>
            )}
          </Card>
        )}

        {/* Step 3: Success */}
        {step === 3 && result && (
          <Card className="p-8 text-center space-y-6">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <Icon name="check_circle" className="text-primary" size={40} />
            </div>
            <div>
              <h2 className="font-headline text-headline-lg text-on-surface">Setup Complete</h2>
              <p className="mt-2 text-sm text-on-surface-variant">
                {result.config.zoneCount} zones configured with {result.assignments.length} GPIO assignments.
              </p>
            </div>
            <div className="rounded-xl bg-secondary-container/20 p-4 power-bar-amber">
              <p className="text-sm text-secondary">{result.message}</p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

function ToggleOption({
  label,
  description,
  icon,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  icon: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`w-full flex items-center gap-4 rounded-xl p-4 text-left transition-colors ${
        checked ? 'bg-primary/5 border-etched' : 'bg-surface-container-high'
      }`}
    >
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
        checked ? 'bg-primary/20 text-primary' : 'bg-surface-bright text-on-surface-variant'
      }`}>
        <Icon name={icon} size={20} />
      </div>
      <div className="flex-1">
        <span className="font-headline text-sm text-on-surface block">{label}</span>
        <span className="text-label-sm text-on-surface-variant">{description}</span>
      </div>
      <div className={`h-5 w-9 rounded-full transition-colors ${checked ? 'bg-primary' : 'bg-surface-bright'}`}>
        <div className={`h-4 w-4 rounded-full bg-on-surface mt-0.5 transition-transform ${checked ? 'translate-x-4.5 ml-[18px]' : 'ml-0.5'}`} />
      </div>
    </button>
  );
}
