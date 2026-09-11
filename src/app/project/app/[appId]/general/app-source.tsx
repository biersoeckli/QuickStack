'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useDialog } from "@/frontend/states/zustand.states";
import { AppExtendedModel } from "@/shared/model/app-extended.model";
import { AppBuildMethod } from "@/shared/model/app-source-info.model";
import { Container, FileCode2, GitBranch, KeyRound, Link as LinkIcon, LockKeyhole, Package, Server } from "lucide-react";
import { AppSourceWizardDialog } from "./app-source-wizard/app-source-wizard-dialog";
import { PublicDeployKeyDialog } from "./app-source-wizard/public-deploy-key-dialog";
import { ReadonlyInfo } from "./app-source-wizard/readonly-info";
import { buildMethodLabels, defaultDockerfilePath, SourceType, sourceTypeLabels } from "./app-source-wizard/types";
import { AppSourceUtils } from "@/frontend/utils/app-source.utils";

export default function GeneralAppSource({
    app,
    readonly,
    gitSshPublicKey,
    hideCard = false
}: {
    app: AppExtendedModel;
    readonly: boolean;
    gitSshPublicKey?: string;
    hideCard?: boolean
}) {
    const { openDialog } = useDialog();
    const configured = AppSourceUtils.isConfiguredSource(app);

    const openSourceWizard = () => {
        openDialog(
            <AppSourceWizardDialog app={app} gitSshPublicKey={gitSshPublicKey} />,
            {
                width: 'calc(100vw - 2rem)',
                maxWidth: '760px',
                maxHeight: '90vh',
            }
        );
    };

    const cardContent = (
        !configured ? (
            <EmptySourceState readonly={readonly} onConnect={openSourceWizard} />
        ) : (
            <ConfiguredSourceSummary app={app} gitSshPublicKey={gitSshPublicKey} />
        )
    );

    if (hideCard) {
        return cardContent;
    }

    return (
        <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                    <CardTitle>Source</CardTitle>
                    <CardDescription>Connect the source QuickStack should build or run.</CardDescription>
                </div>
                {!readonly && configured && (
                    <Button type="button" variant="secondary" onClick={openSourceWizard}>
                        Change source
                    </Button>
                )}
            </CardHeader>
            <CardContent>
                {cardContent}
            </CardContent>
        </Card>
    );
}

function EmptySourceState({ readonly, onConnect }: { readonly: boolean; onConnect: () => void }) {
    return (
        <div className="flex min-h-40 flex-col items-center justify-center gap-4 rounded-md border border-dashed p-6 text-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-md bg-muted">
                <Server className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="space-y-1">
                <p className="font-medium">No app source connected</p>
                <p className="max-w-md text-sm text-muted-foreground">Connect a Git repository or container image before deploying this app.</p>
            </div>
            {!readonly && (
                <Button type="button" onClick={onConnect}>
                    <LinkIcon className="h-4 w-4" />
                    Connect App Source
                </Button>
            )}
        </div>
    );
}

function ConfiguredSourceSummary({ app, gitSshPublicKey }: { app: AppExtendedModel; gitSshPublicKey?: string }) {
    const { openDialog } = useDialog();
    const sourceType = app.sourceType as SourceType;
    const isGitSource = sourceType === 'GIT' || sourceType === 'GIT_SSH';
    const Icon = sourceType === 'CONTAINER' ? Container : sourceType === 'GIT_SSH' ? KeyRound : GitBranch;

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted">
                        <Icon className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                        <p className="font-medium">{sourceTypeLabels[sourceType]}</p>
                        <p className="truncate font-mono text-sm text-muted-foreground">
                            {isGitSource ? app.gitUrl : app.containerImageSource}
                        </p>
                    </div>
                </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
                {isGitSource && (
                    <>
                        <ReadonlyInfo icon={GitBranch} label="Git Branch" value={app.gitBranch ?? 'Not configured'} />
                        {sourceType === 'GIT' && (
                            <ReadonlyInfo icon={LockKeyhole} label="Git Credentials" value={app.gitUsername || app.gitToken ? 'Credentials configured' : 'No credentials'} />
                        )}
                        {sourceType === 'GIT_SSH' && (
                            <ReadonlyInfo
                                icon={KeyRound}
                                label="Deploy Key"
                                value={gitSshPublicKey ? "Deploy key configured" : "No deploy key found"}
                                action={gitSshPublicKey ? (
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="secondary"
                                        onClick={() => openDialog(<PublicDeployKeyDialog publicKey={gitSshPublicKey} />, '680px')}
                                    >
                                        Show key
                                    </Button>
                                ) : undefined}
                            />
                        )}
                        <ReadonlyInfo label="Build Method" value={buildMethodLabels[(app.buildMethod as AppBuildMethod) ?? 'RAILPACK']} />
                        {app.buildMethod === 'DOCKERFILE' && (
                            <ReadonlyInfo icon={FileCode2} label="Dockerfile Path" value={app.dockerfilePath || defaultDockerfilePath} />
                        )}
                    </>
                )}
                {sourceType === 'CONTAINER' && (
                    <>
                        <ReadonlyInfo icon={Package} label="Image Name" value={app.containerImageSource ?? 'Not configured'} />
                        <ReadonlyInfo icon={LockKeyhole} label="Registry Credentials" value={app.containerRegistryUsername || app.containerRegistryPassword ? 'Credentials configured' : 'No credentials'} />
                    </>
                )}
            </div>
        </div>
    );
}
