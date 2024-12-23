import { CoreV1Event } from "@kubernetes/client-node";
import k3s from "../adapter/kubernetes-api.adapter";
import { EventInfoModel } from "@/shared/model/event-info.model";
import podService from "./pod.service";
import { isDate } from "date-fns";

class EventService {

    async getEventsForApp(projectId: string, appId: string): Promise<EventInfoModel[]> {

        const pods = await podService.getPodsForApp(projectId, appId);

        // Example Request using kubectl:
        // /api/v1/namespaces/default/events?fieldSelector=involvedObject.uid%3D8ecf9894-cda6-4687-9598-9f06f6985e0d%2CinvolvedObject.name%3Dlonghorn-nfs-installation-8n9kv%2CinvolvedObject.namespace%3Ddefault&limit=500

        // Selectors:
        // fieldSelector=involvedObject.namespace={projectId},
        // involvedObject.uid={kubernetesUid},
        // involvedObject.name={appId}

        // Docs: https://kubernetes.io/docs/concepts/overview/working-with-objects/field-selectors/

        const returnVal: EventInfoModel[] = [];
        for (let podInfo of pods) {
            console.log(podInfo.uid)
            const result = await k3s.core.listNamespacedEvent(projectId,
                undefined,
                undefined,
                undefined,
                `involvedObject.namespace=${projectId},involvedObject.uid=${podInfo.uid},involvedObject.name=${podInfo.podName}`,
                undefined,
                50);

            const events: CoreV1Event[] = result.body.items;

            const eventsForPod = events.map(event => {
                return {
                    podName: podInfo.podName,
                    action: event.action,
                    eventTime: event.eventTime ?? event.lastTimestamp,
                    note: event.message,
                    reason: event.reason,
                    type: event.type,
                } as EventInfoModel;
            });
            returnVal.push(...eventsForPod);
        }

        returnVal.sort((a, b) => {
            if (!isDate(b.eventTime)) {
                b.eventTime = new Date(b.eventTime);
            }
            if (!isDate(a.eventTime)) {
                a.eventTime = new Date(a.eventTime);
            }
            if (a.eventTime && b.eventTime) {
                return b.eventTime.getTime() - a.eventTime.getTime();
            }
            return 0;
        });
        return returnVal;
    }
}

const eventService = new EventService();
export default eventService;