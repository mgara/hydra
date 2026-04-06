import { useState, useCallback, useRef, useEffect } from 'react';
import * as api from '@/lib/api';
import { useApi } from '@/hooks/useApi';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { formatDate } from '@/lib/locale';
import { StatusChip } from '@/components/StatusChip';

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export function Schedules() {
  const { data: schedules, refetch } = useApi(() => api.getSchedules());
  const { data: zones } = useApi(() => api.getZones());
  const { data: profiles } = useApi(() => api.getZoneProfiles());
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<api.Schedule | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  // Scroll to form when editing starts
  useEffect(() => {
    if ((showForm || editing) && formRef.current) {
      formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [showForm, editing]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-headline text-display-sm text-on-surface">Schedules</h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            {schedules?.length ?? 0} schedule{schedules?.length !== 1 ? 's' : ''} configured
          </p>
        </div>
        <button
          onClick={() => { setEditing(null); setShowForm(!showForm); }}
          className="flex items-center gap-2 rounded-xl bg-primary/10 px-4 py-2.5 text-sm text-primary hover:bg-primary/20 transition-colors"
        >
          <Icon name="add" size={18} />
          New Schedule
        </button>
      </div>

      {(showForm || editing) && (
        <div ref={formRef} key={editing?.id ?? 'new'}>
        <ScheduleForm
          zones={zones ?? []}
          initial={editing}
          onSave={async (input) => {
            if (editing) {
              await api.updateSchedule(editing.id, input);
            } else {
              await api.createSchedule(input);
            }
            setShowForm(false);
            setEditing(null);
            refetch();
          }}
          onCancel={() => { setShowForm(false); setEditing(null); }}
        />
        </div>
      )}

      {/* Schedule list */}
      <div className="space-y-3">
        {schedules?.map((s) => (
          <ScheduleRow
            key={s.id}
            schedule={s}
            profile={profiles?.find(p => p.zone === s.zone)}
            refetch={refetch}
            onEdit={() => { setShowForm(false); setEditing(s); }}
          />
        ))}
        {schedules?.length === 0 && (
          <Card className="p-8 text-center">
            <Icon name="calendar_month" className="text-on-surface-variant mx-auto mb-2" size={32} />
            <p className="text-on-surface-variant">No schedules configured</p>
          </Card>
        )}
      </div>
    </div>
  );
}

function ScheduleRow({ schedule, profile, refetch, onEdit }: { schedule: api.Schedule; profile?: api.ZoneProfile | null; refetch: () => void; onEdit: () => void }) {
  const hasSmart = profile?.smartEnabled && !!profile.soilType && !!profile.plantType;
  const { data: smartData } = useApi(() => hasSmart ? api.getSmartDuration(schedule.zone) : Promise.resolve(null), [hasSmart, schedule.zone]);
  const activeDays = schedule.days.split(',');

  const handleToggle = useCallback(async () => {
    await api.updateSchedule(schedule.id, { enabled: !schedule.enabled });
    refetch();
  }, [schedule, refetch]);

  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleDelete = useCallback(async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      // Auto-dismiss after 3 seconds
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    await api.deleteSchedule(schedule.id);
    refetch();
  }, [schedule.id, refetch, confirmDelete]);

  return (
    <Card accent={schedule.expiresAt ? 'amber' : schedule.enabled ? 'cyan' : 'none'} className={`p-4 ${!schedule.enabled ? 'opacity-50' : ''}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-label-sm uppercase text-on-surface-variant">Zone {schedule.zone}</span>
            {hasSmart && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5">
                <Icon name="auto_awesome" size={12} className="text-primary" />
                <span className="text-label-sm uppercase text-primary font-medium">Smart</span>
              </span>
            )}
            {schedule.rainSkip && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5">
                <Icon name="cloud" size={12} className="text-primary" />
                <span className="text-label-sm uppercase text-primary font-medium">Rain Skip</span>
              </span>
            )}
            {schedule.priority && (
              <span className="inline-flex items-center gap-1 rounded-full bg-secondary/10 px-2.5 py-0.5">
                <Icon name="priority_high" size={12} className="text-secondary" />
                <span className="text-label-sm uppercase text-secondary font-medium">Priority</span>
              </span>
            )}
          </div>
          <h3 className="font-headline text-headline-sm text-on-surface">{schedule.name}</h3>
          <div className="mt-2 flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <Icon name={schedule.startMode === 'fixed' ? 'schedule' : schedule.startMode === 'sunrise' ? 'wb_twilight' : 'nights_stay'} className="text-on-surface-variant" size={16} />
              <span className="text-sm text-primary-light">
                {schedule.startMode === 'fixed'
                  ? schedule.startTime
                  : `${Math.abs(schedule.startOffset)} min ${schedule.startOffset <= 0 ? 'before' : 'after'} ${schedule.startMode}`}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Icon name="timer" className="text-on-surface-variant" size={16} />
              {hasSmart && smartData ? (
                <span className="text-sm text-primary">{smartData.minutes} min <span className="text-[0.625rem] text-on-surface-variant">(smart)</span></span>
              ) : (
                <span className="text-sm text-on-surface-variant">{schedule.durationMinutes} min</span>
              )}
            </div>
          </div>

          {schedule.expiresAt && (
            <div className="mt-2 flex items-center gap-1.5">
              <Icon name="event" className="text-secondary" size={14} />
              <span className="text-xs text-secondary font-medium">
                Expires {formatDate(schedule.expiresAt)}
              </span>
            </div>
          )}

          {/* Day pills */}
          <div className="mt-3 flex gap-1">
            {DAYS.map((day, i) => (
              <span
                key={day}
                className={`flex h-7 w-7 items-center justify-center rounded-full text-label-sm ${
                  activeDays.includes(day)
                    ? 'bg-primary/20 text-primary'
                    : 'bg-surface-container-high text-on-surface-variant/40'
                }`}
              >
                {DAY_LABELS[i]}
              </span>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <button
            onClick={handleToggle}
            className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
              schedule.enabled
                ? 'bg-primary/10 text-primary hover:bg-primary/20'
                : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-bright'
            }`}
          >
            <Icon name={schedule.enabled ? 'toggle_on' : 'toggle_off'} size={20} />
          </button>
          <button
            onClick={onEdit}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-on-surface-variant hover:bg-primary/10 hover:text-primary transition-colors"
          >
            <Icon name="edit" size={18} />
          </button>
          <button
            onClick={handleDelete}
            className={`flex items-center justify-center rounded-lg transition-colors ${
              confirmDelete
                ? 'h-9 px-2 bg-critical/15 text-critical gap-1'
                : 'h-9 w-9 text-on-surface-variant hover:bg-critical/10 hover:text-critical'
            }`}
          >
            <Icon name="delete" size={18} />
            {confirmDelete && <span className="text-xs font-medium">Sure?</span>}
          </button>
        </div>
      </div>
    </Card>
  );
}

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      disabled={disabled}
      className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-40 disabled:cursor-not-allowed"
      style={{ backgroundColor: checked ? 'var(--color-primary, #00D1FF)' : 'var(--color-outline-variant, #444)' }}
    >
      <span
        className="pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform"
        style={{ transform: checked ? 'translateX(1.25rem)' : 'translateX(0)' }}
      />
    </button>
  );
}

