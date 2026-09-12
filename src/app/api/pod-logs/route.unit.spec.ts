import { PassThrough } from 'node:stream';
import { adminRoleName } from '@/shared/model/role-extended.model.ts';

const mocks = vi.hoisted(() => ({
    getUserSession: vi.fn(),
    getPodByName: vi.fn(),
    waitUntilPodIsRunningFailedOrSucceded: vi.fn(),
    log: vi.fn(),
}));

vi.mock('@/server/utils/action-wrapper.utils', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/server/utils/action-wrapper.utils')>();
    return {
        ...actual,
        getUserSession: mocks.getUserSession,
    };
});

vi.mock('@/server/services/pod.service', () => ({
    default: {
        getPodByName: mocks.getPodByName,
        waitUntilPodIsRunningFailedOrSucceded: mocks.waitUntilPodIsRunningFailedOrSucceded,
    },
}));

vi.mock('@/server/adapter/kubernetes-api.adapter', () => ({
    default: {
        log: {
            log: mocks.log,
        },
    },
}));

import { POST } from './route';

describe('pod log route', () => {
    const adminSession = {
        email: 'admin@quickstack.test',
        userId: 'admin-1',
        userGroup: {
            id: 'admin-group',
            name: adminRoleName,
            canAccessBackups: true,
            roleProjectPermissions: [],
        },
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getUserSession.mockResolvedValue(adminSession);
        mocks.waitUntilPodIsRunningFailedOrSucceded.mockResolvedValue(true);
        mocks.log.mockImplementation(async (
            _namespace: string,
            _podName: string,
            _containerName: string,
            output: PassThrough,
        ) => {
            queueMicrotask(() => output.end('quickstack started\n'));
            return { abort: vi.fn() };
        });
    });

    it('streams the QuickStack system pod logs to an admin', async () => {
        mocks.getPodByName.mockResolvedValue({
            metadata: {
                name: 'quickstack-7c9f8d6b5-test',
                labels: { app: 'quickstack' },
            },
            spec: {
                containers: [{ name: 'quickstack' }],
            },
        });

        const response = await POST(new Request('http://quickstack.test/api/pod-logs', {
            method: 'POST',
            body: JSON.stringify({
                namespace: 'quickstack',
                podName: 'quickstack-7c9f8d6b5-test',
                linesCount: 100,
            }),
        }));

        expect(response.status).toBe(200);
        expect(response.headers.get('content-type')).toContain('text/event-stream');
        await expect(response.text()).resolves.toContain('quickstack started');
    });

    it('rejects QuickStack system pod logs for a non-admin', async () => {
        mocks.getUserSession.mockResolvedValue({
            ...adminSession,
            userGroup: {
                ...adminSession.userGroup,
                name: 'Developer',
            },
        });
        mocks.getPodByName.mockResolvedValue({
            metadata: {
                name: 'quickstack-7c9f8d6b5-test',
                labels: { app: 'quickstack' },
            },
            spec: {
                containers: [{ name: 'quickstack' }],
            },
        });

        const response = await POST(new Request('http://quickstack.test/api/pod-logs', {
            method: 'POST',
            body: JSON.stringify({
                namespace: 'quickstack',
                podName: 'quickstack-7c9f8d6b5-test',
            }),
        }));

        expect(response.status).toBe(403);
        expect(mocks.log).not.toHaveBeenCalled();
    });
});
