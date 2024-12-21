'use server'

import { getAuthUserSession } from "@/server/utils/action-wrapper.utils";
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
} from "@/components/ui/breadcrumb"
import PageTitle from "@/components/custom/page-title";
import userService from "@/server/services/user.service";
import paramService, { ParamService } from "@/server/services/param.service";
import QuickStackIngressSettings from "./qs-ingress-settings";
import QuickStackLetsEncryptSettings from "./qs-letsencrypt-settings";
import QuickStackMaintenanceSettings from "./qs-maintenance-settings";
import podService from "@/server/services/pod.service";
import { Constants } from "@/shared/utils/constants";
import ServerBreadcrumbs from "./server-breadcrumbs";
import QuickStackVersionInfo from "./qs-version-info";

export default async function ProjectPage() {

    const session = await getAuthUserSession();
    const serverUrl = await paramService.getString(ParamService.QS_SERVER_HOSTNAME, '');
    const disableNodePortAccess = await paramService.getBoolean(ParamService.DISABLE_NODEPORT_ACCESS, false);
    const letsEncryptMail = await paramService.getString(ParamService.LETS_ENCRYPT_MAIL, session.email);
    const qsPodInfos = await podService.getPodsForApp(Constants.QS_NAMESPACE, Constants.QS_APP_NAME);
    const qsPodInfo = qsPodInfos.find(p => !!p);
    const useCanaryChannel = await paramService.getBoolean(ParamService.USE_CANARY_CHANNEL, false);

    return (
        <div className="flex-1 space-y-4 pt-6">
            <PageTitle
                title={'Server Settings'}
                subtitle={`View or edit Server Settings`}>
            </PageTitle>
            <ServerBreadcrumbs />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><QuickStackIngressSettings disableNodePortAccess={disableNodePortAccess!} serverUrl={serverUrl!} /></div>
                <div> <QuickStackLetsEncryptSettings letsEncryptMail={letsEncryptMail!} /></div>
                <div><QuickStackMaintenanceSettings qsPodName={qsPodInfo?.podName} /></div>
                <div><QuickStackVersionInfo useCanaryChannel={useCanaryChannel!} /></div>
            </div>
        </div>
    )
}
