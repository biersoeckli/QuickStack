'use client';

import { ArrowDown, ArrowUp, CopyIcon, MoreHorizontal, Plus, TrashIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AppNetworkPolicyRuleWithTargetAppModel } from '@/shared/model/app-extended.model';
import { Toast } from '@/frontend/utils/toast.utils';
import { toast } from 'sonner';
import { InternalHostnameUtils } from '@/server/utils/internal-hostname.utils';
import { deleteAppNetworkPolicyRule } from './actions';

export type AppNetworkPolicyDirection = 'INGRESS' | 'EGRESS';

type AppNetworkPolicyRuleSectionProps = {
    direction: AppNetworkPolicyDirection;
    rules: AppNetworkPolicyRuleWithTargetAppModel[];
    readonly: boolean;
    onAdd: () => void;
    internetAccess?: boolean;
    onInternetAccessChange?: (checked: boolean) => void;
    networkPoliciesEnabled?: boolean;
};

export default function AppNetworkPolicyRuleSection({
    direction,
    rules,
    readonly,
    onAdd,
    internetAccess,
    onInternetAccessChange,
    networkPoliciesEnabled,
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
                                    disabled={readonly || !networkPoliciesEnabled}
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
                            {rules.length > 0 ? rules.map(rule => <RuleRow key={rule.id} rule={rule} readonly={readonly} />) : (
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

function RuleRow({ rule, readonly }: { rule: AppNetworkPolicyRuleWithTargetAppModel; readonly: boolean }) {
    const target = rule.targetAgent ?? rule.targetApp;
    const targetType = rule.targetAgent ? 'Agent sandbox' : 'App';
    const copyInternalHostname = () => {
        if (rule.targetApp) navigator.clipboard.writeText(InternalHostnameUtils.getInternalBaseUrlForApp(rule.targetApp, rule.port));
        toast.success('Copied internal hostname to clipboard');
    };

    return (
        <TableRow>
            <TableCell>
                {target?.name ?? 'Unknown target'}
                <span className="ml-2 text-muted-foreground">{target?.projectId} · {targetType}</span>
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
                            {rule.targetApp && <DropdownMenuItem onClick={copyInternalHostname}>
                                <CopyIcon /> Copy internal hostname
                            </DropdownMenuItem>}
                            <DropdownMenuItem className="text-destructive" onClick={() => Toast.fromAction(() => deleteAppNetworkPolicyRule(rule.id), 'Rule deleted.')}>
                                <TrashIcon /> Delete
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
            </TableCell>
        </TableRow>
    );
}
