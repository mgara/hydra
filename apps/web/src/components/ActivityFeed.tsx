import type { ExecutionLog } from '@/lib/api';
import { Card } from './Card';

interface ActivityFeedProps {
  logs: ExecutionLog[];
}

const HOUR_LABELS = ['00:00', '06:00', '12:00', '18:00', '23:59'];

function buildHourBuckets(logs: ExecutionLog[]): number[] {
  const buckets = new Array(24).fill(0);
  const now = new Date();
  const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  for (const log of logs) {
    const start = new Date(log.started_at);
    if (start < cutoff) continue;
    const hour = start.getHours();
    buckets[hour] += log.duration_seconds ? log.duration_seconds / 60 : 1;
  }
  return buckets;
}

export function ActivityFeed({ logs }: ActivityFeedProps) {
  const buckets = buildHourBuckets(logs);
  const max = Math.max(...buckets, 1);

  return (
    <Card className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h4 className="font-headline text-sm font-bold uppercase tracking-widest text-on-surface-variant">
          24-Hour Activity Feed
        </h4>
        <span className="text-[0.625rem] text-outline uppercase tracking-wider">Live Feed</span>
      </div>
      <div className="relative h-32 w-full flex items-end gap-[2px]">
        {buckets.map((val, i) => {
          const pct = Math.max((val / max) * 100, 3);
          const active = val > 0;
          return (
            <div
              key={i}
              className={`flex-1 rounded-t-sm transition-all ${
                active ? 'bg-primary/40' : 'bg-surface-container-highest'
              }`}
              style={{ height: `${pct}%` }}
              title={`${String(i).padStart(2, '0')}:00 — ${Math.round(val)} min`}
            />
          );
        })}
      </div>
      <div className="flex justify-between mt-2 text-[0.625rem] text-outline font-headline font-bold">
        {HOUR_LABELS.map((l) => (
          <span key={l}>{l}</span>
        ))}
      </div>
    </Card>
  );
}
