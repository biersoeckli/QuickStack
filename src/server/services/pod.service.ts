import { PodsInfoModel } from "@/shared/model/pods-info.model";
import k3s from "../adapter/kubernetes-api.adapter";
import { ServiceException } from "@/shared/model/service.exception.model";
import standalonePodService from "./standalone-services/standalone-pod.service";

class PodService {

    async waitUntilPodIsRunningFailedOrSucceded(projectId: string, podName: string) {
        const isPodRunnning = await standalonePodService.waitUntilPodIsRunningFailedOrSucceded(projectId, podName);
        if (!isPodRunnning) {
            throw new ServiceException(`Pod ${podName} did not become ready in time (timeout).`);
        }
    }

    async waitUntilPodIsTerminated(projectId: string, podName: string) {
        const isPodTerminated = await standalonePodService.waitUntilPodIsTerminated(projectId, podName);
        if (!isPodTerminated) {
            throw new ServiceException(`Pod ${podName} did not become terminated in time (timeout).`);
        }
    }

    async getPodInfoByName(projectId: string, podName: string) {
        const res = await k3s.core.readNamespacedPod(podName, projectId);
        return {
            podName: res.body.metadata?.name!,
            containerName: res.body.spec?.containers?.[0].name!
        } as PodsInfoModel;
    }

    async getPodsForApp(projectId: string, appId: string): Promise<PodsInfoModel[]> {
        return standalonePodService.getPodsForApp(projectId, appId);
    }

    public async runCommandInPod(
        namespace: string,
        podName: string,
        containerName: string,
        command: string[],
    ): Promise<void> {
        return await standalonePodService.runCommandInPod(namespace, podName, containerName, command);
    }

    public async cpFromPod(
        namespace: string,
        podName: string,
        containerName: string,
        srcPath: string,
        zipOutputPath: string,
        cwd?: string,
    ): Promise<void> {
        return await standalonePodService.cpFromPod(namespace, podName, containerName, srcPath, zipOutputPath, cwd);
    }

    async deleteRestorePodIfExists(namespace: string, name: string) {
        const existingPods = await k3s.core.listNamespacedPod(namespace);
        const pod = existingPods.body.items.find((item) => item.metadata?.labels?.app === name);
        if (pod) {
            await k3s.core.deleteNamespacedPod(name, namespace);
        }
    }
}

const podService = new PodService();
export default podService;
