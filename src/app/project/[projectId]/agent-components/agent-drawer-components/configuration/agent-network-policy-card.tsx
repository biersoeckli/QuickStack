'use client';

import { DrawerCard, DrawerCardContent, DrawerCardDescription, DrawerCardFooter, DrawerCardHeader, DrawerCardTitle } from "@/components/custom/drawer-card";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { CopyIcon, EditIcon, Plus, TrashIcon } from "lucide-react";
import { toast } from "sonner";
import { Toast } from "@/frontend/utils/toast.utils";
import { useConfirmDialog, useDialog } from "@/frontend/states/zustand.states";
import { useState } from "react";
import { AgentExtendedModel } from "@/shared/model/agent-extended.model";
import { deleteAgentNetworkPolicyEgressRule, saveAgentNetworkPolicySettings } from "./actions";
import AgentNetworkPolicyEgressRuleEditOverlay from "./agent-network-policy-egress-rule-edit-overlay";
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { InternalHostnameUtils } from "@/shared/utils/internal-hostname.utils";

type AgentNetworkPolicyRule = NonNullable<AgentExtendedModel['agentNetworkPolicy']>['rules'][number];

export default function AgentNetworkPolicyCard({ agent, readonly }: {
    agent: AgentExtendedModel;
    readonly: boolean;
}) {
    const { openConfirmDialog } = useConfirmDialog();
    const { openDialog } = useDialog();
    const rules = agent.agentNetworkPolicy?.rules ?? [];
    const [allowInternetAccess, setAllowInternetAccess] = useState(agent.agentNetworkPolicy?.allowInternetAccess !== false);

    const handleAllowInternetAccessChange = async (checked: boolean) => {
        setAllowInternetAccess(checked);
        try {
            await Toast.fromAction(() => saveAgentNetworkPolicySettings(
                undefined,
                { allowInternetAccess: checked },
                agent.id,
            ), 'Successfully updated internet access setting.');
        } catch {
            setAllowInternetAccess(!checked);
        }
    };

    const asyncDeleteRule = async (ruleId: string) => {
        const confirm = await openConfirmDialog({
            title: "Delete Egress Rule",
            description: "The egress rule will be removed. Are you sure you want to delete this rule?",
            okButton: "Delete Rule",
        });
        if (confirm) {
            await Toast.fromAction(() => deleteAgentNetworkPolicyEgressRule(ruleId));
        }
    };

    const openEditRuleDialog = async (rule?: AgentNetworkPolicyRule) => {
        await openDialog(<AgentNetworkPolicyEgressRuleEditOverlay
            existingRule={rule}
            agentId={agent.id} />, {
            maxWidth: 'max-w-xl',
        });
    };

    const copyInternalHostname = (rule: AgentNetworkPolicyRule) => {
        const internalHostname = InternalHostnameUtils.getInternalBaseUrlForApp(rule.targetApp, rule.port);
        navigator.clipboard.writeText(internalHostname);
        toast.success('Copied internal hostname to clipboard');
    };

    return <>
        <DrawerCard>
            <DrawerCardHeader>
                <DrawerCardTitle>Network Policy</DrawerCardTitle>
                <DrawerCardDescription>
                    Control whether this agent has general internet access and define specific egress rules to other apps.
                </DrawerCardDescription>
            </DrawerCardHeader>
            <DrawerCardContent className="space-y-4">
                <div className="flex items-center justify-between space-x-2 p-4 border rounded-lg">
                    <div className="space-y-0.5">
                        <Label htmlFor="allow-internet-access">Allow internet access</Label>
                        <p className="text-sm text-muted-foreground">
                            Control whether this agent can reach the internet.
                        </p>
                    </div>
                    <Switch
                        id="allow-internet-access"
                        disabled={readonly}
                        checked={allowInternetAccess}
                        onCheckedChange={handleAllowInternetAccessChange}
                    />
                </div>

                <Table>
                    <TableCaption>{rules.length} Egress Rules</TableCaption>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Project</TableHead>
                            <TableHead>App</TableHead>
                            <TableHead>Port</TableHead>
                            <TableHead>Protocol</TableHead>
                            <TableHead className="w-[130px]">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rules.map(rule => (
                            <TableRow key={rule.id} className="group transition-colors duration-150 hover:bg-muted/30">
                                <TableCell className="font-medium">{rule.targetApp.projectId}</TableCell>
                                <TableCell className="font-medium">{rule.targetApp.name}</TableCell>
                                <TableCell className="font-medium">{rule.port}</TableCell>
                                <TableCell className="font-medium">{rule.protocol}</TableCell>
                                <TableCell className="w-[130px] font-medium">
                                    <div className="flex gap-1 opacity-100 transition-opacity duration-150 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger delay={300} render={<Button type="button" variant="ghost" size="icon" title="Copy internal hostname" onClick={() => copyInternalHostname(rule)}>
                                                    <CopyIcon />
                                                </Button>} />
                                                <TooltipContent>
                                                    <p>Copy internal hostname to clipboard</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                        {!readonly && <>
                                            <Button type="button" variant="ghost" size="icon" onClick={() => openEditRuleDialog(rule)}><EditIcon /></Button>
                                            <Button type="button" variant="ghost" size="icon" className="hover:text-destructive" onClick={() => asyncDeleteRule(rule.id)}>
                                                <TrashIcon />
                                            </Button>
                                        </>}
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </DrawerCardContent>
            {!readonly && (
                <DrawerCardFooter>
                    <Button type="button" variant="outline" onClick={() => openEditRuleDialog()}><Plus /> Add Egress Rule</Button>
                </DrawerCardFooter>
            )}
        </DrawerCard>
    </>;
}
