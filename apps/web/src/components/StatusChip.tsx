interface StatusChipProps {
  label: string;
  color?: 'cyan' | 'amber' | 'critical' | 'neutral';
  pulse?: boolean;
}

const colorMap = {
  cyan: 'bg-primary',
  amber: 'bg-secondary',
  critical: 'bg-critical',
  neutral: 'bg-on-surface-variant',
};

export function StatusChip({ label, color = 'neutral', pulse }: StatusChipProps) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-container-high px-2.5 py-1">
      <span
        className={`h-1.5 w-1.5 rounded-full ${colorMap[color]} ${pulse ? 'animate-pulse-glow' : ''}`}
      />
      <span className="text-label-sm uppercase text-on-surface-variant">{label}</span>
    </span>
  );
}
