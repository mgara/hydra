import type { ReactNode } from 'react';
import { useTheme } from '@/lib/theme';

interface CardProps {
  children: ReactNode;
  className?: string;
  accent?: 'cyan' | 'amber' | 'critical' | 'none';
}

const accentClasses = {
  cyan: 'power-bar-cyan',
  amber: 'power-bar-amber',
  critical: 'power-bar-critical',
  none: '',
};

export function Card({ children, className = '', accent = 'none' }: CardProps) {
  const { theme } = useTheme();
  const hasBg = theme !== 'none';

  return (
    <div
      className={`rounded-xl border-etched ${accentClasses[accent]} ${
        hasBg ? 'glass' : 'bg-surface-container'
      } ${className}`}
    >
      {children}
    </div>
  );
}
