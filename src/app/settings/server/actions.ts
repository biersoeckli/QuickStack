'use server'

import { getAdminUserSession, getAuthUserSession, saveFormAction, simpleAction, fileUploadAction } from "@/server/utils/action-wrapper.utils";
import paramService, { ParamService } from "@/server/services/param.service";
import { QsIngressSettingsModel, qsIngressSettingsZodModel } from "@/shared/model/qs-settings.model";
import { QsLetsEncryptSettingsModel, qsLetsEncryptSettingsZodModel } from "@/shared/model/qs-letsencrypt-settings.model";
import quickStackService from "@/server/services/qs.service";
import { ServerActionResult, SuccessActionResult } from "@/shared/model/server-action-error-return.model";
import registryService from "@/server/services/registry.service";
import { RegistryStorageLocationSettingsModel, registryStorageLocationSettingsZodModel } from "@/shared/model/registry-storage-location-settings.model";
import { SystemBackupLocationSettingsModel, systemBackupLocationSettingsZodModel } from "@/shared/model/system-backup-location-settings.model";
import { Constants } from "@/shared/utils/constants";
import { QsPublicIpv4SettingsModel, qsPublicIpv4SettingsZodModel } from "@/shared/model/qs-public-ipv4-settings.model";
import ipAddressFinderAdapter from "@/server/adapter/ip-adress-finder.adapter";
import { KubeSizeConverter } from "@/shared/utils/kubernetes-size-converter.utils";
import buildService from "@/server/services/build.service";
import standalonePodService from "@/server/services/standalone-services/standalone-pod.service";
import maintenanceService from "@/server/services/standalone-services/maintenance.service";
import appLogsService from "@/server/services/standalone-services/app-logs.service";
import systemBackupService from "@/server/services/standalone-services/system-backup.service";
import backupService from "@/server/services/standalone-services/backup.service";
import networkPolicyService from "@/server/services/network-policy.service";
import traefikService from "@/server/services/traefik.service";
import { PathUtils } from "@/server/utils/path.utils";
import { FsUtils } from "@/server/utils/fs.utils";
import fs from "fs";
import { z } from "zod";
import { revalidateTag } from "next/cache";
import { Tags } from "@/server/utils/cache-tag-generator.utils";
import clusterService from "@/server/services/cluster.service";
import { TraefikIpPropagationStatus } from "@/shared/model/traefik-ip-propagation.model";
import k3sUpdateService from "@/server/services/upgrade-services/k3s-update.service";
import longhornUpdateService from "@/server/services/upgrade-services/longhorn-update.service";

export const setNodeStatus = async (nodeName: string, schedulable: boolean) =>
  simpleAction(async () => {
    await getAdminUserSession();
    await clusterService.setNodeStatus(nodeName, schedulable);
    return new SuccessActionResult(undefined, 'Successfully updated node status.');
  });

