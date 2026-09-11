import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import React from "react";
import { DeploymentInfoModel } from "@/shared/model/deployment-info.model";
import { WorkloadType } from "@/shared/model/runtime-type.model";
import { formatDateTime } from "@/frontend/utils/format.utils";
import BuildLogsStreamed from "@/components/custom/build-logs-streamed";

export function BuildLogsDialogContent({
  deploymentInfo,
  workloadId,
  workloadType,
}: {
  deploymentInfo?: DeploymentInfoModel;
  workloadId?: string;
  workloadType?: WorkloadType;
}) {

  if (!deploymentInfo) {
    return <></>;
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Deployment Logs</DialogTitle>
        <DialogDescription>
          View the logs for the selected deployment {formatDateTime(deploymentInfo.createdAt)}.
        </DialogDescription>
      </DialogHeader>
      <div>
        {(!deploymentInfo.deploymentId || !workloadId || !workloadType) && 'For this build is no log available'}
        {deploymentInfo.deploymentId && workloadId && workloadType && <BuildLogsStreamed deploymentId={deploymentInfo.deploymentId} workloadId={workloadId} workloadType={workloadType} />}
      </div>
    </>
  )
}
