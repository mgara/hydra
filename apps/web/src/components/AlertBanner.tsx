import type { Alert } from '@/lib/api';
import { Icon } from './Icon';

interface AlertBannerProps {
  alert: Alert;
  onDismiss: (id: number) => void;
}

const severityConfig = {
  critical: {
    bg: 'bg-critical-container/30',
    border: 'power-bar-critical',
    icon: 'error',
    iconColor: 'text-critical',
  },
  warning: {
    bg: 'bg-secondary-container/30',
    border: 'power-bar-amber',
    icon: 'warning',
    iconColor: 'text-secondary',
  },
  info: {
    bg: 'bg-surface-container-high',
    border: 'power-bar-cyan',
    icon: 'info',
    iconColor: 'text-primary',
  },
};

export function AlertBanner({ alert, onDismiss }: AlertBannerProps) {
  const config = severityConfig[alert.severity];

  return (
    <div className={`rounded-xl ${config.bg} ${config.border} p-4 animate-fade-in`}>
      <div className="flex items-start gap-3">
        <Icon name={config.icon} className={config.iconColor} size={20} />
        <div className="flex-1 min-w-0">
          <h4 className="font-headline text-headline-sm text-on-surface">{alert.title}</h4>
          <p className="mt-0.5 text-sm text-on-surface-variant">{alert.message}</p>
        </div>
        <button
          onClick={() => onDismiss(alert.id)}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-colors"
        >
          <Icon name="close" size={18} />
        </button>
      </div>
    </div>
  );
}
