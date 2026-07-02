'use client';

import { Button } from "@/components/ui/button";
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useDialogContext } from "@/frontend/states/dialog-context";
import { useConfirmDialog } from "@/frontend/states/zustand.states";
import { Actions } from "@/frontend/utils/nextjs-actions.utils";
import { Toast } from "@/frontend/utils/toast.utils";
import { AgentExtendedModel } from "@/shared/model/agent-extended.model";
import { AgentDockerfileDetectionModel, AgentGitBranchesLookupModel, AgentSourceInfoInputModel } from "@/shared/model/agent-config.model";
import { ChevronLeft, Loader2, Rocket, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
    detectAgentDockerfilePath,
    ensureAgentGitSshPublicKey,
    generateOrRegenerateAgentGitSshKey,
    getAgentGitBranches,
    saveAgentSource,
} from "./actions";
import { deployAgent } from "../overview/actions";
import { ContainerImageStep } from "@/app/project/app/[appId]/general/app-source-wizard/container-image-step";
import { DockerfilePathStep } from "@/app/project/app/[appId]/general/app-source-wizard/dockerfile-path-step";
import { GitBranchStep } from "@/app/project/app/[appId]/general/app-source-wizard/git-branch-step";
import { GitHttpsUrlStep } from "@/app/project/app/[appId]/general/app-source-wizard/git-https-url-step";
import { GitSshUrlStep } from "@/app/project/app/[appId]/general/app-source-wizard/git-ssh-url-step";
import { SourceSummaryStep } from "@/app/project/app/[appId]/general/app-source-wizard/source-summary-step";
import { SourceTypeStep } from "@/app/project/app/[appId]/general/app-source-wizard/source-type-step";
import { defaultDockerfilePath, SourceFormPatch, sourceTypeLabels, SourceType, StepId } from "@/app/project/app/[appId]/general/app-source-wizard/types";
import { WizardProgress } from "@/app/project/app/[appId]/general/app-source-wizard/wizard-progress";

