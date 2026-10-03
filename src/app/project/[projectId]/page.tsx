'use server'

import { getAuthUserSession } from "@/server/utils/action-wrapper.utils";
import projectService from "@/server/services/project.service";
import AppProjectOverview from "./app-components/project-overview";
import appService from "@/server/services/app.service";
import agentService from "@/server/services/agent.service";
import ProjectBreadcrumbs from "./project-breadcrumbs";
import { UserGroupUtils } from "@/shared/utils/role.utils";
import projectNetworkGraphLayoutService from '@/server/services/project-network-graph-layout.service';
import { ensureReadProject, RequesterIdentity } from '@/server/utils/shared-authorization.utils';
import paramService, { ParamService } from "@/server/services/param.service";
import s3TargetService from "@/server/services/s3-target.service";
import volumeBackupService from "@/server/services/volume-backup.service";
import clusterService from "@/server/services/cluster.service";
import appGitSshKeyService from "@/server/services/app-git-ssh-key.service";
import agentSandboxAddonService from "@/server/services/addons/agent-sandbox-addon.service";

export default async function AppsPage({
    params
}: {
    searchParams?: Promise<{ [key: string]: string | undefined }>;
    params: Promise<{ projectId: string }>
}) {
    const resolvedParams = await params;
    const session = await getAuthUserSession();

    const projectId = resolvedParams?.projectId;
    if (!projectId) {
        return <p>Could not find project with id {projectId}</p>
    }
    const identity: RequesterIdentity = { type: 'session', session };
    ensureReadProject(identity, projectId);
    const project = await projectService.getById(projectId);
    const agentsAvailable = await agentSandboxAddonService.isAvailable();

    const [data, agents] = await Promise.all([
        appService.getAllAppsByProjectId(projectId),
        agentService.getAllByProjectId(projectId),
    ]);
    const relevantApps = data.filter((app) =>
        UserGroupUtils.sessionHasReadAccessForApp(session, app.id));
    const relevantAgents = agents.filter((agent) =>
        UserGroupUtils.sessionHasReadAccessForAgent(session, agent.id));

    const [
        networkGraphPositions,
        hasAcknowledgedNewNetworkPolicyExplanation,
        s3Targets,
        storageClasses,
        volumeBackups,
        gitSshPublicKeys,
    ] = await Promise.all([
        projectNetworkGraphLayoutService.getPositions(projectId),
        paramService.getBoolean(ParamService.FEATURE_NEW_NETWORK_POLICY_EXPLENATION),
        s3TargetService.getAll(),
        clusterService.getStorageClasses(),
        Promise.all(relevantApps.map(async (app) => [
            app.id,
            await volumeBackupService.getForApp(app.id),
        ] as const)),
        Promise.all(relevantApps.map(async (app) => [
            app.id,
            await appGitSshKeyService.getPublicKey(app.id),
        ] as const)),
    ]);

    return (
        <div className="flex-1 space-y-4 pt-6">
            <AppProjectOverview
                session={session}
                apps={relevantApps}
                agents={relevantAgents}
                agentsAvailable={agentsAvailable}
                projectId={project.id}
                projectName={project.name}
                networkGraphPositions={networkGraphPositions}
                showNewNetworkPolicyExplanation={!hasAcknowledgedNewNetworkPolicyExplanation}
                s3Targets={s3Targets}
                storageClasses={storageClasses}
                volumeBackupsByApp={Object.fromEntries(volumeBackups)}
                gitSshPublicKeysByApp={Object.fromEntries(gitSshPublicKeys)}
            />
            <ProjectBreadcrumbs project={project} />
        </div>
    )
}
