'use client';

import { Button } from '@/components/ui/button';
import {
    DrawerCard,
    DrawerCardContent,
    DrawerCardFooter,
    DrawerCardHeader,
    DrawerCardTitle,
} from '@/components/custom/drawer-card';
import type { AgentExtendedModel } from '@/shared/model/agent-extended.model';

export default function AgentModelConfigurationCard({
    agent,
    readonly,
    onEdit,
}: {
    agent: AgentExtendedModel;
    readonly: boolean;
    onEdit: () => void;
}) {
    return (
        <DrawerCard>
            <DrawerCardHeader>
                <DrawerCardTitle>LLM Gateway Configuration</DrawerCardTitle>
            </DrawerCardHeader>
            <DrawerCardContent className="space-y-4">
                <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">LLM Gateway</p>
                    <p className="font-medium">{agent.llmGateway.name}</p>
                </div>
                <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Model Aliases</p>
                    <p className="font-mono text-sm">
                        {agent.modelAlias.length > 0 ? agent.modelAlias.join(', ') : 'Not configured'}
                    </p>
                </div>
            </DrawerCardContent>
            {!readonly && (
                <DrawerCardFooter>
                    <Button type="button" variant="outline" onClick={onEdit}>
                        Edit model configuration
                    </Button>
                </DrawerCardFooter>
            )}
        </DrawerCard>
    );
}
