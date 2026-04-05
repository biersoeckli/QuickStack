'use server'

import { getAuthUserSession } from "@/server/utils/action-wrapper.utils";
import buildService from "@/server/services/build.service";
import PageTitle from "@/components/custom/page-title";
import BuildsTable from "./builds-table";
import { UserGroupUtils } from "@/shared/utils/role.utils";
import { CatchUtils } from "@/shared/utils/catch.utils";

export default async function BuildsPage() {
    const session = await getAuthUserSession();

    const allBuilds = await CatchUtils.resultOrUndefined(() => buildService.getAllBuilds());
    const filteredBuilds = (allBuilds ?? []).filter((build) =>
        UserGroupUtils.sessionHasReadAccessForApp(session, build.appId)
    );

    return (
        <div className="flex-1 space-y-4 pt-6">
            <PageTitle
                title="Builds"
                subtitle="Overview of all build jobs across all apps."
            />
            <BuildsTable initialBuilds={filteredBuilds} session={session} />
        </div>
    );
}
