'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Info, List, Waypoints } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AppExtendedModel } from '@/shared/model/app-extended.model';
import { Toast } from '@/frontend/utils/toast.utils';
import { AppNetworkPolicyRuleEditModel, NetworkPolicySelectableTarget } from '@/shared/model/app-network-policy-edit.model';
import { NetworkPolicyRuleUtils } from '@/shared/utils/network-policy-rule.utils';
import { AppNetworkPolicyDraftUtils } from '@/shared/utils/app-network-policy-draft.utils';
import { getTargetsForAppNetworkPolicy, saveAppNetworkPolicyConfiguration } from './actions';
import { useConfirmDialog, useDialog } from '@/frontend/states/zustand.states';
import AppNetworkPolicyRuleDialog from './app-network-policy-rule-dialog';
import AppNetworkPolicyRuleSection, { AppNetworkPolicyDirection } from './app-network-policy-rule-section';
import NetworkPolicyGraph from './network-policy-graph';

type Project = { id: string; name: string; apps: { id: string; name: string; appType: AppExtendedModel['appType'] }[]; agents: { id: string; name: string }[] };

export default function NetworkPolicy({ app, readonly }: { app: AppExtendedModel; readonly: boolean }) {
    const router = useRouter();
    const [draft, setDraft] = useState(() => AppNetworkPolicyDraftUtils.fromApp(app));
    const [baseline, setBaseline] = useState(() => AppNetworkPolicyDraftUtils.fromApp(app));
    const [projects, setProjects] = useState<Project[]>([]);
    const [view, setView] = useState<'rules' | 'graph'>('rules');
    const [saving, setSaving] = useState(false);
    const { openDialog } = useDialog();
    const { openConfirmDialog } = useConfirmDialog();

    const targets: NetworkPolicySelectableTarget[] = useMemo(() => projects.flatMap(project => [
        ...project.apps.map(item => ({ ...item, type: 'APP' as const, project })),
        ...project.agents.map(item => ({ ...item, type: 'AGENT' as const, project })),
    ]), [projects]);

    useEffect(() => {
        getTargetsForAppNetworkPolicy(app.id).then(result => result.status === 'success' && setProjects(result.data ?? []));
    }, [app.id]);

    const dirty = !AppNetworkPolicyDraftUtils.equals(draft, baseline);
    const graphRules = useMemo(() => AppNetworkPolicyDraftUtils.toGraphRules(draft), [draft]);

    const saveChanges = async () => {
        const confirmed = await openConfirmDialog({
            title: 'Save & apply network policy?',
            description: 'The network policy takes effect immediately. Network policies for this app and every app it connects to will be generated and deployed directly. Rules for agents are only saved in database and need to be deployed manually.',
            okButton: 'Save & Apply',
            cancelButton: 'Cancel',
        });
        if (!confirmed) {
            return;
        }

        setSaving(true);
        try {
            await Toast.fromAction(
                () => saveAppNetworkPolicyConfiguration(undefined, AppNetworkPolicyDraftUtils.toConfiguration(draft)),
                'Network policies saved and applied.',
                'Applying network policies...',
            );
            setBaseline(draft);
            router.refresh();
        } catch {
            // error toast is shown by Toast.fromAction; draft state stays intact for retry
        } finally {
            setSaving(false);
        }
    };

    const addRule = (rule: AppNetworkPolicyRuleEditModel) => {
        const target = targets.find(item => item.type === rule.targetType && item.id === rule.targetId);
        setDraft(current => AppNetworkPolicyDraftUtils.addRule(current, rule, target));
    };

    const deleteRule = (key: string) => {
        setDraft(current => AppNetworkPolicyDraftUtils.removeRule(current, key));
    };

    const changeInternetAccess = (nextInternet: boolean) => {
        setDraft(current => ({ ...current, allowInternetAccess: nextInternet }));
    };

    const openRuleDialog = (direction: AppNetworkPolicyDirection) => openDialog(<AppNetworkPolicyRuleDialog
        direction={direction}
        targets={targets}
        currentProject={app.project}
        isDuplicate={(rule) => draft.rules.some(existing => NetworkPolicyRuleUtils.hasSameContent(
            NetworkPolicyRuleUtils.fromEditRule(existing),
            NetworkPolicyRuleUtils.fromEditRule(rule),
        ))}
        onAdd={addRule}
    />, { maxWidth: 'max-w-md' });

    return <Card>
        <CardHeader><CardTitle>Network Policy</CardTitle><CardDescription>Control which traffic can reach this app and where it can connect.</CardDescription></CardHeader>
        <CardContent className="space-y-6">
            <Card>
                <CardContent className="space-y-4 p-4">
                    <SettingRow label="Network Policies" description="Apply traffic restrictions to this app." checked={draft.useNetworkPolicy} disabled={readonly} onChange={useNetworkPolicy => setDraft(current => ({ ...current, useNetworkPolicy }))} />
                </CardContent>
            </Card>

            {draft.useNetworkPolicy && <Tabs value={view} onValueChange={(value) => setView(value as 'rules' | 'graph')}>
                <TabsList>
                    <TabsTrigger value="rules"><List className="mr-2 h-4 w-4" />Rules</TabsTrigger>
                    <TabsTrigger value="graph"><Waypoints className="mr-2 h-4 w-4" />Network Graph</TabsTrigger>
                </TabsList>
                <TabsContent value="rules" className="mt-5 space-y-8">
                    <AppNetworkPolicyRuleSection direction="INGRESS" rules={draft.rules.filter(rule => rule.type === 'INGRESS')} readonly={readonly} onAdd={() => openRuleDialog('INGRESS')} onDeleteRule={deleteRule} currentProjectId={app.project.id} projects={projects} />
                    <AppNetworkPolicyRuleSection direction="EGRESS" rules={draft.rules.filter(rule => rule.type === 'EGRESS')} readonly={readonly} onAdd={() => openRuleDialog('EGRESS')} onDeleteRule={deleteRule} currentProjectId={app.project.id} projects={projects} internetAccess={draft.allowInternetAccess} onInternetAccessChange={changeInternetAccess} />
                </TabsContent>
                <TabsContent value="graph" className="mt-5">
                    <NetworkPolicyGraph appId={app.id} appName={app.name} appProjectId={app.project.id} rules={graphRules} allowInternetAccess={draft.allowInternetAccess} domainLabels={app.appDomains.map(domain => `${domain.hostname}:${domain.port}`)} projects={projects} />
                </TabsContent>
            </Tabs>}
        </CardContent>
        {!readonly && dirty && <CardFooter className="flex items-center justify-between gap-4 border-t pt-6">
            <Button onClick={saveChanges} disabled={saving}>Save & Apply Changes</Button>
        </CardFooter>}
    </Card>;
}

function SettingRow({ label, description, checked, disabled, onChange, hint }: { label: string; description: string; checked: boolean; disabled: boolean; onChange: (checked: boolean) => void; hint?: string }) {
    return <div className="flex items-center justify-between gap-4">
        <div>
            <div className="flex items-center gap-1">
                <Label>{label}</Label>
                {hint && <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button type="button" variant="ghost" size="icon" className="h-5 w-5"><Info className="h-3.5 w-3.5" /></Button>
                        </TooltipTrigger>
                        <TooltipContent>{hint}</TooltipContent>
                    </Tooltip>
                </TooltipProvider>}
            </div>
            <p className="text-sm text-muted-foreground">{description}</p>
        </div><Switch checked={checked} disabled={disabled} onCheckedChange={onChange} />
    </div>;
}