export function AgentSourceWizardDialog({ agent, gitSshPublicKey }: {
    agent: AgentExtendedModel;
    gitSshPublicKey?: string;
}) {
    const router = useRouter();
    const { closeDialog } = useDialogContext();
    const { openConfirmDialog } = useConfirmDialog();
    const [step, setStep] = useState<StepId>('source');
    const [history, setHistory] = useState<StepId[]>([]);
    const [formData, setFormData] = useState<AgentSourceInfoInputModel>(() => toSourceInput(agent));
    const [publicKey, setPublicKey] = useState(gitSshPublicKey);
    const [branches, setBranches] = useState<string[]>([]);
    const [isLoadingBranches, setIsLoadingBranches] = useState(false);
    const [branchError, setBranchError] = useState<string | null>(null);
    const [isEnsuringKey, setIsEnsuringKey] = useState(false);
    const [isDetectingDockerfile, setIsDetectingDockerfile] = useState(false);
    const [showGitToken, setShowGitToken] = useState(false);
    const [showRegistryPassword, setShowRegistryPassword] = useState(false);

    const isGitSource = formData.sourceType === 'GIT' || formData.sourceType === 'GIT_SSH';
    const showGitCredentials = formData.sourceType === 'GIT' && !!formData.gitUrl?.trim();
    const showRegistryCredentials = formData.sourceType === 'CONTAINER' && !!formData.containerImageSource?.trim();
    const currentTitle = getStepTitle(step, formData.sourceType);

    const goTo = (nextStep: StepId) => {
        setHistory((items) => [...items, step]);
        setStep(nextStep);
    };

    const goBack = () => {
        const previous = history[history.length - 1];
        if (!previous) return;
        setHistory((items) => items.slice(0, -1));
        setStep(previous);
    };

    const updateFormData = (patch: SourceFormPatch) => {
        setFormData((current) => ({ ...current, ...patch, buildMethod: 'DOCKERFILE' }));
    };

    const chooseSourceType = (sourceType: SourceType) => {
        setBranches([]);
        setBranchError(null);
        setFormData((current) => resetForSourceType(current, sourceType));
    };

    const loadBranches = async () => {
        if (!formData.gitUrl?.trim()) {
            setBranchError('Enter a Git repository URL first.');
            return false;
        }

        const inputData: AgentGitBranchesLookupModel = formData.sourceType === 'GIT'
            ? {
                sourceType: 'GIT',
                gitUrl: formData.gitUrl,
                gitUsername: formData.gitUsername,
                gitToken: formData.gitToken,
            }
            : {
                sourceType: 'GIT_SSH',
                gitUrl: formData.gitUrl,
            };

        setIsLoadingBranches(true);
        setBranchError(null);
        try {
            const result = await Actions.run(() => getAgentGitBranches(agent.id, inputData));
            setBranches(result ?? []);
            if (formData.gitBranch && !result?.includes(formData.gitBranch)) {
                updateFormData({ gitBranch: '' });
            }
            return true;
        } catch (error) {
            setBranches([]);
            setBranchError(error instanceof Error ? error.message : 'Branches could not be loaded.');
            return false;
        } finally {
            setIsLoadingBranches(false);
        }
    };

    const ensureSshKey = async () => {
        if (!formData.gitUrl?.trim() || publicKey || isEnsuringKey) return;
        setIsEnsuringKey(true);
        try {
            const key = await Actions.run(() => ensureAgentGitSshPublicKey(agent.id));
            setPublicKey(key);
        } finally {
            setIsEnsuringKey(false);
        }
    };

    useEffect(() => {
        if (step === 'ssh-url') {
            ensureSshKey();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [step, formData.gitUrl, publicKey]);

    const regenerateKey = async () => {
        const confirmed = await openConfirmDialog({
            title: "Regenerate Deploy Key",
            description: "This replaces the current agent SSH key. Update the deploy key in your Git provider before deploying again.",
            okButton: "Regenerate",
        });
        if (!confirmed) return;
        const key = await Actions.run(() => generateOrRegenerateAgentGitSshKey(agent.id));
        setPublicKey(key);
        toast.success('Deploy key regenerated.');
    };

    const copyPublicKey = () => {
        if (!publicKey) return;
        navigator.clipboard.writeText(publicKey);
        toast.success('Copied to clipboard.');
    };

    const runDockerfileDetection = async (selectedBranch = formData.gitBranch) => {
        if (!isGitSource || !formData.gitUrl || !selectedBranch) return;

        const inputData: AgentDockerfileDetectionModel = formData.sourceType === 'GIT'
            ? {
                sourceType: 'GIT',
                gitUrl: formData.gitUrl,
                gitBranch: selectedBranch,
                gitUsername: formData.gitUsername,
                gitToken: formData.gitToken,
            }
            : {
                sourceType: 'GIT_SSH',
                gitUrl: formData.gitUrl,
                gitBranch: selectedBranch,
            };

        setIsDetectingDockerfile(true);
        try {
            const dockerfilePath = await Actions.run(() => detectAgentDockerfilePath(agent.id, inputData));
            updateFormData({ dockerfilePath: dockerfilePath || defaultDockerfilePath });
        } finally {
            setIsDetectingDockerfile(false);
        }
    };

    const selectGitBranch = async (gitBranch: string) => {
        updateFormData({ gitBranch, buildMethod: 'DOCKERFILE' });
        goTo('dockerfile');
        await runDockerfileDetection(gitBranch);
    };

    const next = async () => {
        if (step === 'source') {
            goTo(formData.sourceType === 'GIT' ? 'git-url' : formData.sourceType === 'GIT_SSH' ? 'ssh-url' : 'container-image');
            return;
        }
        if (step === 'git-url' || step === 'ssh-url') {
            if (await loadBranches()) {
                goTo('branch');
            }
            return;
        }
        if (step === 'dockerfile' || step === 'container-image') {
            goTo('summary');
        }
    };

    const save = async (deployAfterSave: boolean) => {
        await Toast.fromAction(() => saveAgentSource(null, formData, agent.id), 'Source saved', 'Saving source...');
        if (deployAfterSave) {
            await Toast.fromAction(() => deployAgent(agent.id, true), 'Deployment started', 'Starting deployment...');
            closeDialog(true);
            router.refresh();
            router.push(`/project/agent/${agent.id}?tabName=general`);
            return;
        }
        closeDialog(true);
        router.refresh();
    };

    const nextDisabled = getNextDisabled(step, formData, publicKey, isLoadingBranches, isEnsuringKey, isDetectingDockerfile);

    return (
        <>
            <DialogHeader>
                <DialogTitle>{currentTitle}</DialogTitle>
                <DialogDescription>
                    {step === 'summary' ? 'Review the agent source before saving.' : 'Connect a source with the details QuickStack needs to run this agent.'}
                </DialogDescription>
            </DialogHeader>

            <div className="space-y-5">
                <WizardProgress step={step} formData={formData} />
                {step === 'source' && (
                    <SourceTypeStep
                        value={formData.sourceType as SourceType}
                        canUseGitSources={true}
                        onChange={chooseSourceType}
                    />
                )}
                {step === 'git-url' && (
                    <GitHttpsUrlStep
                        formData={formData}
                        showCredentials={showGitCredentials}
                        showToken={showGitToken}
                        setShowToken={setShowGitToken}
                        onChange={updateFormData}
                        isLoadingBranches={isLoadingBranches}
                        branchError={branchError}
                        onRetry={loadBranches}
                    />
                )}
                {step === 'ssh-url' && (
                    <GitSshUrlStep
                        formData={formData}
                        publicKey={publicKey}
                        isEnsuringKey={isEnsuringKey}
                        isLoadingBranches={isLoadingBranches}
                        branchError={branchError}
                        onChange={updateFormData}
                        onCopy={copyPublicKey}
                        onRegenerate={regenerateKey}
                        onRetry={loadBranches}
                    />
                )}
                {step === 'branch' && (
                    <GitBranchStep
                        branches={branches}
                        selectedBranch={formData.gitBranch ?? ''}
                        onSelect={selectGitBranch}
                    />
                )}
                {step === 'dockerfile' && (
                    <DockerfilePathStep
                        value={formData.dockerfilePath ?? defaultDockerfilePath}
                        isDetecting={isDetectingDockerfile}
                        onChange={(dockerfilePath) => updateFormData({ dockerfilePath })}
                    />
                )}
                {step === 'container-image' && (
                    <ContainerImageStep
                        formData={formData}
                        showCredentials={showRegistryCredentials}
                        showPassword={showRegistryPassword}
                        setShowPassword={setShowRegistryPassword}
                        onChange={updateFormData}
                    />
                )}
                {step === 'summary' && (
                    <SourceSummaryStep
                        formData={formData}
                        publicKey={publicKey}
                        showGitToken={showGitToken}
                        setShowGitToken={setShowGitToken}
                        showRegistryPassword={showRegistryPassword}
                        setShowRegistryPassword={setShowRegistryPassword}
                    />
                )}
            </div>

            <DialogFooter>
                <div className="flex gap-2 w-full">
                    <div className="flex-1">
                        {history.length > 0 && (
                            <Button type="button" variant="outline" onClick={goBack}>
                                <ChevronLeft className="h-4 w-4" />
                                Back
                            </Button>
                        )}
                    </div>
                    <div className="grid md:grid-cols-1 gap-2">
                        {step === 'summary' ? (
                            <>
                                <Button type="button" variant="secondary" onClick={() => save(false)}>
                                    <Save className="h-4 w-4" />
                                    Save
                                </Button>
                                <Button type="button" onClick={() => save(true)}>
                                    <Rocket className="h-4 w-4" />
                                    Save & Deploy
                                </Button>
                            </>
                        ) : step === 'branch' ? null : (
                            <Button type="button" onClick={next} disabled={nextDisabled}>
                                {isLoadingBranches || isDetectingDockerfile ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                                Continue
                            </Button>
                        )}
                    </div>
                </div>
            </DialogFooter>
        </>
    );
}

function getStepTitle(step: StepId, sourceType: AgentSourceInfoInputModel['sourceType']) {
    if (step === 'source') return 'Choose source';
    if (step === 'git-url') return 'Connect Git HTTPS';
    if (step === 'ssh-url') return 'Connect Git SSH';
    if (step === 'branch') return 'Choose Git Branch';
    if (step === 'dockerfile') return 'Confirm Dockerfile Path';
    if (step === 'container-image') return 'Connect Docker Container Image';
    if (step === 'summary') return `${sourceTypeLabels[sourceType as SourceType]} Summary`;
    return 'Connect Agent Source';
}

function getNextDisabled(step: StepId, formData: AgentSourceInfoInputModel, publicKey: string | undefined, isLoadingBranches: boolean, isEnsuringKey: boolean, isDetectingDockerfile: boolean) {
    if (isLoadingBranches || isEnsuringKey || isDetectingDockerfile) return true;
    if (step === 'git-url') return !formData.gitUrl?.trim();
    if (step === 'ssh-url') return !formData.gitUrl?.trim() || !publicKey;
    if (step === 'branch') return !formData.gitBranch;
    if (step === 'dockerfile') return !formData.dockerfilePath?.trim();
    if (step === 'container-image') return !formData.containerImageSource?.trim();
    return false;
}

function resetForSourceType(current: AgentSourceInfoInputModel, sourceType: SourceType): AgentSourceInfoInputModel {
    if (sourceType === current.sourceType) return current;
    if (sourceType === 'GIT') {
        return {
            sourceType,
            buildMethod: 'DOCKERFILE',
            gitUrl: '',
            gitBranch: '',
            gitUsername: '',
            gitToken: '',
            dockerfilePath: defaultDockerfilePath,
        };
    }
    if (sourceType === 'GIT_SSH') {
        return {
            sourceType,
            buildMethod: 'DOCKERFILE',
            gitUrl: '',
            gitBranch: '',
            dockerfilePath: defaultDockerfilePath,
        };
    }
    return {
        sourceType,
        buildMethod: 'DOCKERFILE',
        containerImageSource: '',
        containerRegistryUsername: '',
        containerRegistryPassword: '',
        dockerfilePath: defaultDockerfilePath,
    };
}

function toSourceInput(agent: AgentExtendedModel): AgentSourceInfoInputModel {
    return {
        sourceType: agent.sourceType as SourceType,
        buildMethod: 'DOCKERFILE',
        containerImageSource: agent.containerImageSource ?? '',
        containerRegistryUsername: agent.containerRegistryUsername ?? '',
        containerRegistryPassword: agent.containerRegistryPassword ?? '',
        gitUrl: agent.gitUrl ?? '',
        gitBranch: agent.gitBranch ?? '',
        gitUsername: agent.gitUsername ?? '',
        gitToken: agent.gitToken ?? '',
        dockerfilePath: agent.dockerfilePath ?? defaultDockerfilePath,
    };
}
