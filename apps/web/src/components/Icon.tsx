interface IconProps {
  name: string;
  className?: string;
  filled?: boolean;
  size?: number;
}

export function Icon({ name, className = '', filled, size }: IconProps) {
  return (
    <span
      className={`material-symbols-outlined ${filled ? 'icon-filled' : ''} ${className}`}
      style={size ? { fontSize: size } : undefined}
    >
      {name}
    </span>
  );
}
