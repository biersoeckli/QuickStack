import { ServiceException } from "@/shared/model/service.exception.model";
import { UserGroupUtils } from "@/shared/utils/role.utils";
import {
    ensureAuthenticated,
    ensureAdmin,
    ensureReadApp,
    ensureWriteApp,
    ensureReadProject,
    ensureCreateAppInProject,
    ensureDeleteAppInProject,
    RequesterIdentity,
} from "./shared-authorization.utils";

vi.mock("@/shared/utils/role.utils", () => ({
    UserGroupUtils: {
        isAdmin: vi.fn(),
        sessionHasReadAccessForApp: vi.fn(),
        sessionHasWriteAccessForApp: vi.fn(),
        sessionHasReadAccessToProject: vi.fn(),
        sessionCanCreateNewAppsForProject: vi.fn(),
        sessionCanDeleteAppsForProject: vi.fn(),
    },
}));

const mockUserGroupUtils = vi.mocked(UserGroupUtils);

function makeIdentity(overrides: Partial<RequesterIdentity> = {}): RequesterIdentity {
    return {
        type: "session",
        session: { userGroup: { name: "User" } } as any,
        ...overrides,
    };
}

describe("shared-authorization.utils", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("ensureAuthenticated", () => {
        it("returns identity when session is present", () => {
            const identity = makeIdentity();
            expect(ensureAuthenticated(identity)).toBe(identity);
        });

        it("throws when identity is null", () => {
            expect(() => ensureAuthenticated(null)).toThrow(ServiceException);
        });

        it("throws when identity is undefined", () => {
            expect(() => ensureAuthenticated(undefined)).toThrow(ServiceException);
        });

        it("throws when session is missing", () => {
            expect(() => ensureAuthenticated({ type: "session", session: null as any })).toThrow(ServiceException);
        });
    });

    describe("ensureAdmin", () => {
        it("does not throw when user is admin", () => {
            mockUserGroupUtils.isAdmin.mockReturnValue(true);
            expect(() => ensureAdmin(makeIdentity())).not.toThrow();
        });

        it("throws when user is not admin", () => {
            mockUserGroupUtils.isAdmin.mockReturnValue(false);
            expect(() => ensureAdmin(makeIdentity())).toThrow(ServiceException);
        });
    });

    describe("ensureReadApp", () => {
        it("does not throw when user is admin", () => {
            mockUserGroupUtils.isAdmin.mockReturnValue(true);
            expect(() => ensureReadApp(makeIdentity(), "app-1")).not.toThrow();
        });

        it("does not throw when user has read access", () => {
            mockUserGroupUtils.isAdmin.mockReturnValue(false);
            mockUserGroupUtils.sessionHasReadAccessForApp.mockReturnValue(true);
            const identity = makeIdentity();
            expect(() => ensureReadApp(identity, "app-1")).not.toThrow();
        });

        it("throws when user has no userGroup", () => {
            mockUserGroupUtils.isAdmin.mockReturnValue(false);
            const identity = makeIdentity({ session: { userGroup: null } as any });
            expect(() => ensureReadApp(identity, "app-1")).toThrow(ServiceException);
        });

        it("throws when user lacks read access", () => {
            mockUserGroupUtils.isAdmin.mockReturnValue(false);
            mockUserGroupUtils.sessionHasReadAccessForApp.mockReturnValue(false);
            expect(() => ensureReadApp(makeIdentity(), "app-1")).toThrow(ServiceException);
        });
    });

    describe("ensureWriteApp", () => {
        it("does not throw when user is admin", () => {
            mockUserGroupUtils.isAdmin.mockReturnValue(true);
            expect(() => ensureWriteApp(makeIdentity(), "app-1")).not.toThrow();
        });

        it("does not throw when user has write access", () => {
            mockUserGroupUtils.isAdmin.mockReturnValue(false);
            mockUserGroupUtils.sessionHasWriteAccessForApp.mockReturnValue(true);
            expect(() => ensureWriteApp(makeIdentity(), "app-1")).not.toThrow();
        });

        it("throws when user has no userGroup", () => {
            mockUserGroupUtils.isAdmin.mockReturnValue(false);
            const identity = makeIdentity({ session: { userGroup: null } as any });
            expect(() => ensureWriteApp(identity, "app-1")).toThrow(ServiceException);
        });

        it("throws when user lacks write access", () => {
            mockUserGroupUtils.isAdmin.mockReturnValue(false);
            mockUserGroupUtils.sessionHasWriteAccessForApp.mockReturnValue(false);
            expect(() => ensureWriteApp(makeIdentity(), "app-1")).toThrow(ServiceException);
        });
    });

    describe("ensureReadProject", () => {
        it("does not throw when user is admin", () => {
            mockUserGroupUtils.isAdmin.mockReturnValue(true);
            expect(() => ensureReadProject(makeIdentity(), "proj-1")).not.toThrow();
        });

        it("does not throw when user has read access to project", () => {
            mockUserGroupUtils.isAdmin.mockReturnValue(false);
            mockUserGroupUtils.sessionHasReadAccessToProject.mockReturnValue(true);
            expect(() => ensureReadProject(makeIdentity(), "proj-1")).not.toThrow();
        });

        it("throws when user has no userGroup", () => {
            mockUserGroupUtils.isAdmin.mockReturnValue(false);
            const identity = makeIdentity({ session: { userGroup: null } as any });
            expect(() => ensureReadProject(identity, "proj-1")).toThrow(ServiceException);
        });

        it("throws when user lacks read access to project", () => {
            mockUserGroupUtils.isAdmin.mockReturnValue(false);
            mockUserGroupUtils.sessionHasReadAccessToProject.mockReturnValue(false);
            expect(() => ensureReadProject(makeIdentity(), "proj-1")).toThrow(ServiceException);
        });
    });

    describe("ensureCreateAppInProject", () => {
        it("does not throw when user is admin", () => {
            mockUserGroupUtils.isAdmin.mockReturnValue(true);
            expect(() => ensureCreateAppInProject(makeIdentity(), "proj-1")).not.toThrow();
        });

        it("does not throw when user can create apps", () => {
            mockUserGroupUtils.isAdmin.mockReturnValue(false);
            mockUserGroupUtils.sessionCanCreateNewAppsForProject.mockReturnValue(true);
            expect(() => ensureCreateAppInProject(makeIdentity(), "proj-1")).not.toThrow();
        });

        it("throws when user has no userGroup", () => {
            mockUserGroupUtils.isAdmin.mockReturnValue(false);
            const identity = makeIdentity({ session: { userGroup: null } as any });
            expect(() => ensureCreateAppInProject(identity, "proj-1")).toThrow(ServiceException);
        });

        it("throws when user cannot create apps", () => {
            mockUserGroupUtils.isAdmin.mockReturnValue(false);
            mockUserGroupUtils.sessionCanCreateNewAppsForProject.mockReturnValue(false);
            expect(() => ensureCreateAppInProject(makeIdentity(), "proj-1")).toThrow(ServiceException);
        });
    });

    describe("ensureDeleteAppInProject", () => {
        it("does not throw when user is admin", () => {
            mockUserGroupUtils.isAdmin.mockReturnValue(true);
            expect(() => ensureDeleteAppInProject(makeIdentity(), "proj-1")).not.toThrow();
        });

        it("does not throw when user can delete apps", () => {
            mockUserGroupUtils.isAdmin.mockReturnValue(false);
            mockUserGroupUtils.sessionCanDeleteAppsForProject.mockReturnValue(true);
            expect(() => ensureDeleteAppInProject(makeIdentity(), "proj-1")).not.toThrow();
        });

        it("throws when user has no userGroup", () => {
            mockUserGroupUtils.isAdmin.mockReturnValue(false);
            const identity = makeIdentity({ session: { userGroup: null } as any });
            expect(() => ensureDeleteAppInProject(identity, "proj-1")).toThrow(ServiceException);
        });

        it("throws when user cannot delete apps", () => {
            mockUserGroupUtils.isAdmin.mockReturnValue(false);
            mockUserGroupUtils.sessionCanDeleteAppsForProject.mockReturnValue(false);
            expect(() => ensureDeleteAppInProject(makeIdentity(), "proj-1")).toThrow(ServiceException);
        });
    });
});
