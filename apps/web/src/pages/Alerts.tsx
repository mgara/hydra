import { useCallback, useState } from 'react';
import * as api from '@/lib/api';
import { useApi } from '@/hooks/useApi';
import { AlertBanner } from '@/components/AlertBanner';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';

export function Alerts() {
  const [showAll, setShowAll] = useState(false);
  const { data: alerts, refetch } = useApi(() => api.getAlerts(showAll), [showAll]);

  const handleDismiss = useCallback(async (id: number) => {
    await api.dismissAlert(id);
    refetch();
  }, [refetch]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-headline text-display-sm text-on-surface">Alerts</h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            {alerts?.length ?? 0} alert{alerts?.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setShowAll(!showAll)}
          className="flex items-center gap-2 rounded-xl bg-surface-container-high px-4 py-2.5 text-sm text-on-surface-variant hover:text-on-surface transition-colors"
        >
          <Icon name={showAll ? 'visibility_off' : 'visibility'} size={18} />
          {showAll ? 'Active Only' : 'Show All'}
        </button>
      </div>

      <div className="space-y-3">
        {alerts?.map((alert) => (
          <AlertBanner key={alert.id} alert={alert} onDismiss={handleDismiss} />
        ))}
        {alerts?.length === 0 && (
          <Card className="p-12 text-center">
            <Icon name="check_circle" className="text-primary mx-auto mb-3" size={40} />
            <h3 className="font-headline text-headline-sm text-on-surface">All Clear</h3>
            <p className="mt-1 text-sm text-on-surface-variant">No active alerts</p>
          </Card>
        )}
      </div>
    </div>
  );
}
