import { unstable_cache } from "next/cache";
import quickStackService from "./qs.service";
import { Tags } from "../utils/cache-tag-generator.utils";
import { qsVersionInfoAdapter } from "../adapter/qs-versioninfo.adapter";
import paramService, { ParamService } from "./param.service";

class QuickStackUpdateService {

    async getNewVersionInfo() {
        try {
            const quickstackInstanceIdParam = await paramService.getOrUndefined(ParamService.QS_INSTANCE_ID);
            const currentVersion = quickStackService.getVersionOfCurrentQuickstackInstance();
            if (!currentVersion) {
                return undefined;
            }

            if (currentVersion.includes('canary')) {
                return undefined;
            }

            const latestVersionInfo = await unstable_cache(async () => qsVersionInfoAdapter.getLatestQuickStackVersion(quickstackInstanceIdParam?.value),
                [Tags.quickStackVersionInfo()], {
                tags: [Tags.quickStackVersionInfo()],
                revalidate: 60 * 15, // 15 minutes
            })();
            if (currentVersion === latestVersionInfo.version) {
                return undefined;
            }
            return latestVersionInfo;
        } catch (error) {
            console.error("Error fetching latest QuickStack version:", error);
        }
    }
}

const quickStackUpdateService = new QuickStackUpdateService();
export default quickStackUpdateService;