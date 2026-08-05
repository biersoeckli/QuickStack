'use server'

import { getAuthUserSession } from "@/server/utils/action-wrapper.utils";
import agentService from "@/server/services/agent.service";
import PageTitle from "@/components/custom/page-title";
import { RequesterIdentity, ensureReadProjectWorkload } from "@/server/utils/shared-authorization.utils";
import { UserGroupUtils } from "@/shared/utils/role.utils";
import AgentDetailClient from "./agent-detail-client";
import { CatchUtils } from "@/shared/utils/catch.utils";
import clusterService from "@/server/services/cluster.service";
import WorkloadBreadcrumbs from "@/components/custom/workload-breadcrumbs";

export default async function AgentDetailPage({
    params,
    searchParams,
}: {
    params: Promise<{ agentId: string }>;
    searchParams?: Promise<{ [key: string]: string | undefined }>;
}) {
    const resolvedParams = await params;
    const resolvedSearchParams = await searchParams;
    const session = await getAuthUserSession();
    const identity: RequesterIdentity = { type: 'session', session };
    ensureReadProjectWorkload(identity, resolvedParams.agentId);

    const agent = await agentService.getById(resolvedParams.agentId);
    const [templateDeploymentDetails, storageClasses, agents] = await Promise.all([
        CatchUtils.resultOrUndefined(() => agentService.getSandboxTemplateDeployInfo(agent.id)),
        clusterService.getStorageClasses(),
        agentService.getAllByProjectId(agent.projectId),
    ]);
    const relevantAgents = agents.filter((projectAgent) =>
        UserGroupUtils.sessionHasReadAccessForProjectWorkload(session, projectAgent.id));
    const role = UserGroupUtils.getRolePermissionForProjectWorkload(session, resolvedParams.agentId);

    return (
        <div className="flex-1 space-y-4 pt-6">
            <PageTitle
                title={agent.name}
                subtitle={`Agent · ${agent.project.name}`}
            />
            <WorkloadBreadcrumbs
                projectId={agent.projectId}
                projectName={agent.project.name}
                workloadId={agent.id}
                workloadName={agent.name}
                workloads={relevantAgents}
                workloadBasePath="/project/agent"
                queryParams={{
                    tabName: resolvedSearchParams?.tabName,
                    section: resolvedSearchParams?.section,
                }}
            />
            <AgentDetailClient
                agent={agent}
                role={role}
                templateInfo={templateDeploymentDetails ?? undefined}
                storageClasses={storageClasses}
            />
        </div>
    );
}
