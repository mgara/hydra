import { useEffect } from 'react';
import { Icon } from './Icon';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'default';
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  // Close on ESC
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onCancel]);

  if (!open) return null;

  const isDanger = variant === 'danger';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
      />
      {/* Panel */}
      <div className="relative z-10 w-full max-w-sm mx-4 rounded-xl bg-surface-container border-etched p-6 shadow-2xl animate-fade-in">
        <div className="flex items-center gap-3 mb-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${isDanger ? 'bg-critical/10' : 'bg-primary/10'}`}>
            <Icon
              name={isDanger ? 'warning' : 'help'}
              className={isDanger ? 'text-critical' : 'text-primary'}
              size={22}
            />
          </div>
          <h3 className="font-headline text-headline-md text-on-surface">{title}</h3>
        </div>
        <p className="text-sm text-on-surface-variant mb-6 leading-relaxed">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="rounded-lg px-4 py-2.5 text-sm text-on-surface-variant hover:bg-surface-container-high transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
              isDanger
                ? 'bg-critical/10 text-critical hover:bg-critical/20'
                : 'bg-primary text-on-primary hover:shadow-glow'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
