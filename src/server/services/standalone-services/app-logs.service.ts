import dataAccess from "../../adapter/db.client";
import standalonePodService from "./standalone-pod.service";
import { AppLogEntryModel } from "@/shared/model/app-tail-log-entry";

class AppLogsService {

    async getCurrentLogs(appId: string, lines = 200): Promise<AppLogEntryModel[]> {
        const app = await dataAccess.client.app.findFirstOrThrow({
            where: {
                id: appId
            }
        });

        const podInfos = await standalonePodService.getPodsForApp(app.projectId, app.id);
        if (podInfos.length === 0) {
            return [];
        }

        return Promise.all(
            podInfos.map(async (pod) => ({
                podName: pod.podName,
                containerName: pod.containerName,
                logs: await standalonePodService.getCurrentLogsForPod(app.projectId, pod.podName, pod.containerName, lines),
            })),
        );
    }

}

const appLogsService = new AppLogsService();
export default appLogsService;
