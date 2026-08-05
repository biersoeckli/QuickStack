'use client';

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import SelectBox from "@/components/custom/multiselect-field";
import { Toast } from "@/frontend/utils/toast.utils";
import { Actions } from "@/frontend/utils/nextjs-actions.utils";
import { createAgent, getLlmGateways, getModelAliasesForGateway } from "./actions";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useDialog } from "@/frontend/states/zustand.states";
import { useDialogContext } from "@/frontend/states/dialog-context";
import { toast } from "sonner";

interface LlmGatewayOption {
    id: string;
    name: string;
}

function CreateAgentForm({ projectId }: { projectId: string }) {
    const router = useRouter();
    const { closeDialog } = useDialogContext();
    const [name, setName] = useState('');
    const [selectedGatewayId, setSelectedGatewayId] = useState('');
    const [modelAliases, setModelAliases] = useState<string[]>([]);
    const [selectedModelAliases, setSelectedModelAliases] = useState<string[]>([]);
    const [loadingGateways, setLoadingGateways] = useState(false);
    const [loadingAliases, setLoadingAliases] = useState(false);
    const [gateways, setGateways] = useState<LlmGatewayOption[]>([]);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        loadGateways();
    }, []);

    const loadGateways = async () => {
        setLoadingGateways(true);
        try {
            const result = await Actions.run(() => getLlmGateways());
            setGateways(result as LlmGatewayOption[]);
        } catch (error) {
            console.error('Failed to load LLM gateways:', error);
        } finally {
            setLoadingGateways(false);
        }
    };

    useEffect(() => {
        if (!selectedGatewayId) {
            setModelAliases([]);
            setSelectedModelAliases([]);
            return;
        }
        loadModelAliases(selectedGatewayId);
    }, [selectedGatewayId]);

    const loadModelAliases = async (gatewayId: string) => {
        setLoadingAliases(true);
        setSelectedModelAliases([]);
        try {
            const result = await Actions.run(() => getModelAliasesForGateway(gatewayId));
            setModelAliases(result as string[]);
        } catch (error) {
            toast.error('Failed to load model aliases. Please try again.');
            console.error('Failed to load model aliases:', error);
            setModelAliases([]);
        } finally {
            setLoadingAliases(false);
        }
    };

    const handleSubmit = async () => {
        if (!name.trim() || !selectedGatewayId || selectedModelAliases.length === 0) {
            return;
        }

        setSubmitting(true);
        const result = await Toast.fromAction(
            () => createAgent(name.trim(), projectId, selectedGatewayId, selectedModelAliases),
            'Agent created'
        );

        if (result.status === 'success') {
            closeDialog();
            router.push(`/project/agent/${result.data!.id}`);
        }
        setSubmitting(false);
    };

    const canSubmit = name.trim() && selectedGatewayId && selectedModelAliases.length > 0 && !submitting;

    return (
        <>
            <DialogHeader>
                <DialogTitle>Create Agent</DialogTitle>
                <DialogDescription>
                    Create a new Agent in this project. You need an LLM Gateway and a model alias.
                </DialogDescription>
            </DialogHeader>
            <div className="grid gap-5 py-4">
                <div className="grid gap-2">
                    <Label htmlFor="agent-name">Agent Name</Label>
                    <Input
                        id="agent-name"
                        placeholder="Enter agent name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                    />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="llm-gateway">LLM Gateway</Label>
                    {loadingGateways ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" /> Loading gateways...
                        </div>
                    ) : gateways.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            No LLM Gateways configured. Add one in Settings.
                        </p>
                    ) : (
                        <Select value={selectedGatewayId} onValueChange={setSelectedGatewayId}>
                            <SelectTrigger id="llm-gateway">
                                <SelectValue placeholder="Select an LLM Gateway" />
                            </SelectTrigger>
                            <SelectContent>
                                {gateways.map((gw) => (
                                    <SelectItem key={gw.id} value={gw.id}>
                                        {gw.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="model-alias">Model Alias</Label>
                    {!selectedGatewayId ? (
                        <p className="text-sm text-muted-foreground">Select a gateway first</p>
                    ) : loadingAliases ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" /> Loading model aliases...
                        </div>
                    ) : modelAliases.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No model aliases available</p>
                    ) : (
                        <SelectBox
                            multiple
                            value={selectedModelAliases}
                            onChange={(value) => setSelectedModelAliases(Array.isArray(value) ? value : [])}
                            options={modelAliases.map((alias) => ({ value: alias, label: alias }))}
                            placeholder="Select model aliases"
                            inputPlaceholder="Search model aliases..."
                            emptyPlaceholder="No model aliases found."
                        />
                    )}
                </div>
            </div>
            <DialogFooter>
                <Button onClick={handleSubmit} disabled={!canSubmit}>
                    {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create Agent
                </Button>
                <Button variant="outline" onClick={() => closeDialog()}>
                    Cancel
                </Button>
            </DialogFooter>
        </>
    );
}

interface CreateAgentDialogProps {
    children: React.ReactNode;
    projectId: string;
}

export function CreateAgentDialog({ children, projectId }: CreateAgentDialogProps) {
    const { openDialog } = useDialog();

    const handleOpen = () => {
        openDialog(<CreateAgentForm projectId={projectId} />, { maxWidth: '480px' });
    };

    return (
        <div onClick={handleOpen}>
            {children}
        </div>
    );
}
