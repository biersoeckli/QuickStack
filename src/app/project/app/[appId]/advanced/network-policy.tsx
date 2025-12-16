'use client';

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { AppExtendedModel } from "@/shared/model/app-extended.model";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { Toast } from "@/frontend/utils/toast.utils";
import { saveNetworkPolicy } from "./actions";

export default function NetworkPolicy({ app, readonly }: {
    app: AppExtendedModel;
    readonly: boolean;
}) {
    const [ingressPolicy, setIngressPolicy] = useState(app.ingressNetworkPolicy);
    const [egressPolicy, setEgressPolicy] = useState(app.egressNetworkPolicy);

    const handleSave = async () => {
        await Toast.fromAction(() => saveNetworkPolicy(app.id, ingressPolicy, egressPolicy));
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Network Policy</CardTitle>
                <CardDescription>
                    Configure network traffic rules for your application.
                    Changes will take effect after the next deployment.
                    The Default setting for an App is "Allow All" wich allows traffic to/from all apps within the same project and the internet.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="ingress">Ingress Policy (Incoming Traffic)</Label>
                        <Select
                            disabled={readonly}
                            value={ingressPolicy}
                            onValueChange={setIngressPolicy}
                        >
                            <SelectTrigger id="ingress">
                                <SelectValue placeholder="Select Ingress Policy" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALLOW_ALL">Allow All (Internet + Project Apps)</SelectItem>
                                <SelectItem value="NAMESPACE_ONLY">Project Apps Only</SelectItem>
                                <SelectItem value="DENY_ALL">Deny All</SelectItem>
                            </SelectContent>
                        </Select>
                        <p className="text-sm text-muted-foreground">
                            Controls who can connect to your pods.
                        </p>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="egress">Egress Policy (Outgoing Traffic)</Label>
                        <Select
                            disabled={readonly}
                            value={egressPolicy}
                            onValueChange={setEgressPolicy}
                        >
                            <SelectTrigger id="egress">
                                <SelectValue placeholder="Select Egress Policy" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALLOW_ALL">Allow All (Internet + Project Apps)</SelectItem>
                                <SelectItem value="NAMESPACE_ONLY">Project Apps Only</SelectItem>
                                <SelectItem value="DENY_ALL">Deny All</SelectItem>
                            </SelectContent>
                        </Select>
                        <p className="text-sm text-muted-foreground">
                            Controls where your pods can connect to.
                        </p>
                    </div>
                </div>
            </CardContent>
            {!readonly && (
                <CardFooter>
                    <Button onClick={handleSave}>Save</Button>
                </CardFooter>
            )}
        </Card>
    );
}
