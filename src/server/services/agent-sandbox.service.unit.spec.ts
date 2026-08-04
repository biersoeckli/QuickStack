import agentSandboxService from './agent-sandbox.service';

vi.mock('@/server/adapter/kubernetes-api.adapter', () => ({ default: {} }));

describe('agent-sandbox.service listFiles', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        vi.spyOn(agentSandboxService as any, 'resolveTarget').mockResolvedValue({});
    });

    it('parses directory and file entries from NUL-delimited output', async () => {
        const execShell = vi.spyOn(agentSandboxService as any, 'execShell').mockResolvedValue({
            stdout: [
                'nested', '/workspace/output/nested', 'directory', '0',
                'report.txt', '/workspace/output/report.txt', 'file', '12', '',
            ].join('\0'),
            stderr: '',
            exitCode: 0,
        });

        await expect(agentSandboxService.listFiles('agent-1', 'sandbox-1', '/workspace/output')).resolves.toEqual([
            { name: 'nested', path: '/workspace/output/nested', type: 'directory', size: 0 },
            { name: 'report.txt', path: '/workspace/output/report.txt', type: 'file', size: 12 },
        ]);
        expect(execShell).toHaveBeenCalledWith(
            {},
            expect.stringContaining('printf "%s\\0%s\\0%s\\0%s\\0"'),
        );
    });

    it('rejects malformed sandbox output', async () => {
        vi.spyOn(agentSandboxService as any, 'execShell').mockResolvedValue({
            stdout: 'name\0/path\0directory\0',
            stderr: '',
            exitCode: 0,
        });

        await expect(agentSandboxService.listFiles('agent-1', 'sandbox-1', '/workspace/output'))
            .rejects.toThrow('List files failed: invalid output from sandbox.');
    });
});
