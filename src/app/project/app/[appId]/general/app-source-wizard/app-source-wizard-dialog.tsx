'use client';

import { Button } from "@/components/ui/button";
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useDialogContext } from "@/frontend/states/dialog-context";
import { useConfirmDialog } from "@/frontend/states/zustand.states";
import { Actions } from "@/frontend/utils/nextjs-actions.utils";
import { Toast } from "@/frontend/utils/toast.utils";
import { AppExtendedModel } from "@/shared/model/app-extended.model";
import { AppBuildMethod, AppDockerfileDetectionModel, AppGitBranchesLookupModel, AppSourceInfoInputModel } from "@/shared/model/app-source-info.model";
import { ChevronLeft, Loader2, Rocket, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { detectDockerfilePath, ensureGitSshPublicKey, generateOrRegenerateGitSshKey, getGitBranches, saveGeneralAppSourceInfo } from "../actions";
import { BuildMethodStep } from "./build-method-step";
import { ContainerImageStep } from "./container-image-step";
import { DockerfilePathStep } from "./dockerfile-path-step";
import { GitBranchStep } from "./git-branch-step";
import { GitHttpsUrlStep } from "./git-https-url-step";
import { GitSshUrlStep } from "./git-ssh-url-step";
import { SourceSummaryStep } from "./source-summary-step";
import { SourceTypeStep } from "./source-type-step";
import { defaultDockerfilePath, sourceTypeLabels, SourceType, StepId } from "./types";
import { WizardProgress } from "./wizard-progress";
import { deploy } from "../../actions";

export function AppSourceWizardDialog({ app, gitSshPublicKey }: {
    app: AppExtendedModel;
    gitSshPublicKey?: string;
}) {
    const router = useRouter();
    const { closeDialog } = useDialogContext();
    const { openConfirmDialog } = useConfirmDialog();
    const [step, setStep] = useState<StepId>('source');
    const [history, setHistory] = useState<StepId[]>([]);
    const [formData, setFormData] = useState<AppSourceInfoInputModel>(() => toSourceInput(app));
    const [publicKey, setPublicKey] = useState(gitSshPublicKey);
    const [branches, setBranches] = useState<string[]>([]);
    const [isLoadingBranches, setIsLoadingBranches] = useState(false);
    const [branchError, setBranchError] = useState<string | null>(null);
    const [isEnsuringKey, setIsEnsuringKey] = useState(false);
    const [isDetectingDockerfile, setIsDetectingDockerfile] = useState(false);
    const [showGitToken, setShowGitToken] = useState(false);
    const [showRegistryPassword, setShowRegistryPassword] = useState(false);

    const canUseGitSources = app.appType === 'APP';
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
        if (!previous) {
            return;
        }
        setHistory((items) => items.slice(0, -1));
        setStep(previous);
    };

    const updateFormData = (patch: Partial<AppSourceInfoInputModel>) => {
        setFormData((current) => ({ ...current, ...patch }));
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

        const inputData: AppGitBranchesLookupModel = formData.sourceType === 'GIT'
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
            const result = await Actions.run(() => getGitBranches(app.id, inputData));
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
        if (!formData.gitUrl?.trim() || publicKey || isEnsuringKey) {
            return;
        }
        setIsEnsuringKey(true);
        try {
            const key = await Actions.run(() => ensureGitSshPublicKey(app.id));
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
            description: "This replaces the current app SSH key. Update the deploy key in your Git provider before deploying again.",
            okButton: "Regenerate",
        });
        if (!confirmed) {
            return;
        }
        const key = await Actions.run(() => generateOrRegenerateGitSshKey(app.id));
        setPublicKey(key);
        toast.success('Deploy key regenerated.');
    };

    const copyPublicKey = () => {
        if (!publicKey) {
            return;
        }
        navigator.clipboard.writeText(publicKey);
        toast.success('Copied to clipboard.');
    };

    const runDockerfileDetection = async () => {
        if (!isGitSource || !formData.gitUrl || !formData.gitBranch) {
            return;
        }

        const inputData: AppDockerfileDetectionModel = formData.sourceType === 'GIT'
            ? {
                sourceType: 'GIT',
                gitUrl: formData.gitUrl,
                gitBranch: formData.gitBranch,
                gitUsername: formData.gitUsername,
                gitToken: formData.gitToken,
            }
            : {
                sourceType: 'GIT_SSH',
                gitUrl: formData.gitUrl,
                gitBranch: formData.gitBranch,
            };

        setIsDetectingDockerfile(true);
        try {
            const dockerfilePath = await Actions.run(() => detectDockerfilePath(app.id, inputData));
            updateFormData({ dockerfilePath: dockerfilePath || defaultDockerfilePath });
        } finally {
            setIsDetectingDockerfile(false);
        }
    };

    const selectGitBranch = (gitBranch: string) => {
        updateFormData({ gitBranch });
        goTo('build-method');
    };

    const selectBuildMethod = async (buildMethod: AppBuildMethod) => {
        updateFormData({ buildMethod });
        if (buildMethod === 'DOCKERFILE') {
            goTo('dockerfile');
            await runDockerfileDetection();
            return;
        }
        goTo('summary');
    };

    const next = async () => {
        if (step === 'source') {
            goTo(formData.sourceType === 'GIT' ? 'git-url' : formData.sourceType === 'GIT_SSH' ? 'ssh-url' : 'container-image');
            return;
        }
        if (step === 'git-url') {
            if (await loadBranches()) {
                goTo('branch');
            }
            return;
        }
        if (step === 'ssh-url') {
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
        await Toast.fromAction(() => saveGeneralAppSourceInfo(null, formData, app.id), 'Source saved', 'Saving source...');
        if (deployAfterSave) {
            await Toast.fromAction(() => deploy(app.id, true), 'Deployment started', 'Staring deployment...');
            closeDialog(true);
            router.refresh();
            router.push(`/project/app/${app.id}?tabName=overview`);
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
                    {step === 'summary' ? 'Review the app source before saving.' : 'Connect a source with the details QuickStack needs to deploy this app.'}
                </DialogDescription>
            </DialogHeader>

            <div className="space-y-5">
                <WizardProgress step={step} formData={formData} />
                {step === 'source' && (
                    <SourceTypeStep
                        value={formData.sourceType as SourceType}
                        canUseGitSources={canUseGitSources}
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
                {step === 'build-method' && (
                    <BuildMethodStep
                        value={(formData.buildMethod as AppBuildMethod | undefined) ?? 'RAILPACK'}
                        onChange={selectBuildMethod}
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
                        ) : step === 'branch' || step === 'build-method' ? (
                            null
                        ) : (
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

function getStepTitle(step: StepId, sourceType: AppSourceInfoInputModel['sourceType']) {
    if (step === 'source') return 'Choose source';
    if (step === 'git-url') return 'Connect Git HTTPS';
    if (step === 'ssh-url') return 'Connect Git SSH';
    if (step === 'branch') return 'Choose Git Branch';
    if (step === 'build-method') return 'Choose Build Method';
    if (step === 'dockerfile') return 'Confirm Dockerfile Path';
    if (step === 'container-image') return 'Connect Docker Container Image';
    if (step === 'summary') return `${sourceTypeLabels[sourceType as SourceType]} Summary`;
    return 'Connect App Source';
}

function getNextDisabled(step: StepId, formData: AppSourceInfoInputModel, publicKey: string | undefined, isLoadingBranches: boolean, isEnsuringKey: boolean, isDetectingDockerfile: boolean) {
    if (isLoadingBranches || isEnsuringKey || isDetectingDockerfile) return true;
    if (step === 'git-url') return !formData.gitUrl?.trim();
    if (step === 'ssh-url') return !formData.gitUrl?.trim() || !publicKey;
    if (step === 'branch') return !formData.gitBranch;
    if (step === 'dockerfile') return !formData.dockerfilePath?.trim();
    if (step === 'container-image') return !formData.containerImageSource?.trim();
    return false;
}

function resetForSourceType(current: AppSourceInfoInputModel, sourceType: SourceType): AppSourceInfoInputModel {
    if (sourceType === current.sourceType) {
        return current;
    }
    if (sourceType === 'GIT') {
        return {
            sourceType,
            buildMethod: 'RAILPACK',
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
            buildMethod: 'RAILPACK',
            gitUrl: '',
            gitBranch: '',
            dockerfilePath: defaultDockerfilePath,
        };
    }
    return {
        sourceType,
        buildMethod: 'RAILPACK',
        containerImageSource: '',
        containerRegistryUsername: '',
        containerRegistryPassword: '',
        dockerfilePath: defaultDockerfilePath,
    };
}

function toSourceInput(app: AppExtendedModel): AppSourceInfoInputModel {
    const sourceType = app.appType === 'APP'
        ? app.sourceType as SourceType
        : 'CONTAINER';
    return {
        sourceType,
        buildMethod: (app.buildMethod as AppBuildMethod | undefined) ?? 'RAILPACK',
        containerImageSource: app.containerImageSource ?? '',
        containerRegistryUsername: app.containerRegistryUsername ?? '',
        containerRegistryPassword: app.containerRegistryPassword ?? '',
        gitUrl: app.gitUrl ?? '',
        gitBranch: app.gitBranch ?? '',
        gitUsername: app.gitUsername ?? '',
        gitToken: app.gitToken ?? '',
        dockerfilePath: app.dockerfilePath ?? defaultDockerfilePath,
    };
}
