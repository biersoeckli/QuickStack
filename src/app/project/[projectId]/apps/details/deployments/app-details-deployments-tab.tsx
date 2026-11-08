import { AppExtendedModel } from '@/shared/model/app-extended.model';
import { RolePermissionEnum } from '@/shared/model/role-extended.model';
import { useNestedDrawer } from '../../../../workload-components/drawer/nested-drawer';
import { DeploymentInfoModel } from '@/shared/model/deployment-info.model';
import { BuildLogsDialogContent } from '@/app/project/workload-components/build-logs-dialog-content';
import BuildsTab from '@/app/project/[projectId]/apps/details/deployments/deployments';
import { formatDateTime } from '@/frontend/utils/format.utils';
import WebhookDeploymentInfo from '@/app/project/[projectId]/apps/details/deployments/webhook-deployment';
import { Button } from '@/components/ui/button';
import { Webhook } from 'lucide-react';

export default function DrawerDeploymentsTab({ app, role }: { app: AppExtendedModel; role: RolePermissionEnum }) {
  const { openNestedDrawer } = useNestedDrawer();

  const showLogs = (deployment: DeploymentInfoModel) => {
    openNestedDrawer({
      title: 'Deployment Logs',
      description: `View the logs for the selected deployment ${formatDateTime(deployment.createdAt)}.`,
      content: <BuildLogsDialogContent deploymentInfo={deployment} workloadId={app.id} workloadType="app" hideHeader />
    });
  };

  const showWebhookCard = () => {
    openNestedDrawer({
      title: 'Webhook',
      description: 'Use this webhook URL to trigger deployments from external services (for example GitHub Actions or GitLab Pipelines).',
      content: <WebhookDeploymentInfo app={app} role={role} />
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between pl-2">
        <div className="text-lg font-semibold text-foreground/80">Latest Deployments</div>
        <Button onClick={showWebhookCard} variant="outline">
          <Webhook /> Configure Webhooks
        </Button>
      </div>
      <BuildsTab app={app} role={role} onShowLogs={showLogs} />
    </div>
  );
}
