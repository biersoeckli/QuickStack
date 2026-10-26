import dataAccess from '../adapter/db.client';
import k3s from '../adapter/kubernetes-api.adapter';
import userGroupService from './user-group.service';
import { ensureWriteProjectWorkload } from '../utils/shared-authorization.utils';
import type { TerminalAuthentication } from '../utils/terminal-auth.utils';
import type { TerminalSetupInfoModel } from '@/shared/model/terminal-setup-info.model';
import { Constants } from '@/shared/utils/constants';
import { ServiceException } from '@/shared/model/service.exception.model';

export type AuthorizedTerminalTarget = {
    workloadId: string;
    podUid: string;
};

class TerminalAccessService {
    async authorize(authentication: TerminalAuthentication | undefined, info: TerminalSetupInfoModel): Promise<AuthorizedTerminalTarget> {
        if (!authentication || authentication.expiresAt <= Date.now()) {
            throw new ServiceException('User is not authenticated.');
        }
        if (info.namespace === Constants.QS_NAMESPACE || info.namespace.startsWith('kube-')) {
            throw new ServiceException('System terminals are not allowed.');
        }
        const user = await dataAccess.client.user.findUnique({ where: { id: authentication.userId } });
        if (!user || user.apiOnlyUser) {
            throw new ServiceException('User is not authenticated.');
        }
        const pod = await k3s.core.readNamespacedPod({ namespace: info.namespace, name: info.podName });
        const labels = pod.metadata?.labels ?? {};
        const annotations = pod.metadata?.annotations ?? {};
        const appIds = new Set([labels[Constants.QS_ANNOTATION_APP_ID], annotations[Constants.QS_ANNOTATION_APP_ID]].filter(Boolean));
        const agentIds = new Set([labels[Constants.QS_ANNOTATION_AGENT_ID], annotations[Constants.QS_ANNOTATION_AGENT_ID]].filter(Boolean));
        if (appIds.size + agentIds.size !== 1 || !pod.metadata?.uid
            || pod.metadata.namespace !== info.namespace
            || !pod.spec?.containers.some(container => container.name === info.containerName)) {
            throw new ServiceException('Terminal target is not a project workload.');
        }
        const workloadId = [...appIds, ...agentIds][0];
        const workload = appIds.size
            ? await dataAccess.client.app.findUnique({ where: { id: workloadId }, select: { projectId: true } })
            : await dataAccess.client.agent.findUnique({ where: { id: workloadId }, select: { projectId: true } });
        if (!workload || workload.projectId !== info.namespace) {
            throw new ServiceException('Terminal target does not belong to this project.');
        }
        const userGroup = await userGroupService.getRoleByUserMailUncached(user.email);
        ensureWriteProjectWorkload({
            type: 'session',
            session: { userId: user.id, email: user.email, userGroup: userGroup ?? undefined },
        }, workloadId);
        return { workloadId, podUid: pod.metadata.uid };
    }
}

const terminalAccessService = new TerminalAccessService();
export default terminalAccessService;
