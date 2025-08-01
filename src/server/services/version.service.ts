import { revalidateTag, unstable_cache } from "next/cache";
import dataAccess from "../adapter/db.client";
import { Tags } from "../utils/cache-tag-generator.utils";
import { Prisma, VolumeBackup } from "@prisma/client";
import { VolumeBackupExtendedModel } from "@/shared/model/volume-backup-extended.model";
import dockerHubApiAdapter from "../adapter/dockerhub-api.adapter";
import paramService, { ParamService } from "./param.service";
import k3s from "../adapter/kubernetes-api.adapter";
import { Constants } from "@/shared/utils/constants";

class VersionService {

    async isInstalledQuickStackVersionTheLatestVersion(): Promise<boolean> {

        const useCanaryChannel = await paramService.getBoolean(ParamService.USE_CANARY_CHANNEL, false);
        const latestDockerhubVersion = await dockerHubApiAdapter.getLatestVersionForTag(useCanaryChannel ? 'canary' : 'latest');

        const quickstackPodInfo = await k3s.core.readNamespacedPod(Constants.QS_APP_NAME, Constants.QS_NAMESPACE);
        const imageId = quickstackPodInfo.body.status?.containerStatuses?.find(x => x)?.imageID;

        console.log('Latest DockerHub Version:', latestDockerhubVersion);
        console.log('QuickStack Pod Image ID:', imageId);
        return true;
    }
}

const versionService = new VersionService();
export default versionService;
