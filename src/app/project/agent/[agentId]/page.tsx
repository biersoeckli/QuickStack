'use server'

import { getAuthUserSession } from "@/server/utils/action-wrapper.utils";
import agentService from "@/server/services/agent.service";
import PageTitle from "@/components/custom/page-title";
import { RequesterIdentity, ensureReadProjectWorkload } from "@/server/utils/shared-authorization.utils";
import AgentDetailClient from "./agent-detail-client";

export default async function AgentDetailPage({
    params,
}: {
    params: { agentId: string };
}) {
    const session = await getAuthUserSession();
    const identity: RequesterIdentity = { type: 'session', session };
    ensureReadProjectWorkload(identity, params.agentId);

    const agent = await agentService.getById(params.agentId);

    return (
        <div className="flex-1 space-y-4 pt-6">
            <PageTitle
                title={agent.name}
                subtitle={`Agent · ${agent.project.name}`}
            />
            <AgentDetailClient agent={agent} />
        </div>
    );
}
