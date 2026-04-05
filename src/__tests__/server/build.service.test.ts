// Mock heavy dependencies that cannot run in jsdom
jest.mock('@/server/adapter/kubernetes-api.adapter', () => ({ default: {} }));
jest.mock('@/server/adapter/db.client', () => ({ default: { client: {} } }));
jest.mock('@/server/services/namespace.service', () => ({ default: {} }));
jest.mock('@/server/services/registry.service', () => ({ default: {}, BUILD_NAMESPACE: 'qs-build' }));
jest.mock('@/server/services/param.service', () => ({ default: {}, ParamService: {} }));
jest.mock('@/server/services/cluster.service', () => ({ default: {} }));
jest.mock('@/server/services/build-init-container.service', () => ({ default: {} }));
jest.mock('@/server/services/git.service', () => ({ default: {} }));
jest.mock('@/server/services/pod.service', () => ({ default: {} }));
jest.mock('@/server/services/deployment-logs.service', () => ({ dlog: jest.fn() }));

import buildService from '@/server/services/build.service';
import { V1JobStatus } from '@kubernetes/client-node';

describe('BuildService.getJobStatusString', () => {

    describe('undefined / empty status', () => {
        it('returns UNKNOWN when status is undefined', () => {
            expect(buildService.getJobStatusString(undefined)).toBe('UNKNOWN');
        });

        it('returns UNKNOWN when status is an empty object', () => {
            expect(buildService.getJobStatusString({})).toBe('UNKNOWN');
        });

        it('returns UNKNOWN when all numeric fields are 0', () => {
            const status: V1JobStatus = { ready: 0, succeeded: 0, failed: 0, terminating: 0, active: 0 };
            expect(buildService.getJobStatusString(status)).toBe('UNKNOWN');
        });
    });

    describe('RUNNING — ready > 0', () => {
        it('returns RUNNING when ready is 1', () => {
            const status: V1JobStatus = { ready: 1 };
            expect(buildService.getJobStatusString(status)).toBe('RUNNING');
        });

        it('returns RUNNING when ready is greater than 1', () => {
            const status: V1JobStatus = { ready: 3 };
            expect(buildService.getJobStatusString(status)).toBe('RUNNING');
        });

        it('does NOT return RUNNING when ready is 0', () => {
            const status: V1JobStatus = { ready: 0 };
            expect(buildService.getJobStatusString(status)).not.toBe('RUNNING');
        });

        it('does NOT return RUNNING when ready is undefined', () => {
            const status: V1JobStatus = { ready: undefined };
            expect(buildService.getJobStatusString(status)).not.toBe('RUNNING');
        });
    });

    describe('SUCCEEDED — succeeded > 0', () => {
        it('returns SUCCEEDED when succeeded is 1', () => {
            const status: V1JobStatus = { succeeded: 1 };
            expect(buildService.getJobStatusString(status)).toBe('SUCCEEDED');
        });

        it('returns SUCCEEDED when succeeded is greater than 1', () => {
            const status: V1JobStatus = { succeeded: 5 };
            expect(buildService.getJobStatusString(status)).toBe('SUCCEEDED');
        });

        it('does NOT return SUCCEEDED when succeeded is 0', () => {
            const status: V1JobStatus = { succeeded: 0 };
            expect(buildService.getJobStatusString(status)).not.toBe('SUCCEEDED');
        });

        it('does NOT return SUCCEEDED when succeeded is undefined', () => {
            const status: V1JobStatus = {};
            expect(buildService.getJobStatusString(status)).not.toBe('SUCCEEDED');
        });
    });

    describe('SUCCEEDED — completionTime set', () => {
        it('returns SUCCEEDED when completionTime is set and no other fields match', () => {
            const status: V1JobStatus = { completionTime: new Date('2024-01-01T00:00:00Z') };
            expect(buildService.getJobStatusString(status)).toBe('SUCCEEDED');
        });

        it('returns SUCCEEDED via completionTime even when succeeded is 0', () => {
            const status: V1JobStatus = { completionTime: new Date(), succeeded: 0, failed: 0, terminating: 0, active: 0, ready: 0 };
            expect(buildService.getJobStatusString(status)).toBe('SUCCEEDED');
        });
    });

    describe('FAILED — failed > 0', () => {
        it('returns FAILED when failed is 1', () => {
            const status: V1JobStatus = { failed: 1 };
            expect(buildService.getJobStatusString(status)).toBe('FAILED');
        });

        it('returns FAILED when failed is greater than 1', () => {
            const status: V1JobStatus = { failed: 4 };
            expect(buildService.getJobStatusString(status)).toBe('FAILED');
        });

        it('does NOT return FAILED when failed is 0', () => {
            const status: V1JobStatus = { failed: 0 };
            expect(buildService.getJobStatusString(status)).not.toBe('FAILED');
        });

        it('does NOT return FAILED when failed is undefined', () => {
            const status: V1JobStatus = {};
            expect(buildService.getJobStatusString(status)).not.toBe('FAILED');
        });
    });

    describe('PENDING — active > 0', () => {
        it('returns PENDING when active is 1 and no other indicator is set', () => {
            const status: V1JobStatus = { active: 1 };
            expect(buildService.getJobStatusString(status)).toBe('PENDING');
        });

        it('returns PENDING when active is greater than 1', () => {
            const status: V1JobStatus = { active: 2 };
            expect(buildService.getJobStatusString(status)).toBe('PENDING');
        });

        it('does NOT return PENDING when active is 0', () => {
            const status: V1JobStatus = { active: 0 };
            expect(buildService.getJobStatusString(status)).not.toBe('PENDING');
        });

        it('does NOT return PENDING when active is undefined', () => {
            const status: V1JobStatus = {};
            expect(buildService.getJobStatusString(status)).not.toBe('PENDING');
        });
    });

    describe('UNKNOWN — terminating > 0', () => {
        it('returns UNKNOWN when terminating is 1', () => {
            const status: V1JobStatus = { terminating: 1 };
            expect(buildService.getJobStatusString(status)).toBe('UNKNOWN');
        });

        it('returns UNKNOWN when terminating is greater than 1', () => {
            const status: V1JobStatus = { terminating: 3 };
            expect(buildService.getJobStatusString(status)).toBe('UNKNOWN');
        });
    });

    describe('priority ordering', () => {
        it('ready takes priority over succeeded', () => {
            const status: V1JobStatus = { ready: 1, succeeded: 1 };
            expect(buildService.getJobStatusString(status)).toBe('RUNNING');
        });

        it('ready takes priority over failed', () => {
            const status: V1JobStatus = { ready: 1, failed: 1 };
            expect(buildService.getJobStatusString(status)).toBe('RUNNING');
        });

        it('ready takes priority over active', () => {
            const status: V1JobStatus = { ready: 1, active: 1 };
            expect(buildService.getJobStatusString(status)).toBe('RUNNING');
        });

        it('ready takes priority over completionTime', () => {
            const status: V1JobStatus = { ready: 1, completionTime: new Date() };
            expect(buildService.getJobStatusString(status)).toBe('RUNNING');
        });

        it('failed takes priority over succeded', () => {
            const status: V1JobStatus = { succeeded: 1, failed: 1 };
            expect(buildService.getJobStatusString(status)).toBe('FAILED');
        });

        it('succeeded takes priority over terminating', () => {
            const status: V1JobStatus = { succeeded: 1, terminating: 1 };
            expect(buildService.getJobStatusString(status)).toBe('SUCCEEDED');
        });

        it('succeeded takes priority over active', () => {
            const status: V1JobStatus = { succeeded: 1, active: 1 };
            expect(buildService.getJobStatusString(status)).toBe('SUCCEEDED');
        });

        it('failed takes priority over terminating', () => {
            const status: V1JobStatus = { failed: 1, terminating: 0, active: 0 };
            expect(buildService.getJobStatusString(status)).toBe('FAILED');
        });

        it('failed takes priority over active', () => {
            const status: V1JobStatus = { failed: 1, active: 1 };
            expect(buildService.getJobStatusString(status)).toBe('FAILED');
        });

        it('terminating takes priority over completionTime', () => {
            const status: V1JobStatus = { terminating: 1, completionTime: new Date() };
            expect(buildService.getJobStatusString(status)).toBe('UNKNOWN');
        });

        it('terminating takes priority over active', () => {
            const status: V1JobStatus = { terminating: 1, active: 1 };
            expect(buildService.getJobStatusString(status)).toBe('UNKNOWN');
        });

        it('completionTime takes priority over active', () => {
            const status: V1JobStatus = { completionTime: new Date(), active: 1 };
            expect(buildService.getJobStatusString(status)).toBe('SUCCEEDED');
        });
    });

    describe('realistic Kubernetes job lifecycle states', () => {
        it('newly created job — active pod, not yet ready', () => {
            const status: V1JobStatus = { active: 1, ready: 0, startTime: new Date() };
            expect(buildService.getJobStatusString(status)).toBe('PENDING');
        });

        it('running job — pod active and ready', () => {
            const status: V1JobStatus = { active: 1, ready: 1, startTime: new Date() };
            expect(buildService.getJobStatusString(status)).toBe('RUNNING');
        });

        it('completed job — succeeded count set with completionTime', () => {
            const startTime = new Date('2024-01-01T10:00:00Z');
            const completionTime = new Date('2024-01-01T10:05:00Z');
            const status: V1JobStatus = { succeeded: 1, active: 0, startTime, completionTime };
            expect(buildService.getJobStatusString(status)).toBe('SUCCEEDED');
        });

        it('failed job — failed count set, backoffLimit reached', () => {
            const status: V1JobStatus = { failed: 1, active: 0, startTime: new Date() };
            expect(buildService.getJobStatusString(status)).toBe('FAILED');
        });

        it('job with multiple retry failures', () => {
            const status: V1JobStatus = { failed: 3, active: 1 };
            // failed takes priority over active per implementation order
            expect(buildService.getJobStatusString(status)).toBe('FAILED');
        });

        it('terminating job — pod shutting down', () => {
            const status: V1JobStatus = { terminating: 1, active: 0 };
            expect(buildService.getJobStatusString(status)).toBe('UNKNOWN');
        });

        it('completed via completionTime only (succeeded field absent)', () => {
            const status: V1JobStatus = { completionTime: new Date('2024-06-01T12:00:00Z'), active: 0 };
            expect(buildService.getJobStatusString(status)).toBe('SUCCEEDED');
        });
    });
});
