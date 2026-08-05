import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import React from "react";
import { DeploymentInfoModel } from "@/shared/model/deployment-info.model";
import { formatDateTime } from "@/frontend/utils/format.utils";
import BuildLogsStreamed from "@/components/custom/build-logs-streamed";

export function BuildLogsDialog({
  deploymentInfo,
  onClose
}: {
  deploymentInfo?: DeploymentInfoModel;
  onClose: () => void;
}) {

  if (!deploymentInfo) {
    return <></>;
  }

  return (
    <Dialog open={!!deploymentInfo} onOpenChange={() => {
      onClose();
    }}>
      <DialogContent className="sm:max-w-[1300px]">
        <DialogHeader>
          <DialogTitle>Deployment Logs</DialogTitle>
          <DialogDescription>
            View the logs for the selected deployment {formatDateTime(deploymentInfo.createdAt)}.
          </DialogDescription>
        </DialogHeader>
        <div >
          {!deploymentInfo.deploymentId && 'For this build is no log available'}
          {deploymentInfo.deploymentId && <BuildLogsStreamed deploymentId={deploymentInfo.deploymentId} />}
        </div>
      </DialogContent>
    </Dialog>
  )
}
