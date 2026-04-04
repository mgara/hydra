import { usePolling } from '@/hooks/useApi';
import * as api from '@/lib/api';
import { Card } from './Card';
import { Icon } from './Icon';

interface FlowCardProps {
  flowGpm: number;
  dailyTotalGallons: number;
}

export function FlowCard({ flowGpm, dailyTotalGallons }: FlowCardProps) {
  const { data: readings } = usePolling(() => api.getFlowReadings({ limit: 30 }), 10000);
  const { data: flowCurrent } = usePolling(() => api.getFlowCurrent(), 3000);

  const currentGpm = flowCurrent?.gpm ?? flowGpm;
  const hasFlow = currentGpm > 0.05;
  const monitoringOn = flowCurrent?.monitoringEnabled ?? true;
  const safetyOn = flowCurrent?.safetyEnabled ?? true;

  return (
    <Card accent={hasFlow ? 'cyan' : 'none'} className="p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon name="water" className="text-on-surface-variant" size={18} />
          <span className="text-label-sm uppercase tracking-widest text-on-surface-variant">
            Live Flow
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {monitoringOn && (
            <span
              className={`h-2 w-2 rounded-full ${safetyOn ? 'bg-emerald-400' : 'bg-secondary'}`}
              title={safetyOn ? 'Flow safety active' : 'Flow safety disabled'}
            />
          )}
        </div>
      </div>

      <div className="flex items-baseline gap-1">
        <span className={`font-headline text-display-sm ${hasFlow ? 'text-primary-light' : 'text-on-surface'}`}>
          {currentGpm.toFixed(1)}
        </span>
        <span className="text-label-md text-on-surface-variant">GPM</span>
      </div>

      <p className="mt-1 text-label-sm text-on-surface-variant opacity-70">
        {dailyTotalGallons.toFixed(1)} gal today
      </p>

      {/* Sparkline */}
      {readings && readings.length > 1 && (
        <div className="mt-3">
          <Sparkline data={readings.map(r => r.gpm).reverse()} />
        </div>
      )}
    </Card>
  );
}

function Sparkline({ data }: { data: number[] }) {
  const width = 120;
  const height = 32;
  const padding = 2;

  const max = Math.max(...data, 0.1);
  const step = (width - padding * 2) / Math.max(data.length - 1, 1);

  const points = data
    .map((v, i) => {
      const x = padding + i * step;
      const y = height - padding - ((v / max) * (height - padding * 2));
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-8 opacity-60"
      preserveAspectRatio="none"
    >
      <polyline
        points={points}
        fill="none"
        stroke="var(--color-primary, #00D1FF)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
