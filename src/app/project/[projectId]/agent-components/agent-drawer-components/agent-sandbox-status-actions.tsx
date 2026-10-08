'use client';

import { Hammer, Rocket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { Toast } from '@/frontend/utils/toast.utils';
import { deployAgent } from './agent-actions';
import type { AgentExtendedModel } from '@/shared/model/agent-extended.model';

export function AgentSandboxStatusActions({
    agent,
    readonly,
}: {
    agent: AgentExtendedModel;
    readonly: boolean;
}) {

    if (readonly) { return null; }

    const supportsRebuild = agent.sourceType === 'GIT' || agent.sourceType === 'GIT_SSH';

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
            </div>
        </TooltipProvider>
    );
}
