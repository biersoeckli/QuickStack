import fs from 'fs/promises';
import deploymentLogService from './deployment-logs.service';
import { mockPathUtilsForTests } from '@/__tests__/path-test.utils';
import { PathUtils } from '../utils/path.utils';

const { originalInternalDataRoot, originalTempDataRoot } = mockPathUtilsForTests();

describe('deployment-logs.service', () => {
    beforeEach(async () => {
        await fs.rm(PathUtils.deploymentLogsPath, { recursive: true, force: true });
    });

    afterAll(async () => {
        await fs.rm(PathUtils.deploymentLogsPath, { recursive: true, force: true });

        if (originalInternalDataRoot) {
            Object.defineProperty(PathUtils, 'internalDataRoot', originalInternalDataRoot);
        }

        if (originalTempDataRoot) {
            Object.defineProperty(PathUtils, 'tempDataRoot', originalTempDataRoot);
        }

        vi.restoreAllMocks();
    });

    it('returns full deployment logs by id', async () => {
        const deploymentId = 'deploy-full';
        await writeLogFile(deploymentId, 'line-1\nline-2\nline-3\n');

        await expect(deploymentLogService.getLogsById(deploymentId)).resolves.toBe('line-1\nline-2\nline-3\n');
    });

    it('returns only the last tail lines when requested', async () => {
        const deploymentId = 'deploy-tail';
        await writeLogFile(deploymentId, 'line-1\nline-2\nline-3\nline-4\n');

        await expect(deploymentLogService.getLogsById(deploymentId, 2)).resolves.toBe('line-3\nline-4\n');
    });

    it('returns a missing file message when deployment log does not exist', async () => {
        await expect(deploymentLogService.getLogsById('missing-deploy')).resolves.toBe(
            'The log file for deployment missing-deploy does not exist.'
        );
    });

    it('streams the existing log content before watching for updates', async () => {
        const deploymentId = 'deploy-stream';
        await writeLogFile(deploymentId, 'first\nsecond\n');

        const streamedChunks: string[] = [];
        const closeListener = await deploymentLogService.getLogsStream(deploymentId, (chunk) => {
            streamedChunks.push(chunk);
        });

        await vi.waitFor(() => {
            expect(streamedChunks.join('')).toBe('first\nsecond\n');
        });

        closeListener?.();
    });
});

async function writeLogFile(deploymentId: string, content: string) {
    await fs.mkdir(PathUtils.deploymentLogsPath, { recursive: true });
    await fs.writeFile(PathUtils.appDeploymentLogFile(deploymentId), content, 'utf-8');
}
