import paramService, { ParamService } from "@/server/services/param.service";
import buildPodLogWatchService from "@/server/services/standalone-services/build-pod-log-watch.service";
import buildWatchService from "@/server/services/standalone-services/build-watch.service";
import deploymentEventWatchService from "@/server/services/standalone-services/deployment-event-watch.service";
import registryService from "@/server/services/registry.service";
import { Constants } from "@/shared/utils/constants";
import { simpleRoute } from "@/server/utils/action-wrapper.utils";
import { NextResponse } from "next/server";

// Prevents this route's response from being cached
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    return simpleRoute(async () => {
        const url = new URL(request.url);
        const key = url.searchParams.get("key");

        if (!globalThis.quickStackInitKey || key !== globalThis.quickStackInitKey) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        await buildWatchService.startWatch();
        await buildPodLogWatchService.startWatch();
        await deploymentEventWatchService.startWatch();

        const instanceId = await paramService.getOrCreate(ParamService.QS_INSTANCE_ID, crypto.randomUUID());

        // Always (re)deploy the registry on startup so storage settings and image version are never stale.
        const registryLocation = await paramService.getString(ParamService.REGISTRY_SOTRAGE_LOCATION, Constants.INTERNAL_REGISTRY_LOCATION);
        await registryService.deployRegistry(registryLocation!, true);

        console.log('Initialized services successfully via init route for instanceId:', instanceId);
        return NextResponse.json({ status: "ok" });
    });
}
