'use client';

import { ArrowDown, ArrowUp, CopyIcon, MoreHorizontal, Plus, TrashIcon } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { NetworkPolicyDirection, NetworkPolicyTargetProject } from '@/shared/model/app-network-policy-edit.model';
import { InternalHostnameUtils } from '@/server/utils/internal-hostname.utils';

export type AppNetworkPolicyDirection = NetworkPolicyDirection;

export type AppNetworkPolicyRuleDraft = {
    key: string;
    persistedId?: string;
    type: AppNetworkPolicyDirection;
    targetType: 'APP' | 'AGENT';
    targetId: string;
    targetName: string;
    targetProjectId: string;
    port: number;
    protocol: 'TCP' | 'UDP';
};

type AppNetworkPolicyRuleSectionProps = {
    direction: AppNetworkPolicyDirection;
    rules: AppNetworkPolicyRuleDraft[];
    readonly: boolean;
    onAdd: () => void;
    onDeleteRule: (key: string) => void;
    currentProjectId: string;
    projects: NetworkPolicyTargetProject[];
    internetAccess?: boolean;
    onInternetAccessChange?: (checked: boolean) => void;
};

export default function AppNetworkPolicyRuleSection({
    direction,
    rules,
    readonly,
    onAdd,
    onDeleteRule,
    currentProjectId,
    projects,
    internetAccess,
    onInternetAccessChange,
}: AppNetworkPolicyRuleSectionProps) {
    const ingress = direction === 'INGRESS';
    const title = ingress ? 'Ingress rules' : 'Egress rules';
    const description = ingress ? 'Who can access this app?' : 'Which apps or agent sandboxes can this app access?';

    return (
        <section>
            <Card>
                <CardContent className="space-y-4 p-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border bg-muted">
                            {ingress ? <ArrowDown className="h-4 w-4" /> : <ArrowUp className="h-4 w-4" />}
                        </div>
                        <div>
                            <h3 className="font-semibold">{title}</h3>
                            <p className="text-sm text-muted-foreground">{description}</p>
                        </div>
                    </div>

                    {!ingress && internetAccess !== undefined && onInternetAccessChange && (
                        <Card>
                            <CardContent className="flex items-center justify-between gap-4 p-4">
                                <div>
                                    <Label>Internet Access</Label>
                                    <p className="text-sm text-muted-foreground">Allow outgoing connections to the public internet.</p>
                                </div>
                                <Switch
                                    checked={internetAccess}
                                    disabled={readonly}
                                    onCheckedChange={onInternetAccessChange}
                                />
                            </CardContent>
                        </Card>
                    )}

                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>{ingress ? 'Source' : 'Target'}</TableHead>
                                <TableHead>Port</TableHead>
                                <TableHead>Protocol</TableHead>
                                <TableHead className="w-12"><span className="sr-only">Actions</span></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {rules.length > 0 ? rules.map(rule => <RuleRow key={rule.key} rule={rule} readonly={readonly} onDelete={onDeleteRule} currentProjectId={currentProjectId} projects={projects} />) : (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-20 text-center text-muted-foreground">No rules configured.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>

                    {!readonly && <Button variant="outline" onClick={onAdd}><Plus /> Add {ingress ? 'ingress' : 'egress'} rule</Button>}
                </CardContent>
            </Card>
        </section>
    );
}

function RuleRow({ rule, readonly, onDelete, currentProjectId, projects }: {
    rule: AppNetworkPolicyRuleDraft;
    readonly: boolean;
    onDelete: (key: string) => void;
    currentProjectId: string;
    projects: NetworkPolicyTargetProject[];
}) {
    const projectName = rule.targetProjectId === currentProjectId
        ? 'This project'
        : projects.find(project => project.id === rule.targetProjectId)?.name ?? 'Unknown project';
    const targetTypeLabel = rule.targetType === 'AGENT' ? 'Agent sandbox' : 'App';
    const copyInternalHostname = () => {
        if (rule.targetType !== 'APP') return;
        navigator.clipboard.writeText(InternalHostnameUtils.getInternalBaseUrlForApp({ id: rule.targetId, projectId: rule.targetProjectId }, rule.port));
        toast.success('Copied internal hostname to clipboard');
    };

    return (
        <TableRow>
            <TableCell>

                {rule.targetType === 'APP'
                    ? <Link href={`/project/app/${rule.targetId}`} className="underline-offset-4 hover:underline">{rule.targetName}</Link>
                    : rule.targetName}
                <span className="ml-2 text-muted-foreground">
                    {projectName} · {targetTypeLabel}
                </span>
            </TableCell>
            <TableCell>{rule.port}</TableCell>
            <TableCell>{rule.protocol}</TableCell>
            <TableCell>
                {!readonly && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                                <MoreHorizontal />
                                <span className="sr-only">Rule actions</span>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            {rule.targetType === 'APP' && <DropdownMenuItem onClick={copyInternalHostname}>
                                <CopyIcon /> Copy internal hostname
                            </DropdownMenuItem>}
                            <DropdownMenuItem className="text-destructive" onClick={() => onDelete(rule.key)}>
                                <TrashIcon /> Delete
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
            </TableCell>
        </TableRow>
    );
}
