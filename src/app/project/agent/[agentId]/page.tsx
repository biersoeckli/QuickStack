'use server'

import { getAuthUserSession } from "@/server/utils/action-wrapper.utils";
import agentService from "@/server/services/agent.service";
import PageTitle from "@/components/custom/page-title";
import { RequesterIdentity, ensureReadProjectWorkload } from "@/server/utils/shared-authorization.utils";
import { UserGroupUtils } from "@/shared/utils/role.utils";
import { RolePermissionEnum } from "@/shared/model/role-extended.model.ts";
import AgentDetailClient from "./agent-detail-client";

export default async function AgentDetailPage({
    params,
}: {
    params: Promise<{ agentId: string }>;
}) {
    const resolvedParams = await params;
    const session = await getAuthUserSession();
    const identity: RequesterIdentity = { type: 'session', session };
    ensureReadProjectWorkload(identity, resolvedParams.agentId);

    const agent = await agentService.getById(resolvedParams.agentId);
    const templateDeploymentDetails = await agentService.getSandboxTemplateDeployInfo(agent.id);
    const role = UserGroupUtils.getRolePermissionForProjectWorkload(session, resolvedParams.agentId);

    return (
        <div className="flex-1 space-y-4 pt-6">
            <PageTitle
                title={agent.name}
                subtitle={`Agent · ${agent.project.name}`}
            />
            <AgentDetailClient agent={agent} role={role} templateInfo={templateDeploymentDetails} />
        </div>
    );
}
