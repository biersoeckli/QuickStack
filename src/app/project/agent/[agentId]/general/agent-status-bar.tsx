'use client';

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Rocket, Trash2 } from "lucide-react";
import { Toast } from "@/frontend/utils/toast.utils";
import { Actions } from "@/frontend/utils/nextjs-actions.utils";
import { useConfirmDialog } from "@/frontend/states/zustand.states";
import { getInstances } from "../instances/actions";
import { deployAgent, deleteAgent } from "../overview/actions";
import { AgentWithRelationsModel } from "@/shared/model/agent-extended.model";
import { AgentSanboxTemplateInfo } from "@/shared/model/agent-sandbox-template-info.model";
import { formatDateTime } from "@/frontend/utils/format.utils";

export default function AgentStatusBar({
    agent,
    readonly,
    templateInfo
}: {
    agent: AgentWithRelationsModel;
    templateInfo: AgentSanboxTemplateInfo;
    readonly: boolean;
}) {
    const router = useRouter();
    const { openConfirmDialog } = useConfirmDialog();

    const [instanceCount, setInstanceCount] = useState(0);
    const [runningCount, setRunningCount] = useState(0);
    const [loading, setLoading] = useState(false);

    const fetchStatus = useCallback(async () => {
        try {
            const instances = await Actions.run(() => getInstances(agent.id));
            setInstanceCount(instances.length);
            setRunningCount(instances.filter((i: any) => i.status === 'DEPLOYED').length);
        } catch {
            // silently ignore polling errors
        }
    }, [agent]);

    useEffect(() => {
        fetchStatus();
        const interval = setInterval(fetchStatus, 5000);
        return () => clearInterval(interval);
    }, [fetchStatus]);

    const handleDeploy = async () => {
        try {
            await Toast.fromAction(
                () => deployAgent(agent.id),
                'Configuration deployed',
                'Deploying configuration...',
            );
        } finally {
            fetchStatus();
        }
    };

    const handleDelete = async () => {
        const confirmed = await openConfirmDialog({
            title: "Delete Agent",
            description: "Are you sure you want to delete this agent? All runtime resources, sandbox definitions, and credentials will be removed. This action cannot be undone.",
            okButton: "Delete Agent",
        });
        if (confirmed) {
            await Toast.fromAction(
                () => deleteAgent(agent.id),
                'Agent deleted successfully.',
                'Deleting Agent...',
            );
            router.push(`/project/${agent.projectId}`);
        }
    };

    if (readonly) {
        return null;
    }

    const hasInstances = instanceCount > 0;

    return (
        <div className="flex items-center justify-between gap-4 px-4 py-3 rounded-lg border bg-muted/30">
            <div className="flex items-center gap-3">
                <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${hasInstances ? "text-green-600 bg-green-50" : "text-gray-500 bg-gray-100"
                        }`}
                >
                    {hasInstances ? `${runningCount}/${instanceCount} running` : "No instances"}
                </span>
                <span className="text-sm text-muted-foreground">
                    Last Deployment: {formatDateTime(templateInfo.lastDeployedAt) || 'not deloyed yet'}</span>
            </div>
            <div className="flex items-center gap-2">
                <Button onClick={handleDeploy} disabled={loading} size="sm">
                    <Rocket className="h-4 w-4 mr-1" />
                    Deploy Configuration
                </Button>
                <Button onClick={handleDelete} disabled={loading} variant="destructive" size="sm">
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete
                </Button>
            </div>
        </div>
    );
}
