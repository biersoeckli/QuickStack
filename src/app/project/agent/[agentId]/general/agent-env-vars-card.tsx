'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
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
        <Card>
            <CardHeader>
                <CardTitle>Environment Variables</CardTitle>
                <CardDescription>
                    Values are encrypted at rest and never shown. Names starting with <code className="rounded bg-muted px-1 text-xs">QS_</code> are reserved by QuickStack.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableCaption>{environmentVariableNames.length} Environment Variables</TableCaption>
                    <TableHeader><TableRow>
                        <TableHead>Key</TableHead>
                        {!readonly && <TableHead className="w-[100px]">Actions</TableHead>}
                    </TableRow></TableHeader>
                    <TableBody>
                        {environmentVariableNames.map((name) => <TableRow key={name}>
                            <TableCell className="font-medium">{name}</TableCell>
                            {!readonly && <TableCell className="flex gap-2">
                                <Button variant="ghost" onClick={() => openEditDialog(name)}><EditIcon /></Button>
                                <Button variant="ghost" onClick={() => deleteEnvironmentVariable(name)}><TrashIcon /></Button>
                            </TableCell>}
                        </TableRow>)}
                    </TableBody>
                </Table>
            </CardContent>
            {!readonly && <CardFooter><Button onClick={() => openEditDialog()}><Plus /> Add Environment Variable</Button></CardFooter>}
        </Card>
    );
}
