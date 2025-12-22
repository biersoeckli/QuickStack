'use client';

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { AppExtendedModel } from "@/shared/model/app-extended.model";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { Toast } from "@/frontend/utils/toast.utils";
import { saveNetworkPolicy } from "./actions";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { HelpCircle, AlertTriangle } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function NetworkPolicy({ app, readonly }: {
    app: AppExtendedModel;
    readonly: boolean;
}) {
    const [ingressPolicy, setIngressPolicy] = useState(app.ingressNetworkPolicy);
    const [egressPolicy, setEgressPolicy] = useState(app.egressNetworkPolicy);
    const [useNetworkPolicy, setUseNetworkPolicy] = useState(app.useNetworkPolicy);
    const [showHelp, setShowHelp] = useState(false);

    const handleSave = async () => {
        await Toast.fromAction(() => saveNetworkPolicy(app.id, ingressPolicy, egressPolicy, useNetworkPolicy));
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
                <div className="flex items-center justify-between space-x-2 p-4 border rounded-lg">
                    <div className="space-y-0.5">
                        <Label htmlFor="use-network-policy">Enable Network Policies</Label>
                        <p className="text-sm text-muted-foreground">
                            Control whether network policies are applied to this application
                        </p>
                    </div>
                    <Switch
                        id="use-network-policy"
                        disabled={readonly}
                        checked={useNetworkPolicy}
                        onCheckedChange={setUseNetworkPolicy}
                    />
                </div>

                {!useNetworkPolicy && (
                    <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Warning</AlertTitle>
                        <AlertDescription>
                            Disabling network policies removes all network traffic restrictions for this application.
                            This may expose your application to unauthorized access and security risks.
                            Only disable this if you fully understand the security implications.
                        </AlertDescription>
                    </Alert>
                )}

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="ingress">Ingress Policy (Incoming Traffic)</Label>
                        <Select
                            disabled={readonly || !useNetworkPolicy}
                            value={ingressPolicy}
                            onValueChange={setIngressPolicy}
                        >
                            <SelectTrigger id="ingress">
                                <SelectValue placeholder="Select Ingress Policy" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALLOW_ALL">Allow All (Internet + Project Apps)</SelectItem>
                                <SelectItem value="INTERNET_ONLY">Internet Only</SelectItem>
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
                            disabled={readonly || !useNetworkPolicy}
                            value={egressPolicy}
                            onValueChange={setEgressPolicy}
                        >
                            <SelectTrigger id="egress">
                                <SelectValue placeholder="Select Egress Policy" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALLOW_ALL">Allow All (Internet + Project Apps)</SelectItem>
                                <SelectItem value="INTERNET_ONLY">Internet Only</SelectItem>
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
                <CardFooter className="gap-3">
                    <Button onClick={handleSave}>Save</Button>
                    <Dialog open={showHelp} onOpenChange={setShowHelp}>
                        <DialogTrigger asChild>
                            <Button variant="outline" size="icon">
                                <HelpCircle className="h-4 w-4" />
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                            <DialogHeader>
                                <DialogTitle>Network Policy Types</DialogTitle>
                                <DialogDescription>
                                    Understand how each policy type controls traffic to and from your application.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <h4 className="font-semibold text-sm">Allow All (Internet + Project Apps)</h4>
                                    <p className="text-sm text-muted-foreground">
                                        Allows traffic from/to all apps within the same project and the internet.
                                        External internet traffic reaches your app through the Traefik ingress controller.
                                        Blocks traffic from/to other projects/namespaces.
                                    </p>
                                </div>
                                <div className="space-y-2">
                                    <h4 className="font-semibold text-sm">Internet Only</h4>
                                    <p className="text-sm text-muted-foreground">
                                        Allows traffic only from/to the internet (via Traefik ingress controller).
                                        Blocks all direct pod-to-pod communication within the cluster, including same-project apps.
                                        Useful for public-facing applications that should not communicate with internal services.
                                    </p>
                                </div>
                                <div className="space-y-2">
                                    <h4 className="font-semibold text-sm">Project Apps Only</h4>
                                    <p className="text-sm text-muted-foreground">
                                        Allows traffic only from/to apps within the same project.
                                        Blocks all internet traffic and traffic from other projects.
                                        Ideal for internal microservices that should only communicate within your project.
                                    </p>
                                </div>
                                <div className="space-y-2">
                                    <h4 className="font-semibold text-sm">Deny All</h4>
                                    <p className="text-sm text-muted-foreground">
                                        Blocks all incoming or outgoing traffic.
                                        Use this for maximum isolation when your application should not communicate with any other service.
                                    </p>
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>
                </CardFooter>
            )}
        </Card>
    );
}
