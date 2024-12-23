import k3s from "../../adapter/kubernetes-api.adapter";

class SetupPodService {

    async waitUntilPodIsRunningFailedOrSucceded(projectId: string, podName: string) {
        const timeout = 120000;
        const interval = 1000;
        const maxTries = timeout / interval;
        let tries = 0;

        while (tries < maxTries) {
            const pod = await this.getPodOrUndefined(projectId, podName);
            if (pod && ['Running', 'Failed', 'Succeeded'].includes(pod.status?.phase!)) {
                return true;
            }

            await new Promise(resolve => setTimeout(resolve, interval));
            tries++;
        }

        return false;
    }

    async getPodOrUndefined(projectId: string, podName: string) {
        const res = await k3s.core.listNamespacedPod(projectId);
        return res.body.items.find((item) => item.metadata?.name === podName);
    }

    async getPodsForApp(projectId: string, appId: string): Promise<{
        podName: string;
        containerName: string;
        uid?: string;
    }[]> {
        const res = await k3s.core.listNamespacedPod(projectId, undefined, undefined, undefined, undefined, `app=${appId}`);
        return res.body.items.map((item) => ({
            podName: item.metadata?.name!,
            containerName: item.spec?.containers?.[0].name!,
            uid: item.metadata?.uid,
        })).filter((item) => !!item.podName && !!item.containerName);
    }
}

const setupPodService = new SetupPodService();
export default setupPodService;
