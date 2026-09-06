'use client';

import { useEffect, useState } from 'react';
import { Info } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AppExtendedModel } from '@/shared/model/app-extended.model';
import { Toast } from '@/frontend/utils/toast.utils';
import { getTargetsForAppNetworkPolicy, saveAppNetworkPolicySettings } from './actions';
import { useDialog } from '@/frontend/states/zustand.states';
import AppNetworkPolicyRuleDialog from './app-network-policy-rule-dialog';
import AppNetworkPolicyRuleSection, { AppNetworkPolicyDirection } from './app-network-policy-rule-section';

type Project = { id: string; name: string; apps: { id: string; name: string }[]; agents: { id: string; name: string }[] };

export default function NetworkPolicy({ app, readonly }: { app: AppExtendedModel; readonly: boolean }) {
    const [enabled, setEnabled] = useState(app.useNetworkPolicy);
    const [internet, setInternet] = useState(app.appNetworkPolicy?.allowInternetAccess !== false);
    const [projects, setProjects] = useState<Project[]>([]);
    const { openDialog } = useDialog();
    const rules = app.appNetworkPolicy?.rules ?? [];
    const targets = projects.flatMap(project => [
        ...project.apps.map(item => ({ ...item, type: 'APP' as const, project })),
        ...project.agents.map(item => ({ ...item, type: 'AGENT' as const, project })),
    ]);

    useEffect(() => {
        getTargetsForAppNetworkPolicy(app.id).then(result => result.status === 'success' && setProjects(result.data ?? []));
    }, [app.id]);

    const saveSettings = (nextEnabled: boolean, nextInternet: boolean) =>
        Toast.fromAction(() => saveAppNetworkPolicySettings(undefined, { mode: 'EXTENDED', useNetworkPolicy: nextEnabled, allowInternetAccess: nextInternet }, app.id), 'Network policy saved.');

    const saveChanges = async () => {
        await saveSettings(enabled, internet);
    };

    const changeNetworkPoliciesEnabled = (nextEnabled: boolean) => {
        setEnabled(nextEnabled);
        saveSettings(nextEnabled, internet);
    };

    const changeInternetAccess = (nextInternet: boolean) => {
        setInternet(nextInternet);
    };

    const openRuleDialog = (direction: AppNetworkPolicyDirection) => openDialog(<AppNetworkPolicyRuleDialog appId={app.id} direction={direction} targets={targets} currentProject={app.project} />, { maxWidth: 'max-w-md' });

    return <Card>
        <CardHeader><CardTitle>Network Policy</CardTitle><CardDescription>Control which traffic can reach this app and where it can connect.</CardDescription></CardHeader>
        <CardContent className="space-y-6">
            <Card>
                <CardContent className="space-y-4 p-4">
                    <SettingRow label="Network Policies" description="Apply traffic restrictions to this app." checked={enabled} disabled={readonly} onChange={changeNetworkPoliciesEnabled} />
                </CardContent>
            </Card>

            {enabled && <div className="space-y-8">
                <AppNetworkPolicyRuleSection direction="INGRESS" rules={rules.filter(rule => rule.type === 'INGRESS')} readonly={readonly} onAdd={() => openRuleDialog('INGRESS')} />
                <AppNetworkPolicyRuleSection direction="EGRESS" rules={rules.filter(rule => rule.type === 'EGRESS')} readonly={readonly} onAdd={() => openRuleDialog('EGRESS')} internetAccess={internet} onInternetAccessChange={changeInternetAccess} networkPoliciesEnabled={enabled} />
            </div>}
        </CardContent>
        {!readonly && enabled && <CardFooter className="flex items-center justify-between gap-4 border-t pt-6">
            <Button onClick={saveChanges}>Save changes</Button>
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
