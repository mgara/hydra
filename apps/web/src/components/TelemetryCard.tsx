import { Card } from './Card';
import { Icon } from './Icon';

interface TelemetryCardProps {
  icon: string;
  label: string;
  value: string;
  unit?: string;
  accent?: 'cyan' | 'amber' | 'critical' | 'none';
  subtitle?: string;
}

export function TelemetryCard({ icon, label, value, unit, accent = 'none', subtitle }: TelemetryCardProps) {
  const valueColor = accent === 'cyan' ? 'text-primary-light'
    : accent === 'amber' ? 'text-secondary'
    : accent === 'critical' ? 'text-critical'
    : 'text-on-surface';

  return (
    <Card accent={accent} className="p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon name={icon} className="text-on-surface-variant" size={18} />
        <span className="text-label-sm uppercase tracking-widest text-on-surface-variant">
          {label}
        </span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className={`font-headline text-display-sm ${valueColor}`}>
          {value}
        </span>
        {unit && (
          <span className="text-label-md text-on-surface-variant">{unit}</span>
        )}
      </div>
      {subtitle && (
        <p className="mt-1 text-label-sm text-on-surface-variant opacity-70">{subtitle}</p>
      )}
    </Card>
  );
}
