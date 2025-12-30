'use client';

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useState, useTransition } from "react";
import { TraefikIpPropagationStatus } from "@/shared/model/traefik-ip-propagation.model";
import { toast } from "sonner";

import { applyTraefikIpPropagation } from "./actions";

export default function TraefikIpPropagationCard({ initialStatus }: { initialStatus: TraefikIpPropagationStatus }) {
    const [status, setStatus] = useState<TraefikIpPropagationStatus>(initialStatus);
    const [enabled, setEnabled] = useState<boolean>((initialStatus.externalTrafficPolicy ?? 'Cluster') === 'Local');
    const [isPending, startTransition] = useTransition();

    const currentEnabled = (status.externalTrafficPolicy ?? 'Cluster') === 'Local';

    const handleApply = () => {
        startTransition(async () => {
            const result = await applyTraefikIpPropagation(enabled);
            if (result.status === 'success') {
                if (result.data) {
                    setStatus(result.data);
                    setEnabled((result.data.externalTrafficPolicy ?? 'Cluster') === 'Local');
                }
                toast.success('Traefik updated', {
                    description: result.message ?? `externalTrafficPolicy set to ${enabled ? 'Local' : 'Cluster'}.`
                });
            } else {
                toast.error(result.message ?? 'Failed to update Traefik externalTrafficPolicy.');
            }
        });
    };

    const readinessText = `${status.readyReplicas ?? 0}/${status.replicas ?? 0} pods ready`;
    const lastRestart = status.restartedAt ? new Date(status.restartedAt).toLocaleString() : 'Not restarted yet';

    return (
        <Card>
            <CardHeader>
                <CardTitle>Preserve client IP</CardTitle>
                <CardDescription>
                    Toggle Traefik externalTrafficPolicy to <b>Local</b> to keep the original client IP on incoming requests.
                </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                    <div className="text-sm text-muted-foreground">{readinessText}</div>
                    <div className="text-xs text-muted-foreground">Last restart: {lastRestart}</div>
                    <div className="text-xs text-muted-foreground">
                        Local policy keeps traffic on a single node; use Cluster if you rely on cross-node load-balancing.
                    </div>
                </div>
                <div className="flex flex-col gap-2 sm:items-end">
                    <div className="flex items-center gap-3">
                        <Switch disabled={isPending} checked={enabled} onCheckedChange={setEnabled} />
                        <span className="text-sm">{enabled ? 'Local policy enabled' : 'Cluster policy enabled'}</span>
                    </div>
                    <Button onClick={handleApply} disabled={isPending}>
                        Apply
                    </Button>
                </div>
            </CardContent>
            <CardFooter>
                <p className="text-xs text-muted-foreground">
                    Local policy exposes real client IPs but may limit load-balancing flexibility.
                </p>
            </CardFooter>
        </Card>
    );
}
