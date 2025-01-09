'use server'

import { getAuthUserSession } from "@/server/utils/action-wrapper.utils";
import PageTitle from "@/components/custom/page-title";
import paramService, { ParamService } from "@/server/services/param.service";
import podService from "@/server/services/pod.service";
import { Constants } from "@/shared/utils/constants";
import s3TargetService from "@/server/services/s3-target.service";
import QuickStackVersionInfo from "./qs-version-info";
import QuickStackMaintenanceSettings from "./qs-maintenance-settings";
import BreadcrumbSetter from "@/components/breadcrumbs-setter";

export default async function MaintenancePage() {

    await getAuthUserSession();
    const useCanaryChannel = await paramService.getBoolean(ParamService.USE_CANARY_CHANNEL, false);
    const qsPodInfos = await podService.getPodsForApp(Constants.QS_NAMESPACE, Constants.QS_APP_NAME);
    const qsPodInfo = qsPodInfos.find(p => !!p);

    return (
        <div className="flex-1 space-y-4 pt-6">
            <PageTitle
                title={'Maintenance'}
                subtitle={`Options to maintain your QuickStack Cluster`}>
            </PageTitle>
            <BreadcrumbSetter items={[
                {
                    name: 'Settings'
                },
                {
                    name: 'Maintenance'
                },
            ]} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><QuickStackVersionInfo useCanaryChannel={useCanaryChannel!} /></div>
                <div><QuickStackMaintenanceSettings qsPodName={qsPodInfo?.podName} /></div>
            </div>
        </div>
    )
}
