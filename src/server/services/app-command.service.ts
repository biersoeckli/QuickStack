import appService from '@/server/services/app.service';
import podService from '@/server/services/pod.service';
import { CommandRequestModel, CommandResultModel } from '@/shared/model/agent-sandbox.model';
import { ServiceException } from '@/shared/model/service.exception.model';

type AppPodTarget = {
    namespace: string;
    podName: string;
    containerName: string;
};

class AppCommandService {

    private shellQuote(value: string): string {
        return `'${value.replace(/'/g, `'\\''`)}'`;
    }

    private validateEnvName(name: string): void {
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
            throw new ServiceException(`Invalid environment variable name "${name}".`);
        }
    }

    private buildShellScript(input: CommandRequestModel): string {
        const parts: string[] = [];

        if (input.cwd) {
            parts.push(`cd ${this.shellQuote(input.cwd)}`);
        }

        const envPrefix = Object.entries(input.env ?? {}).map(([name, value]) => {
            this.validateEnvName(name);
            return `${name}=${this.shellQuote(value)}`;
        }).join(' ');
        const timeoutSec = input.timeoutSec ?? 120;

        parts.push(`${envPrefix ? `${envPrefix} ` : ''}timeout ${timeoutSec}s sh -lc ${this.shellQuote(input.command)}`);
        return parts.join(' && ');
    }

    private async resolveTarget(appId: string): Promise<AppPodTarget> {
        const app = await appService.getByIdOrUndefined(appId);
        if (!app) {
            throw new ServiceException('App not found.');
        }

        const pods = await podService.getPodsForApp(app.projectId, app.id);
        const pod = pods.find((candidate) => candidate.status === 'Running');
        if (!pod) {
            throw new ServiceException('App has no running Pod to execute the command in.');
        }

        return {
            namespace: app.projectId,
            podName: pod.podName,
            containerName: pod.containerName,
        };
    }

    async runCommand(appId: string, input: CommandRequestModel): Promise<CommandResultModel> {
        const target = await this.resolveTarget(appId);
        const timeoutSec = input.timeoutSec ?? 120;
        return podService.execInPod(
            target.namespace,
            target.podName,
            target.containerName,
            ['sh', '-lc', this.buildShellScript(input)],
            timeoutSec,
        );
    }
}

const appCommandService = new AppCommandService();
export default appCommandService;
