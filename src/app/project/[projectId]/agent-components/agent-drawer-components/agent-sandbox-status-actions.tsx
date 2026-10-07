'use client';

import { Hammer, Rocket, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useRouter } from 'next/navigation';
import { useConfirmDialog } from '@/frontend/states/zustand.states';
import { Toast } from '@/frontend/utils/toast.utils';
import { deployAgent, deleteAgent } from './agent-actions';
import type { AgentExtendedModel } from '@/shared/model/agent-extended.model';

export function AgentSandboxStatusActions({
    agent,
    readonly,
    onDeleted,
}: {
    agent: AgentExtendedModel;
    readonly: boolean;
    onDeleted?: () => void;
}) {
    const router = useRouter();
    const { openConfirmDialog } = useConfirmDialog();

    if (readonly) return null;

    const supportsRebuild = agent.sourceType === 'GIT' || agent.sourceType === 'GIT_SSH';

    const handleDelete = async () => {
        const confirmed = await openConfirmDialog({
            title: 'Delete Agent Sandbox',
            description: 'Are you sure you want to delete this Agent Sandbox? All Sandbox Instances, sandbox definitions, and credentials will be removed. This action cannot be undone.',
            okButton: 'Delete Agent Sandbox',
        });
        if (!confirmed) return;

        await Toast.fromAction(
            () => deleteAgent(agent.id),
            'Agent Sandbox deleted successfully.',
            'Deleting Agent Sandbox...',
        );
        onDeleted?.();
        router.refresh();
    };

    return (
        <TooltipProvider delay={300}>
            <div className="flex items-center gap-1 rounded-2xl bg-stone-100 px-1 py-1">
                <Tooltip>
                    <TooltipTrigger
                        render={
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => void Toast.fromAction(() => deployAgent(agent.id))}
                            >
                                <Rocket />
                                <span className="sr-only">Deploy</span>
                            </Button>
                        }
                    />
                    <TooltipContent>Deploy configuration</TooltipContent>
                </Tooltip>
                {supportsRebuild && (
                    <Tooltip>
                        <TooltipTrigger
                            render={
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon-sm"
                                    onClick={() => void Toast.fromAction(() => deployAgent(agent.id, true))}
                                >
                                    <Hammer />
                                    <span className="sr-only">Rebuild</span>
                                </Button>
                            }
                        />
                        <TooltipContent>Rebuild</TooltipContent>
                    </Tooltip>
                )}
                <Tooltip>
                    <TooltipTrigger
                        render={
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                className="hover:bg-destructive/10 hover:text-destructive"
                                onClick={() => void handleDelete()}
                            >
                                <Trash2 />
                                <span className="sr-only">Delete</span>
                            </Button>
                        }
                    />
                    <TooltipContent>Delete Agent Sandbox</TooltipContent>
                </Tooltip>
            </div>
        </TooltipProvider>
    );
}