function ScheduleForm({
  zones,
  initial,
  onSave,
  onCancel,
}: {
  zones: api.ZoneState[];
  initial: api.Schedule | null;
  onSave: (input: api.ScheduleInput) => void;
  onCancel: () => void;
}) {
  const isEdit = !!initial;
  const [zone, setZone] = useState(initial?.zone ?? zones[0]?.zone ?? 1);
  const { data: profiles } = useApi(() => api.getZoneProfiles());
  const [name, setName] = useState(initial?.name ?? '');
  const [startMode, setStartMode] = useState<api.StartMode>(initial?.startMode ?? 'fixed');
  const [startTime, setStartTime] = useState(initial?.startTime ?? '06:00');
  const [startOffset, setStartOffset] = useState(initial?.startOffset ?? 0);
  const [duration, setDuration] = useState(initial?.durationMinutes ?? 15);
  const [selectedDays, setSelectedDays] = useState<string[]>(
    initial?.days.split(',') ?? ['mon', 'wed', 'fri']
  );
  const [rainSkip, setRainSkip] = useState(initial?.rainSkip ?? true);
  const [priority, setPriority] = useState(initial?.priority ?? false);
  const [expiryMode, setExpiryMode] = useState<'never' | 'weeks' | 'date'>(
    initial?.expiresAt ? 'date' : 'never'
  );
  const [expiryWeeks, setExpiryWeeks] = useState(4);
  const [expiryDate, setExpiryDate] = useState(
    initial?.expiresAt ? initial.expiresAt.slice(0, 10) : ''
  );

  // For smart schedules, fetch the real-time calculated duration
  const profile = profiles?.find(pr => pr.zone === zone);
  const isSmart = !!(profile?.smartEnabled && profile.soilType && profile.plantType);
  const { data: smartData } = useApi(
    () => isSmart ? api.getSmartDuration(zone) : Promise.resolve(null),
    [zone, isSmart],
  );

  const toggleDay = (day: string) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const handleSubmit = () => {
    if (selectedDays.length === 0) return;
    onSave({
      zone,
      name: name || `Zone ${zone} Schedule`,
      startTime: startMode === 'fixed' ? startTime : '00:00',
      startMode,
      startOffset: startMode === 'fixed' ? 0 : startOffset,
      durationMinutes: duration,
      days: selectedDays.join(','),
      enabled: initial?.enabled ?? true,
      rainSkip,
      priority,
      ...(expiryMode === 'weeks' ? { expiresInWeeks: expiryWeeks } : {}),
      ...(expiryMode === 'date' ? { expiresAt: new Date(expiryDate).toISOString() } : {}),
      ...(expiryMode === 'never' ? { expiresAt: null } : {}),
    });
  };

  return (
    <Card className="p-6 space-y-4">
      <h3 className="font-headline text-headline-md text-on-surface">
        {isEdit ? 'Edit Schedule' : 'New Schedule'}
      </h3>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-label-sm uppercase tracking-widest text-on-surface-variant block mb-1.5">Zone</label>
          <select
            value={zone}
            onChange={(e) => setZone(Number(e.target.value))}
            className="w-full rounded-lg bg-surface-container-lowest px-3 py-2.5 text-sm text-on-surface border-etched focus:outline-none focus:ring-1 focus:ring-primary/40"
          >
            {zones.map((z) => (
              <option key={z.zone} value={z.zone}>{z.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-label-sm uppercase tracking-widest text-on-surface-variant block mb-1.5">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Morning cycle"
            className="w-full rounded-lg bg-surface-container-lowest px-3 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/40 border-etched focus:outline-none focus:ring-1 focus:ring-primary/40"
          />
        </div>
      </div>

      {/* Start time mode selector */}
      <div>
        <label className="text-label-sm uppercase tracking-widest text-on-surface-variant block mb-2">Start Time</label>
        <div className="flex gap-2 mb-3">
          {([['fixed', 'schedule', 'Fixed Time'], ['sunrise', 'wb_twilight', 'Sunrise'], ['sunset', 'nights_stay', 'Sunset']] as const).map(([mode, icon, label]) => (
            <button
              key={mode}
              onClick={() => setStartMode(mode)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                startMode === mode
                  ? 'bg-primary/20 text-primary font-medium'
                  : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-bright'
              }`}
            >
              <Icon name={icon} size={16} />
              {label}
            </button>
          ))}
        </div>

        {startMode === 'fixed' ? (
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="w-full rounded-lg bg-surface-container-lowest px-3 py-2.5 text-sm text-on-surface border-etched focus:outline-none focus:ring-1 focus:ring-primary/40"
          />
        ) : (
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={0}
              max={120}
              value={Math.abs(startOffset)}
              onChange={(e) => {
                const val = Math.min(120, Math.max(0, Number(e.target.value)));
                setStartOffset(startOffset <= 0 ? -val : val);
              }}
              className="w-20 rounded-lg bg-surface-container-lowest px-3 py-2.5 text-sm text-on-surface border-etched focus:outline-none focus:ring-1 focus:ring-primary/40"
            />
            <span className="text-sm text-on-surface-variant">minutes</span>
            <select
              value={startOffset <= 0 ? 'before' : 'after'}
              onChange={(e) => {
                const abs = Math.abs(startOffset);
                setStartOffset(e.target.value === 'before' ? -abs : abs);
              }}
              className="rounded-lg bg-surface-container-lowest px-3 py-2.5 text-sm text-on-surface border-etched focus:outline-none focus:ring-1 focus:ring-primary/40"
            >
              <option value="before">before</option>
              <option value="after">after</option>
            </select>
            <span className="text-sm text-on-surface-variant">{startMode}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-label-sm uppercase tracking-widest text-on-surface-variant block mb-1.5">
            Duration (min)
            {isSmart && smartData && (
              <span className="normal-case tracking-normal ml-1 text-primary font-normal">— smart: {smartData.minutes} min</span>
            )}
          </label>
          {isSmart ? (
            <div className="w-full rounded-lg bg-surface-container-lowest px-3 py-2.5 text-sm border-etched flex items-center gap-2">
              <Icon name="auto_awesome" size={16} className="text-primary" />
              <span className="text-primary font-medium">{smartData?.minutes ?? '...'} min</span>
              <span className="text-xs text-on-surface-variant">(auto-calculated daily from ET₀)</span>
            </div>
          ) : (
            <input
              type="number"
              min={1}
              max={120}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="w-full rounded-lg bg-surface-container-lowest px-3 py-2.5 text-sm text-on-surface border-etched focus:outline-none focus:ring-1 focus:ring-primary/40"
            />
          )}
        </div>
      </div>

      <div>
        <label className="text-label-sm uppercase tracking-widest text-on-surface-variant block mb-2">Days</label>
        <div className="flex gap-2">
          {DAYS.map((day, i) => (
            <button
              key={day}
              onClick={() => toggleDay(day)}
              className={`flex h-9 w-9 items-center justify-center rounded-full text-sm transition-colors ${
                selectedDays.includes(day)
                  ? 'bg-primary text-on-primary font-medium'
                  : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-bright'
              }`}
            >
              {DAY_LABELS[i]}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-on-surface">Skip when rain is forecasted</p>
            <p className="text-xs text-on-surface-variant">Automatically skip this schedule if rain is expected</p>
          </div>
          <Toggle checked={rainSkip} onChange={setRainSkip} />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-on-surface">Priority</p>
            <p className="text-xs text-on-surface-variant">Run even when rain skip or moisture delay is active</p>
          </div>
          <Toggle checked={priority} onChange={setPriority} />
        </div>
        {/* Expiry */}
        <div>
          <p className="text-sm text-on-surface mb-1">Schedule expires</p>
          <div className="flex items-center gap-2 flex-wrap">
            {(['never', 'weeks', 'date'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setExpiryMode(mode)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  expiryMode === mode
                    ? 'bg-primary text-on-primary'
                    : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-bright'
                }`}
              >
                {mode === 'never' ? 'Never' : mode === 'weeks' ? 'After X weeks' : 'On date'}
              </button>
            ))}
          </div>
          {expiryMode === 'weeks' && (
            <div className="mt-2 flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={52}
                value={expiryWeeks}
                onChange={(e) => setExpiryWeeks(Number(e.target.value))}
                className="w-20 rounded-lg bg-surface-container-lowest px-3 py-2 text-sm text-on-surface border-etched focus:outline-none focus:ring-1 focus:ring-primary/40"
              />
              <span className="text-sm text-on-surface-variant">weeks from now</span>
            </div>
          )}
          {expiryMode === 'date' && (
            <div className="mt-2">
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                min={new Date().toISOString().slice(0, 10)}
                className="rounded-lg bg-surface-container-lowest px-3 py-2 text-sm text-on-surface border-etched focus:outline-none focus:ring-1 focus:ring-primary/40"
              />
            </div>
          )}
        </div>

        {(() => {
          const p = profiles?.find(pr => pr.zone === zone);
          const hasSmart = p?.smartEnabled && p.soilType && p.plantType;
          return (
            <div className="flex items-center justify-between rounded-lg bg-surface-container-low border border-outline-variant/10 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <Icon name="auto_awesome" size={16} className={hasSmart ? 'text-primary' : 'text-on-surface-variant/40'} />
                <div>
                  <p className="text-sm text-on-surface">Smart Duration</p>
                  <p className="text-xs text-on-surface-variant">
                    {hasSmart
                      ? 'Runtime auto-calculated from soil + plant profile'
                      : 'Configure soil & plant type in Settings → Zone Profiles to enable'}
                  </p>
                </div>
              </div>
              {hasSmart ? (
                <StatusChip label="Active" color="cyan" />
              ) : (
                <StatusChip label="Off" color="neutral" />
              )}
            </div>
          );
        })()}
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button
          onClick={onCancel}
          className="rounded-xl px-4 py-2.5 text-sm text-on-surface-variant hover:bg-surface-container-high transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          className="rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-on-primary hover:shadow-glow transition-all"
        >
          {isEdit ? 'Save Changes' : 'Create Schedule'}
        </button>
      </div>
    </Card>
  );
}
