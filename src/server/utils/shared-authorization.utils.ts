import { ServiceException } from "@/shared/model/service.exception.model";
import { UserSession } from "@/shared/model/sim-session.model";
import { UserGroupUtils } from "@/shared/utils/role.utils";

export type RequesterIdentity = {
    type: 'session' | 'apiKey';
    session: UserSession;
};

export function ensureAuthenticated(identity: RequesterIdentity | null | undefined): RequesterIdentity {
    if (!identity?.session) {
        throw new ServiceException('User is not authenticated.');
    }
    return identity;
}

export function ensureAdmin(identity: RequesterIdentity) {
    if (!UserGroupUtils.isAdmin(identity.session)) {
        throw new ServiceException('User is not authorized for this action.');
    }
}

export function ensureReadApp(identity: RequesterIdentity, appId: string) {
    ensureReadProjectWorkload(identity, appId);
}

export function ensureWriteApp(identity: RequesterIdentity, appId: string) {
    ensureWriteProjectWorkload(identity, appId);
}

export function ensureReadProjectWorkload(identity: RequesterIdentity, workloadId: string) {
    if (UserGroupUtils.isAdmin(identity.session)) {
        return;
    }
    if (!identity.session.userGroup || !UserGroupUtils.sessionHasReadAccessForProjectWorkload(identity.session, workloadId)) {
        throw new ServiceException('User is not authorized for this action.');
    }
}

export function ensureWriteProjectWorkload(identity: RequesterIdentity, workloadId: string) {
    if (UserGroupUtils.isAdmin(identity.session)) {
        return;
    }
    if (!identity.session.userGroup || !UserGroupUtils.sessionHasWriteAccessForProjectWorkload(identity.session, workloadId)) {
        throw new ServiceException('User is not authorized for this action.');
    }
}

export function ensureReadProject(identity: RequesterIdentity, projectId: string) {
    if (UserGroupUtils.isAdmin(identity.session)) {
        return;
    }
    if (!identity.session.userGroup || !UserGroupUtils.sessionHasReadAccessToProject(identity.session, projectId)) {
        throw new ServiceException('User is not authorized for this action.');
    }
}

export function ensureCreateAppInProject(identity: RequesterIdentity, projectId: string) {
    ensureCreateProjectWorkloadInProject(identity, projectId);
}

export function ensureDeleteAppInProject(identity: RequesterIdentity, projectId: string) {
    ensureDeleteProjectWorkloadInProject(identity, projectId);
}

export function ensureCreateProjectWorkloadInProject(identity: RequesterIdentity, projectId: string) {
    if (UserGroupUtils.isAdmin(identity.session)) {
        return;
    }
    if (!identity.session.userGroup || !UserGroupUtils.sessionCanCreateProjectWorkloadsForProject(identity.session, projectId)) {
        throw new ServiceException('User is not authorized for this action.');
    }
}

export function ensureDeleteProjectWorkloadInProject(identity: RequesterIdentity, projectId: string) {
    if (UserGroupUtils.isAdmin(identity.session)) {
        return;
    }
    if (!identity.session.userGroup || !UserGroupUtils.sessionCanDeleteProjectWorkloadsForProject(identity.session, projectId)) {
        throw new ServiceException('User is not authorized for this action.');
    }
}
