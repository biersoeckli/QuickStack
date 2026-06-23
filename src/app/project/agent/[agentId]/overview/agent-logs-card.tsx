'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useEffect, useState } from "react";
import LogsStreamed from "@/components/custom/logs-streamed";
import { getPodsForAgent } from "./actions";
import { PodsInfoModel } from "@/shared/model/pods-info.model";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import FullLoadingSpinner from "@/components/ui/full-loading-spinnter";
import { toast } from "sonner";

export default function AgentLogsCard({ agentId, projectId }: { agentId: string; projectId: string }) {
    const [selectedPod, setSelectedPod] = useState<PodsInfoModel | undefined>(undefined);
    const [agentPods, setAgentPods] = useState<PodsInfoModel[] | undefined>(undefined);

    const loadPods = async () => {
        try {
            const response = await getPodsForAgent(agentId);
            if (response.status === 'success' && response.data) {
                setAgentPods(response.data as PodsInfoModel[]);
            } else {
                toast.error(response.message ?? 'Failed to load Agent pods.');
            }
        } catch (ex) {
            console.error(ex);
            toast.error('An error occurred while loading Agent pods.');
        }
    }

    useEffect(() => {
        loadPods();
        const interval = setInterval(loadPods, 10000);
        return () => clearInterval(interval);
    }, [agentId]);

    useEffect(() => {
        if (agentPods && selectedPod && !agentPods.find(p => p.podName === selectedPod.podName)) {
            setSelectedPod(undefined);
            if (agentPods.length > 0) {
                setSelectedPod(agentPods[0]);
            }
        } else if (!selectedPod && agentPods && agentPods.length > 0) {
            setSelectedPod(agentPods[0]);
        }
    }, [agentPods]);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Logs</CardTitle>
                <CardDescription>Stream logs from the running Agent container.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {!agentPods && <FullLoadingSpinner />}
                {agentPods && agentPods.length === 0 && (
                    <div className="text-sm text-muted-foreground">
                        No Agent Pod is running. Start the Agent to stream logs.
                    </div>
                )}
                {selectedPod && agentPods && (
                    <div className="flex gap-4">
                        <div className="flex-1">
                            <Select value={selectedPod.podName} onValueChange={(val) => setSelectedPod(agentPods.find(p => p.podName === val))}>
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select a pod" />
                                </SelectTrigger>
                                <SelectContent>
                                    {agentPods.map(pod => (
                                        <SelectItem key={pod.podName} value={pod.podName}>
                                            {pod.podName} ({pod.status})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                )}
                {selectedPod && (
                    <LogsStreamed
                        namespace={projectId}
                        podName={selectedPod.podName}
                        linesCount={100}
                    />
                )}
            </CardContent>
        </Card>
    );
}
