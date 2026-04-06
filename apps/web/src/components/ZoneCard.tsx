import { useState, useRef, useEffect } from 'react';
import type { ZoneState, Schedule, ZoneProfile, SoilReading } from '@/lib/api';
import { Card } from './Card';
import { Icon } from './Icon';
import { formatWeekday } from '@/lib/locale';

interface ZoneCardProps {
  zone: ZoneState;
  schedules?: Schedule[];
  profile?: ZoneProfile | null;
  soilMoisture?: SoilReading | null;
  onStart: (zone: number) => void;
  onStop: (zone: number) => void;
  onRename: (zone: number, name: string) => void;
}

function formatRemaining(seconds: number | null): string {
  if (!seconds) return '--:--';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

const DAY_MAP: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };

function getNextRun(schedules: Schedule[]): string | null {
  const now = new Date();
  const today = now.getDay();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  let best: { daysAway: number; time: string } | null = null;

  for (const s of schedules) {
    if (!s.enabled) continue;
    const parts = s.startTime.split(':').map(Number);
    const h = parts[0] ?? 0;
    const m = parts[1] ?? 0;
    const schedMinutes = h * 60 + m;
    const scheduleDays = s.days.split(',').map(d => DAY_MAP[d.trim().toLowerCase()]).filter(d => d !== undefined);

    for (const dayNum of scheduleDays) {
      let daysAway = (dayNum - today + 7) % 7;
      if (daysAway === 0 && schedMinutes <= nowMinutes) daysAway = 7;
      if (!best || daysAway < best.daysAway || (daysAway === best.daysAway && schedMinutes < parseInt(best.time))) {
        best = { daysAway, time: s.startTime };
      }
    }
  }

  if (!best) return null;
  if (best.daysAway === 0) return `Today ${best.time}`;
  if (best.daysAway === 1) return `Tomorrow ${best.time}`;
  const nextDate = new Date(now);
  nextDate.setDate(nextDate.getDate() + best.daysAway);
  const dayName = formatWeekday(nextDate);
  return `${dayName} ${best.time}`;
}

export function ZoneCard({ zone, schedules, profile, soilMoisture, onStart, onStop, onRename }: ZoneCardProps) {
  const isRunning = zone.status === 'running';
  const isIdle = zone.status === 'idle';
  const accent = isRunning ? 'cyan' : 'none';
  const hasSmart = profile?.smartEnabled && !!profile.soilType && !!profile.plantType;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(zone.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const commitRename = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== zone.name) {
      onRename(zone.zone, trimmed);
    } else {
      setDraft(zone.name);
    }
    setEditing(false);
  };

  const nextRun = isIdle && schedules ? getNextRun(schedules) : null;

  return (
    <Card
      accent={accent}
      className={`p-5 transition-all duration-300 relative overflow-hidden ${
        isRunning ? 'bg-surface-container shadow-glow' : 'bg-surface-container-low hover:bg-surface-container'
      }`}
    >
      {/* Big watermark zone number */}
      <div className="absolute top-0 right-0 p-2 opacity-[0.04] pointer-events-none select-none">
        <span className="text-6xl font-headline font-black">{String(zone.zone).padStart(2, '0')}</span>
      </div>

      {/* Header: name + status icon */}
      <div className="flex justify-between items-start mb-5 relative z-10">
        <div className="min-w-0 flex-1">
          {editing ? (
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename();
                if (e.key === 'Escape') { setDraft(zone.name); setEditing(false); }
              }}
              className="w-full bg-surface-container-high border border-outline-variant/30 rounded-lg px-2 py-1 font-headline text-sm font-bold text-on-surface outline-none focus:border-primary transition-colors"
              maxLength={32}
            />
          ) : (
            <button
              onClick={() => { setDraft(zone.name); setEditing(true); }}
              className="group flex items-center gap-1.5 min-w-0"
              title="Click to rename"
            >
              <h4 className="font-headline font-bold text-sm text-on-surface truncate uppercase">{zone.name}</h4>
              <Icon
                name="edit"
                size={12}
                className="text-on-surface-variant opacity-0 group-hover:opacity-60 transition-opacity shrink-0"
              />
            </button>
          )}
          <span className={`text-[0.625rem] uppercase tracking-tight ${isRunning ? 'text-tertiary' : 'text-outline'}`}>
            Zone {String(zone.zone).padStart(2, '0')} - {isRunning ? 'RUNNING' : 'IDLE'}
          </span>
        </div>
        {isRunning ? (
          <Icon name="water_drop" className="text-tertiary animate-pulse" size={22} filled />
        ) : (
          <Icon name="mode_standby" className="text-outline" size={22} />
        )}
      </div>

      {/* Status pills */}
      {(hasSmart || soilMoisture) && (
        <div className="flex flex-wrap gap-1.5 mb-4 relative z-10">
          {hasSmart && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5">
              <Icon name="auto_awesome" size={12} className="text-primary" />
              <span className="text-[0.5625rem] font-medium text-primary uppercase tracking-wider">Smart</span>
            </span>
          )}
          {soilMoisture && (
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${moisturePillStyle(soilMoisture.moisture)}`}>
              <Icon name="grass" size={12} />
              <span className="text-[0.5625rem] font-medium uppercase tracking-wider">{soilMoisture.moisture.toFixed(0)}%</span>
            </span>
          )}
        </div>
      )}

      {/* Info row */}
      <div className="space-y-4 relative z-10">
        {isRunning ? (
          <div className="flex justify-between text-[0.6875rem] text-on-surface-variant">
            <span>Remaining Time</span>
            <span className="text-on-surface font-mono">{formatRemaining(zone.remainingSeconds)}</span>
          </div>
        ) : (
          <div className="flex justify-between text-[0.6875rem] text-on-surface-variant">
            <span>Next Run</span>
            <span className={nextRun ? 'text-primary-light' : 'text-secondary'}>{nextRun ?? 'No schedule'}</span>
          </div>
        )}

        {/* Action button */}
        {isRunning ? (
          <button
            onClick={() => onStop(zone.zone)}
            className="w-full py-2 bg-tertiary/10 text-tertiary text-[0.625rem] font-bold uppercase tracking-widest border border-tertiary/20 hover:bg-tertiary hover:text-black transition-all"
          >
            Stop Flow
          </button>
        ) : (
          <button
            onClick={() => onStart(zone.zone)}
            className="w-full py-2 text-[0.625rem] font-bold uppercase tracking-widest text-on-surface-variant bg-surface-container-high border border-outline-variant/30 hover:bg-primary hover:text-black hover:border-primary transition-all"
          >
            Quick Start
          </button>
        )}
      </div>
    </Card>
  );
}

function moisturePillStyle(moisture: number): string {
  if (moisture >= 70) return 'bg-primary/10 text-primary-light';
  if (moisture >= 40) return 'bg-emerald-400/10 text-emerald-400';
  if (moisture >= 20) return 'bg-secondary/10 text-secondary';
  return 'bg-critical/10 text-critical';
}
