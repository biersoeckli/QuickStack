'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useDialog } from "@/frontend/states/zustand.states";
import { AgentWithRelationsModel } from "@/shared/model/agent-extended.model";
import { Container, FileCode2, GitBranch, KeyRound, Link as LinkIcon, LockKeyhole, Package, Server } from "lucide-react";
import { ReadonlyInfo } from "@/app/project/app/[appId]/general/app-source-wizard/readonly-info";
import { defaultDockerfilePath, SourceType, sourceTypeLabels } from "@/app/project/app/[appId]/general/app-source-wizard/types";
import { PublicDeployKeyDialog } from "@/app/project/app/[appId]/general/app-source-wizard/public-deploy-key-dialog";
import { AgentSourceWizardDialog } from "./agent-source-wizard-dialog";

export default function AgentSourceCard({ agent, readonly }: {
    agent: AgentWithRelationsModel;
    readonly: boolean;
}) {
    const { openDialog } = useDialog();
    const publicKey = agent.agentGitSshKey?.publicKey;
    const configured = isConfiguredSource(agent);

    const openSourceWizard = () => {
        openDialog(
            <AgentSourceWizardDialog agent={agent} gitSshPublicKey={publicKey} />,
            {
                width: 'calc(100vw - 2rem)',
                maxWidth: '760px',
                maxHeight: '90vh',
            }
        );
    };

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
                {!configured ? (
                    <EmptySourceState readonly={readonly} onConnect={openSourceWizard} />
                ) : (
                    <ConfiguredSourceSummary agent={agent} gitSshPublicKey={publicKey} />
                )}
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
                <p className="font-medium">No agent source connected</p>
                <p className="max-w-md text-sm text-muted-foreground">Connect a Git repository or container image before deploying this agent.</p>
            </div>
            {!readonly && (
                <Button type="button" onClick={onConnect}>
                    <LinkIcon className="h-4 w-4" />
                    Connect Agent Source
                </Button>
            )}
        </div>
    );
}

function ConfiguredSourceSummary({ agent, gitSshPublicKey }: { agent: AgentWithRelationsModel; gitSshPublicKey?: string }) {
    const { openDialog } = useDialog();
    const sourceType = agent.sourceType as SourceType;
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
                            {isGitSource ? agent.gitUrl : agent.containerImageSource}
                        </p>
                    </div>
                </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
                {isGitSource && (
                    <>
                        <ReadonlyInfo icon={GitBranch} label="Git Branch" value={agent.gitBranch ?? 'Not configured'} />
                        {sourceType === 'GIT' && (
                            <ReadonlyInfo icon={LockKeyhole} label="Git Credentials" value={agent.gitUsername || agent.gitToken ? 'Credentials configured' : 'No credentials'} />
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
                        <ReadonlyInfo label="Build Method" value="Dockerfile" />
                        <ReadonlyInfo icon={FileCode2} label="Dockerfile Path" value={agent.dockerfilePath || defaultDockerfilePath} />
                    </>
                )}
                {sourceType === 'CONTAINER' && (
                    <>
                        <ReadonlyInfo icon={Package} label="Image Name" value={agent.containerImageSource ?? 'Not configured'} />
                        <ReadonlyInfo icon={LockKeyhole} label="Registry Credentials" value={agent.containerRegistryUsername || agent.containerRegistryPassword ? 'Credentials configured' : 'No credentials'} />
                    </>
                )}
            </div>
        </div>
    );
}

function isConfiguredSource(agent: AgentWithRelationsModel) {
    if (agent.sourceType === 'GIT' || agent.sourceType === 'GIT_SSH') {
        return !!agent.gitUrl?.trim() && !!agent.gitBranch?.trim() && !!agent.dockerfilePath?.trim();
    }
    if (agent.sourceType === 'CONTAINER') {
        return !!agent.containerImageSource?.trim();
    }
    return false;
}
