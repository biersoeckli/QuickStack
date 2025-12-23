'use server'

import { getAdminUserSession, simpleAction } from "@/server/utils/action-wrapper.utils";
import { SuccessActionResult } from "@/shared/model/server-action-error-return.model";
import clusterService from "@/server/services/node.service";
import traefikService from "@/server/services/traefik.service";
import { TraefikIpPropagationStatus } from "@/shared/model/traefik-ip-propagation.model";

export const setNodeStatus = async (nodeName: string, schedulable: boolean) =>
  simpleAction(async () => {
    await getAdminUserSession();
    await clusterService.setNodeStatus(nodeName, schedulable);
    return new SuccessActionResult(undefined, 'Successfully updated node status.');
  });

export const applyTraefikIpPropagation = async (enableIpPreservation: boolean) =>
  simpleAction<TraefikIpPropagationStatus, TraefikIpPropagationStatus>(async () => {
    await getAdminUserSession();
    const updatedStatus = await traefikService.applyExternalTrafficPolicy(enableIpPreservation);
    return new SuccessActionResult<TraefikIpPropagationStatus>(
      updatedStatus,
      `Traefik externalTrafficPolicy set to ${enableIpPreservation ? 'Local' : 'Cluster'}.`,
    );
  });

export const getTraefikIpPropagationStatus = async () =>
  simpleAction<TraefikIpPropagationStatus, TraefikIpPropagationStatus>(async () => {
    await getAdminUserSession();
    return traefikService.getStatus();
  });
