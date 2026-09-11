import { revalidateTag, unstable_cache } from 'next/cache';
import dataAccess from '@/server/adapter/db.client';
import type {
    ProjectNetworkGraphPositionInput,
    ProjectNetworkGraphPositions,
} from '@/shared/model/project-network-graph-layout.model';
import { ServiceException } from '@/shared/model/service.exception.model';
import { Tags } from '@/server/utils/cache-tag-generator.utils';

class ProjectNetworkGraphLayoutService {
    async getPositions(projectId: string): Promise<ProjectNetworkGraphPositions> {
        const positions = await unstable_cache(
            async (innerProjectId: string) =>
                dataAccess.client.projectNetworkGraphPosition.findMany({
                    where: { projectId: innerProjectId },
                    select: { nodeId: true, x: true, y: true },
                }),
            [Tags.projectNetworkGraphLayout(projectId)],
            { tags: [Tags.projectNetworkGraphLayout(projectId)] },
        )(projectId);

        return Object.fromEntries(
            positions.map(({ nodeId, x, y }) => [nodeId, { x, y }]),
        );
    }

    async savePosition(projectId: string, position: ProjectNetworkGraphPositionInput) {
        if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) {
            throw new ServiceException('Invalid network graph position.');
        }
        if (!(await this.nodeExistsInProjectGraph(projectId, position.nodeId))) {
            throw new ServiceException('Network graph node does not belong to this project.');
        }

        try {
            return await dataAccess.client.projectNetworkGraphPosition.upsert({
                where: {
                    projectId_nodeId: { projectId, nodeId: position.nodeId },
                },
                create: { projectId, ...position },
                update: { x: position.x, y: position.y },
            });
        } finally {
            revalidateTag(Tags.projectNetworkGraphLayout(projectId));
        }
    }

    async resetPositions(projectId: string) {
        try {
            await dataAccess.client.projectNetworkGraphPosition.deleteMany({ where: { projectId } });
        } finally {
            revalidateTag(Tags.projectNetworkGraphLayout(projectId));
        }
    }

    private async nodeExistsInProjectGraph(projectId: string, nodeId: string) {
        if (nodeId === 'INTERNET') {
            const internetNodeSource = await dataAccess.client.app.findFirst({
                where: {
                    projectId,
                    OR: [
                        { appDomains: { some: {} } },
                        {
                            useNetworkPolicy: true,
                            appNetworkPolicy: { allowInternetAccess: true },
                        },
                    ],
                },
                select: { id: true },
            });
            return !!internetNodeSource;
        }

        const separatorIndex = nodeId.indexOf(':');
        const kind = nodeId.slice(0, separatorIndex);
        const workloadId = nodeId.slice(separatorIndex + 1);
        if (separatorIndex <= 0 || !workloadId || (kind !== 'APP' && kind !== 'AGENT')) {
            return false;
        }

        if (kind === 'APP') {
            const app = await dataAccess.client.app.findFirst({
                where: {
                    id: workloadId,
                    OR: [
                        { projectId },
                        {
                            appNetworkPolicyRules: {
                                some: {
                                    appNetworkPolicy: {
                                        app: { projectId, useNetworkPolicy: true },
                                    },
                                },
                            },
                        },
                    ],
                },
                select: { id: true },
            });
            return !!app;
        }

        const agent = await dataAccess.client.agent.findFirst({
            where: {
                id: workloadId,
                appNetworkPolicyRules: {
                    some: {
                        appNetworkPolicy: {
                            app: { projectId, useNetworkPolicy: true },
                        },
                    },
                },
            },
            select: { id: true },
        });
        return !!agent;
    }
}

const projectNetworkGraphLayoutService = new ProjectNetworkGraphLayoutService();
export default projectNetworkGraphLayoutService;
