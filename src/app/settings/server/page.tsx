'use server'

import { getAuthUserSession } from "@/server/utils/action-wrapper.utils";
import PageTitle from "@/components/custom/page-title";
import paramService, { ParamService } from "@/server/services/param.service";
import QuickStackIngressSettings from "./qs-ingress-settings";
import QuickStackLetsEncryptSettings from "./qs-letsencrypt-settings";
import { Constants } from "@/shared/utils/constants";
import QuickStackRegistrySettings from "./qs-registry-settings";
import s3TargetService from "@/server/services/s3-target.service";
import QuickStackPublicIpSettings from "./qs-public-ip-settings";
import BreadcrumbSetter from "@/components/breadcrumbs-setter";

export default async function ProjectPage() {

    const session = await getAuthUserSession();
    const serverUrl = await paramService.getString(ParamService.QS_SERVER_HOSTNAME, '');
    const disableNodePortAccess = await paramService.getBoolean(ParamService.DISABLE_NODEPORT_ACCESS, false);
    const letsEncryptMail = await paramService.getString(ParamService.LETS_ENCRYPT_MAIL, session.email);
    const regitryStorageLocation = await paramService.getString(ParamService.REGISTRY_SOTRAGE_LOCATION, Constants.INTERNAL_REGISTRY_LOCATION);
    const ipv4Address = await paramService.getString(ParamService.PUBLIC_IPV4_ADDRESS);
    const s3Targets = await s3TargetService.getAll();

    return (
        <div className="flex-1 space-y-4 pt-6">
            <PageTitle
                title={'Server Settings'}
                subtitle={`View or edit Server Settings`}>
            </PageTitle>
            <BreadcrumbSetter items={[
                { name: "Settings", url: "/settings/profile" },
                { name: "QuickStack Server" },
            ]} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><QuickStackIngressSettings disableNodePortAccess={disableNodePortAccess!} serverUrl={serverUrl!} /></div>
                <div><QuickStackLetsEncryptSettings letsEncryptMail={letsEncryptMail!} /></div>
                <div><QuickStackPublicIpSettings publicIpv4={ipv4Address} /></div>
                <div><QuickStackRegistrySettings registryStorageLocation={regitryStorageLocation!} s3Targets={s3Targets} /></div>
            </div>
        </div>
    )
}
