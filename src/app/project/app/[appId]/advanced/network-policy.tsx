'use client';

import { useEffect, useState } from 'react';
import { Info, Settings2, Waypoints } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AppExtendedModel } from '@/shared/model/app-extended.model';
import { Toast } from '@/frontend/utils/toast.utils';
import { getTargetsForAppNetworkPolicy, saveAppNetworkPolicySettings, saveNetworkPolicy } from './actions';
import { useDialog } from '@/frontend/states/zustand.states';
import AppNetworkPolicyRuleDialog from './app-network-policy-rule-dialog';
import AppNetworkPolicyRuleSection, { AppNetworkPolicyDirection } from './app-network-policy-rule-section';

type Project = { id: string; name: string; apps: { id: string; name: string }[]; agents: { id: string; name: string }[] };

export default function NetworkPolicy({ app, readonly }: { app: AppExtendedModel; readonly: boolean }) {
    const [mode, setMode] = useState(app.networkPolicyMode as 'SIMPLE' | 'EXTENDED');
    const [enabled, setEnabled] = useState(app.useNetworkPolicy);
    const [internet, setInternet] = useState(app.appNetworkPolicy?.allowInternetAccess !== false);
    const [ingress, setIngress] = useState(app.ingressNetworkPolicy);
    const [egress, setEgress] = useState(app.egressNetworkPolicy);
    const [projects, setProjects] = useState<Project[]>([]);
    const { openDialog } = useDialog();
    const rules = app.appNetworkPolicy?.rules ?? [];
    const targets = projects.flatMap(project => [
        ...project.apps.map(item => ({ ...item, type: 'APP' as const, project })),
        ...project.agents.map(item => ({ ...item, type: 'AGENT' as const, project })),
    ]);

    useEffect(() => {
        if (mode === 'EXTENDED') getTargetsForAppNetworkPolicy(app.id).then(result => result.status === 'success' && setProjects(result.data ?? []));
    }, [app.id, mode]);

    const saveSettings = (nextMode: 'SIMPLE' | 'EXTENDED', nextEnabled: boolean, nextInternet: boolean) => nextMode === 'SIMPLE'
        ? Toast.fromAction(() => saveNetworkPolicy(app.id, ingress, egress, nextEnabled), 'Network policy saved.')
        : Toast.fromAction(() => saveAppNetworkPolicySettings(undefined, { mode: nextMode, useNetworkPolicy: nextEnabled, allowInternetAccess: nextInternet }, app.id), 'Network policy saved.');

    const saveChanges = () => saveSettings(mode, enabled, internet);

    const changeMode = (nextMode: 'SIMPLE' | 'EXTENDED') => {
        setMode(nextMode);
        saveSettings(nextMode, enabled, internet);
    };

    const changeNetworkPoliciesEnabled = (nextEnabled: boolean) => {
        setEnabled(nextEnabled);
        saveSettings(mode, nextEnabled, internet);
    };

    const changeInternetAccess = (nextInternet: boolean) => {
        setInternet(nextInternet);
        saveSettings(mode, enabled, nextInternet);
    };

    const openRuleDialog = (direction: AppNetworkPolicyDirection) => openDialog(<AppNetworkPolicyRuleDialog appId={app.id} direction={direction} targets={targets} />, { maxWidth: 'max-w-md' });

    return <Card>
        <CardHeader><CardTitle>Network Policy</CardTitle><CardDescription>Control which traffic can reach this app and where it can connect.</CardDescription></CardHeader>
        <CardContent className="space-y-6">
            <Card>
                <CardContent className="space-y-4 p-4">
                    <SettingRow label="Network Policies" description="Apply traffic restrictions to this app." checked={enabled} disabled={readonly} onChange={changeNetworkPoliciesEnabled} />
                </CardContent>
            </Card>

            {enabled && <Tabs value={mode} onValueChange={(value) => changeMode(value as 'SIMPLE' | 'EXTENDED')}>
                <TabsList>
                    <TabsTrigger value="SIMPLE" disabled={readonly}><Settings2 className="mr-2 h-4 w-4" />Simple</TabsTrigger>
                    <TabsTrigger value="EXTENDED" disabled={readonly}><Waypoints className="mr-2 h-4 w-4" />Extended</TabsTrigger>
                </TabsList>
                <TabsContent value="SIMPLE" className="mt-5">
                    <div className="grid gap-4 md:grid-cols-2">
                        <PolicySelect label="Ingress" value={ingress} onChange={setIngress} disabled={readonly || !enabled} />
                        <PolicySelect label="Egress" value={egress} onChange={setEgress} disabled={readonly || !enabled} />
                    </div>
                </TabsContent>
                <TabsContent value="EXTENDED" className="mt-5 space-y-8">
                    <AppNetworkPolicyRuleSection direction="INGRESS" rules={rules.filter(rule => rule.type === 'INGRESS')} readonly={readonly} onAdd={() => openRuleDialog('INGRESS')} />
                    <AppNetworkPolicyRuleSection direction="EGRESS" rules={rules.filter(rule => rule.type === 'EGRESS')} readonly={readonly} onAdd={() => openRuleDialog('EGRESS')} internetAccess={internet} onInternetAccessChange={changeInternetAccess} networkPoliciesEnabled={enabled} />
                </TabsContent>
            </Tabs>}
        </CardContent>
        {!readonly && enabled && mode === 'SIMPLE' && <CardFooter className="flex items-center justify-between gap-4 border-t pt-6"><Button onClick={saveChanges}>Save changes</Button></CardFooter>}
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

function PolicySelect({ label, value, onChange, disabled }: { label: string; value: string; onChange: (value: string) => void; disabled: boolean }) {
    return (
        <div className="space-y-2">
            <Label>{label}</Label>
            <Select disabled={disabled} value={value} onValueChange={onChange}>
                <SelectTrigger>
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="ALLOW_ALL">Allow All</SelectItem>
                    <SelectItem value="INTERNET_ONLY">Internet Only</SelectItem>
                    <SelectItem value="NAMESPACE_ONLY">Project Apps Only</SelectItem>
                    <SelectItem value="DENY_ALL">Deny All</SelectItem>
                </SelectContent>
            </Select>
        </div>
    );
}
