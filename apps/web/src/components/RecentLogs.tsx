import type { ExecutionLog } from '@/lib/api';
import { Icon } from './Icon';

interface RecentLogsProps {
  logs: ExecutionLog[];
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function statusLabel(log: ExecutionLog): { text: string; className: string } {
  switch (log.status) {
    case 'completed':
      return { text: `Zone ${log.zone} ${log.trigger_type === 'scheduled' ? 'scheduled cycle' : 'manual run'}`, className: 'text-on-surface' };
    case 'rain_skip':
      return { text: `Zone ${log.zone} rain skip`, className: 'text-secondary' };
    case 'leak_alarm':
      return { text: `Zone ${log.zone} leak alarm`, className: 'text-critical' };
    case 'manual_stop':
      return { text: `Zone ${log.zone} stopped`, className: 'text-on-surface-variant' };
    case 'error':
      return { text: `Zone ${log.zone} error`, className: 'text-critical' };
    default:
      return { text: `Zone ${log.zone} ${log.status}`, className: 'text-on-surface' };
  }
}

export function RecentLogs({ logs }: RecentLogsProps) {
  const recent = logs.slice(0, 5);

  return (
    <div className="space-y-4">
      <h4 className="font-headline text-[0.625rem] font-bold uppercase tracking-[0.2rem] text-on-surface-variant ml-1">
        Recent Log Entries
      </h4>
      <div className="bg-surface-container-lowest rounded-lg border border-outline-variant/10 divide-y divide-outline-variant/5">
        {recent.length === 0 && (
          <div className="p-4 text-center text-sm text-on-surface-variant">No recent activity</div>
        )}
        {recent.map((log) => {
          const { text, className } = statusLabel(log);
          return (
            <div key={log.id} className="p-3 flex items-start gap-3">
              <span className="text-[0.625rem] font-mono text-on-surface-variant py-1 shrink-0">
                {formatTime(log.started_at)}
              </span>
              <div className="min-w-0">
                <p className={`text-[0.6875rem] font-medium truncate ${className}`}>{text}</p>
                <p className="text-[0.625rem] text-on-surface-variant uppercase">{log.trigger_type}</p>
              </div>
            </div>
          );
        })}
      </div>
      <a
        href="/logs"
        className="block w-full text-center text-[0.625rem] font-bold text-primary uppercase tracking-[0.15rem] py-2 hover:bg-primary/5 rounded transition-all"
      >
        <Icon name="analytics" size={12} className="mr-1 align-middle" />
        View All Diagnostic Logs
      </a>
    </div>
  );
}
