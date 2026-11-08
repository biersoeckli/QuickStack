import AppMonitoringHistoryView from '@/components/custom/app-monitoring-history';
import { AppExtendedModel } from '@/shared/model/app-extended.model';
import { useCallback, useState } from 'react';
import { getRessourceDataApp } from '../deployments/actions';
import { usePolling } from '@/frontend/hooks/use-polling';
import { PodsResourceInfoModel } from '@/shared/model/pods-resource-info.model';

export default function MonitoringTab({ app }: { app: AppExtendedModel }) {
  const [selectedPod, setSelectedPod] = useState<PodsResourceInfoModel | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);

  const updateValues = useCallback(async () => {
    setError(undefined);
    try {
      const response = await getRessourceDataApp(app.projectId, app.id);
      if (response.status === 'success' && response.data) {
        setSelectedPod(response.data);
      } else {
        setSelectedPod(undefined);
        console.error(response);
        setError(response.message ?? 'An unknown error occurred.');
      }
    } catch (ex) {
      setSelectedPod(undefined);
      console.error(ex);
      setError('An unknown error occurred.');
    }
  }, [app.id, app.projectId]);

  usePolling(updateValues, { intervalMs: 10000, runImmediately: true });

  return (
    <>
      {error && <p role='alert'>Unable to load current App metrics: {error}</p>}
      <AppMonitoringHistoryView appId={app.id} currentUsage={selectedPod} />
    </>
  );
}
