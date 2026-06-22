'use server'

import { getAuthUserSession } from "@/server/utils/action-wrapper.utils";
import agentService from "@/server/services/agent.service";
import PageTitle from "@/components/custom/page-title";
import { RequesterIdentity, ensureReadProjectWorkload } from "@/server/utils/shared-authorization.utils";

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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="rounded-lg border p-6 space-y-4">
                    <h3 className="text-lg font-semibold">Details</h3>
                    <dl className="space-y-2">
                        <div>
                            <dt className="text-sm text-muted-foreground">ID</dt>
                            <dd className="text-sm font-mono">{agent.id}</dd>
                        </div>
                        <div>
                            <dt className="text-sm text-muted-foreground">LLM Gateway</dt>
                            <dd className="text-sm">{agent.llmGateway.name}</dd>
                        </div>
                        <div>
                            <dt className="text-sm text-muted-foreground">Model Alias</dt>
                            <dd className="text-sm font-mono">{agent.modelAlias}</dd>
                        </div>
                        <div>
                            <dt className="text-sm text-muted-foreground">Created</dt>
                            <dd className="text-sm">{new Date(agent.createdAt).toLocaleString()}</dd>
                        </div>
                    </dl>
                </div>
                <div className="rounded-lg border border-dashed p-6 flex items-center justify-center">
                    <div className="text-center">
                        <h3 className="text-lg font-semibold">Agent Status</h3>
                        <p className="mt-2 text-sm text-muted-foreground">
                            Agent runtime controls and status will be available in a future update.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
