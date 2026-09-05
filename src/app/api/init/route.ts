import paramService, { ParamService } from "@/server/services/param.service";
import configurationMigrationRegistryService from "@/server/services/configuration-migrations/configuration-migration-registry.service";
import buildPodLogWatchService from "@/server/services/standalone-services/build-pod-log-watch.service";
import buildWatchService from "@/server/services/standalone-services/build-watch.service";
import deploymentEventWatchService from "@/server/services/standalone-services/deployment-event-watch.service";
import registryService from "@/server/services/registry.service";
import s3TargetService from "@/server/services/s3-target.service";
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

        try {
            await configurationMigrationRegistryService.runPending();
        } catch (error) {
            console.error('Failed to run pending configuration migrations:', error);
        }

        await buildWatchService.startWatch();
        await buildPodLogWatchService.startWatch();
        await deploymentEventWatchService.startWatch();

        const [instanceId, registryLocation] = await Promise.all([
            paramService.getOrCreate(ParamService.QS_INSTANCE_ID, crypto.randomUUID()),
            paramService.getOrCreate(ParamService.DISABLE_NODEPORT_ACCESS, 'false'),
            paramService.getOrCreate(ParamService.USE_CANARY_CHANNEL, 'false'),
            paramService.getOrCreate(ParamService.REGISTRY_SOTRAGE_LOCATION, Constants.INTERNAL_REGISTRY_LOCATION),
            paramService.getOrCreate(ParamService.QS_SYSTEM_BACKUP_LOCATION, Constants.QS_SYSTEM_BACKUP_DEACTIVATED),
            paramService.getOrCreate(ParamService.MAX_PARALLEL_BUILDS, String(Constants.DEFAULT_MAX_PARALLEL_BUILDS)),
            paramService.getOrCreate(ParamService.API_OPEN_API_SPEC_ENABLED, 'false'),
        ]);

        // Always (re)deploy the registry on startup so storage settings and image version are never stale.
        const isLocalRegistryStorage = registryLocation.value === Constants.INTERNAL_REGISTRY_LOCATION;
        if (isLocalRegistryStorage || await s3TargetService.existsById(registryLocation.value)) {
            await registryService.deployRegistry(registryLocation.value, true);
        } else {
            console.warn(`Skipping registry deployment because S3 target ${registryLocation.value} no longer exists.`);
        }

        console.log('Initialized services successfully via init route for instanceId:', instanceId);
        return NextResponse.json({ status: "ok" });
    });
}