export const applyTraefikIpPropagation = async (enableIpPreservation: boolean) =>
  simpleAction(async () => {
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

export const updateIngressSettings = async (prevState: any, inputData: QsIngressSettingsModel) =>
  saveFormAction(inputData, qsIngressSettingsZodModel, async (validatedData) => {
    await getAdminUserSession();

    const url = new URL(validatedData.serverUrl.includes('://') ? validatedData.serverUrl : `https://${validatedData.serverUrl}`);

    await paramService.save({
      name: ParamService.QS_SERVER_HOSTNAME,
      value: url.hostname
    });

    await paramService.save({
      name: ParamService.DISABLE_NODEPORT_ACCESS,
      value: validatedData.disableNodePortAccess + ''
    });

    await quickStackService.createOrUpdateService(!validatedData.disableNodePortAccess);
    await quickStackService.createOrUpdateIngress(validatedData.serverUrl);
  });


export const updatePublicIpv4Settings = async (prevState: any, inputData: QsPublicIpv4SettingsModel) =>
  saveFormAction(inputData, qsPublicIpv4SettingsZodModel, async (validatedData) => {
    await getAdminUserSession();

    await paramService.save({
      name: ParamService.PUBLIC_IPV4_ADDRESS,
      value: validatedData.publicIpv4
    });
  });


export const updatePublicIpv4SettingsAutomatically = async () =>
  simpleAction(async () => {
    await getAdminUserSession();

    const publicIpv4 = await ipAddressFinderAdapter.getPublicIpOfServer();
    await paramService.save({
      name: ParamService.PUBLIC_IPV4_ADDRESS,
      value: publicIpv4
    });
  });

export const updateLetsEncryptSettings = async (prevState: any, inputData: QsLetsEncryptSettingsModel) =>
  saveFormAction(inputData, qsLetsEncryptSettingsZodModel, async (validatedData) => {
    await getAdminUserSession();

    await paramService.save({
      name: ParamService.LETS_ENCRYPT_MAIL,
      value: validatedData.letsEncryptMail
    });

    await quickStackService.createOrUpdateCertIssuer(validatedData.letsEncryptMail);
  });

export const getConfiguredHostname: () => Promise<ServerActionResult<unknown, string | undefined>> = async () =>
  simpleAction(async () => {
    await getAdminUserSession();

    return await paramService.getString(ParamService.QS_SERVER_HOSTNAME);
  });


export const cleanupOldTmpFiles = async () =>
  simpleAction(async () => {
    await getAdminUserSession();
    await maintenanceService.deleteAllTempFiles();
    return new SuccessActionResult(undefined, 'Successfully cleaned up temp files.');
  });

export const cleanupOldBuildJobs = async () =>
  simpleAction(async () => {
    await getAdminUserSession();
    await buildService.deleteAllFailedOrSuccededBuilds();
    return new SuccessActionResult(undefined, 'Successfully cleaned up old build jobs.');
  });

export const revalidateQuickStackVersionCache = async () =>
  simpleAction(async () => {
    revalidateTag(Tags.quickStackVersionInfo()); // separated because updateFunction restarts backend wich results in error
  });

export const updateQuickstack = async () =>
  simpleAction(async () => {
    await getAdminUserSession();
    const useCaranyChannel = await paramService.getBoolean(ParamService.USE_CANARY_CHANNEL, false);
    await quickStackService.updateQuickStack(useCaranyChannel);
    return new SuccessActionResult(undefined, 'QuickStack will be updated, refresh the page in a few seconds.');
  });

export const updateRegistry = async () =>
  simpleAction(async () => {
    await getAdminUserSession();
    const registryLocation = await paramService.getString(ParamService.REGISTRY_SOTRAGE_LOCATION, Constants.INTERNAL_REGISTRY_LOCATION);
    await registryService.deployRegistry(registryLocation!, true);
    return new SuccessActionResult(undefined, 'Registry will be updated, this might take a few seconds.');
  });

export const deleteAllFailedAndSuccededPods = async () =>
  simpleAction(async () => {
    await getAdminUserSession();
    await standalonePodService.deleteAllFailedAndSuccededPods();
    return new SuccessActionResult(undefined, 'Successfully deleted all failed and succeeded pods.');
  });

export const purgeRegistryImages = async () =>
  simpleAction(async () => {
    await getAdminUserSession();
    const deletedSize = await registryService.purgeRegistryImages();
    return new SuccessActionResult(undefined, `Successfully purged ${KubeSizeConverter.convertBytesToReadableSize(deletedSize)} of images.`);
  });

export const deleteOldAppLogs = async () =>
  simpleAction(async () => {
    await getAdminUserSession();
    await appLogsService.deleteOldAppLogs();
    return new SuccessActionResult(undefined, `Successfully deletes old app logs.`);
  });

export const setCanaryChannel = async (useCanaryChannel: boolean) =>
  simpleAction(async () => {
    await getAdminUserSession();
    await paramService.save({
      name: ParamService.USE_CANARY_CHANNEL,
      value: !!useCanaryChannel ? 'true' : 'false'
    });
    return new SuccessActionResult(undefined, `Turned ${useCanaryChannel ? 'on' : 'off'} the canary channel.`);
  });

export const setRegistryStorageLocation = async (prevState: any, inputData: RegistryStorageLocationSettingsModel) =>
  saveFormAction(inputData, registryStorageLocationSettingsZodModel, async (validatedData) => {
    await getAdminUserSession();

    await registryService.deployRegistry(validatedData.registryStorageLocation, true);

    await paramService.save({
      name: ParamService.REGISTRY_SOTRAGE_LOCATION,
      value: validatedData.registryStorageLocation
    });
  });

export const setSystemBackupLocation = async (prevState: any, inputData: SystemBackupLocationSettingsModel) =>
  saveFormAction(inputData, systemBackupLocationSettingsZodModel, async (validatedData) => {
    await getAdminUserSession();

    await paramService.save({
      name: ParamService.QS_SYSTEM_BACKUP_LOCATION,
      value: validatedData.systemBackupLocation
    });
  });

export const listSystemBackups = async () =>
  simpleAction(async () => {
    await getAdminUserSession();

    const systemBackupLocationId = await paramService.getString(ParamService.QS_SYSTEM_BACKUP_LOCATION, Constants.QS_SYSTEM_BACKUP_DEACTIVATED);

    if (systemBackupLocationId === Constants.QS_SYSTEM_BACKUP_DEACTIVATED || !systemBackupLocationId) {
      return new SuccessActionResult([], 'No backup location configured');
    }

    const backups = await systemBackupService.listSystemBackups(systemBackupLocationId);

    return new SuccessActionResult(backups, 'Backups loaded');
  }) as Promise<ServerActionResult<any, any[]>>;

export const runSystemBackupNow = async () =>
  simpleAction(async () => {
    await getAdminUserSession();

    const systemBackupLocationId = await paramService.getString(ParamService.QS_SYSTEM_BACKUP_LOCATION, Constants.QS_SYSTEM_BACKUP_DEACTIVATED);

    if (systemBackupLocationId === Constants.QS_SYSTEM_BACKUP_DEACTIVATED || !systemBackupLocationId) {
      throw new Error('System backup is not configured. Please select an S3 storage target first.');
    }

    await backupService.runSystemBackup();

    return new SuccessActionResult(undefined, 'System backup started successfully');
  });

export const deleteAllNetworkPolicies = async () =>
  simpleAction(async () => {
    await getAdminUserSession();

    const deletedCount = await networkPolicyService.deleteAllNetworkPolicies();

    return new SuccessActionResult(undefined, `Successfully deleted all (${deletedCount}) network policies.`);
  });

export const uploadAndRestoreSystemBackup = async (formData: FormData) =>
  fileUploadAction(formData, 'backupFile', async (file: File) => {
    await getAdminUserSession();

    const backupTempDir = PathUtils.tempBackupDataFolder;
    await FsUtils.createDirIfNotExistsAsync(backupTempDir, true);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const uploadPath = `${backupTempDir}/uploaded-backup-${timestamp}.tar.gz`;

    // Write uploaded file to disk
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await fs.promises.writeFile(uploadPath, buffer);

    try {
      // Restore the backup
      await systemBackupService.restoreSystemBackup(uploadPath);

      return new SuccessActionResult(undefined, 'System backup restored successfully. Please restart QuickStack for changes to take effect.');
    } finally {
      // Clean up uploaded file
      await FsUtils.deleteFileIfExists(uploadPath);
    }
  }) as Promise<ServerActionResult<any, void>>;

export const downloadSystemBackup = async (backupKey: string) =>
  simpleAction(async () => {
    await getAdminUserSession();

    const systemBackupLocationId = await paramService.getString(ParamService.QS_SYSTEM_BACKUP_LOCATION, Constants.QS_SYSTEM_BACKUP_DEACTIVATED);

    if (systemBackupLocationId === Constants.QS_SYSTEM_BACKUP_DEACTIVATED || !systemBackupLocationId) {
      throw new Error('System backup is not configured. Please select an S3 storage target first.');
    }

    const fileName = await systemBackupService.downloadSystemBackup(systemBackupLocationId, backupKey);

    return new SuccessActionResult(fileName, 'Starting download...');
  }) as Promise<ServerActionResult<any, string>>;

export const setTraefikIpPropagation = async (prevState: any, inputData: { enableIpPreservation: boolean }) =>
  saveFormAction(inputData, z.object({ enableIpPreservation: z.boolean() }), async (validatedData) => {
    await getAdminUserSession();
    await traefikService.applyExternalTrafficPolicy(validatedData.enableIpPreservation);
    return new SuccessActionResult(undefined, `Traefik externalTrafficPolicy set to ${validatedData.enableIpPreservation ? 'Local' : 'Cluster'}.`);
  });

export const checkK3sUpgradeControllerStatus = async () =>
  simpleAction(async () => {
    await getAdminUserSession();
    return await k3sUpdateService.isSystemUpgradeControllerPresent();
  });

export const installK3sUpgradeController = async () =>
  simpleAction(async () => {
    await getAdminUserSession();
    await k3sUpdateService.getCurrentK3sMinorVersion(); // if this succeds alls nodes have the same version and cluster is ready for upgrades
    await k3sUpdateService.installSystemUpgradeController();
    return new SuccessActionResult(undefined, 'K3s System Upgrade Controller has been installed successfully.');
  });

export const startK3sUpgrade = async () =>
  simpleAction(async () => {
    await getAdminUserSession();
    await k3sUpdateService.createUpgradePlans();
    return new SuccessActionResult(undefined, 'The upgrade process has started.');
  });

export const startLonghornUpgrade = async () =>
  simpleAction(async () => {
    await getAdminUserSession();
    await longhornUpdateService.upgrade();
    return new SuccessActionResult(undefined, 'Longhorn upgrade has been initiated. Volume engines will be upgraded automatically.');
  });
