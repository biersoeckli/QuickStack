'use client';

import { Button } from "@/components/ui/button";
import { DrawerCard, DrawerCardContent, DrawerCardDescription, DrawerCardFooter, DrawerCardHeader, DrawerCardTitle } from "@/components/custom/drawer-card";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useConfirmDialog, useDialog } from "@/frontend/states/zustand.states";
import { Toast } from "@/frontend/utils/toast.utils";
import { AgentExtendedModel } from "@/shared/model/agent-extended.model";
import { EditIcon, Plus, TrashIcon } from "lucide-react";
import { deleteAgentEnvVar } from "./actions";
import AgentEnvVarEditOverlay from "./agent-env-var-edit-overlay";

function getEnvironmentVariableNames(encryptedEnvVars: string | null | undefined): string[] {
    if (!encryptedEnvVars) return [];
    try {
        const parsed = JSON.parse(encryptedEnvVars) as Array<{ name?: unknown }>;
        return parsed.flatMap((envVar) => typeof envVar.name === 'string' ? [envVar.name] : []);
    } catch {
        return [];
    }
}

export default function AgentEnvVarsCard({ agent, readonly }: { agent: AgentExtendedModel; readonly: boolean }) {
    const { openConfirmDialog } = useConfirmDialog();
    const { openDialog } = useDialog();
    const environmentVariableNames = getEnvironmentVariableNames(agent.encryptedEnvVars);

    const openEditDialog = async (name?: string) => {
        await openDialog(<AgentEnvVarEditOverlay agentId={agent.id} existingName={name} />, { maxWidth: 'max-w-md' });
    };
    const deleteEnvironmentVariable = async (name: string) => {
        const confirmed = await openConfirmDialog({
            title: 'Delete Environment Variable',
            description: `Remove ${name}? This takes effect after deploying the agent.`,
            okButton: 'Delete Environment Variable',
        });
        if (confirmed) await Toast.fromAction(() => deleteAgentEnvVar(agent.id, name), 'Deleted Env Variable Successfully');
    };

    return (
        <DrawerCard>
            <DrawerCardHeader>
                <DrawerCardTitle>Environment Variables</DrawerCardTitle>
                <DrawerCardDescription>
                    Values are encrypted at rest and never shown. Names starting with <code className="rounded bg-muted px-1 text-xs">QS_</code> are reserved by QuickStack.
                </DrawerCardDescription>
            </DrawerCardHeader>
            {environmentVariableNames.length > 0 &&
                <DrawerCardContent>
                    <Table>
                        <TableCaption>{environmentVariableNames.length} Environment Variables</TableCaption>
                        <TableHeader><TableRow>
                            <TableHead>Key</TableHead>
                            {!readonly && <TableHead className="w-[88px]"></TableHead>}
                        </TableRow></TableHeader>
                        <TableBody>
                            {environmentVariableNames.map((name) => <TableRow key={name} className="group transition-colors duration-150 hover:bg-muted/30">
                                <TableCell className="font-medium">{name}</TableCell>
                                {!readonly && <TableCell className="w-[88px] font-medium">
                                    <div className="flex gap-1 opacity-100 transition-opacity duration-150 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(name)}><EditIcon /></Button>
                                        <Button variant="ghost" size="icon" className="hover:text-destructive" onClick={() => deleteEnvironmentVariable(name)}><TrashIcon /></Button>
                                    </div>
                                </TableCell>}
                            </TableRow>)}
                        </TableBody>
                    </Table>
                </DrawerCardContent>}
            {!readonly && <DrawerCardFooter><Button variant="outline" onClick={() => openEditDialog()}><Plus /> Add Environment Variable</Button></DrawerCardFooter>}
        </DrawerCard>
    );
}
