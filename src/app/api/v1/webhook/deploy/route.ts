import appService from "@/server/services/app.service";
import buildWatchService from "@/server/services/standalone-services/build-watch.service";
import deploymentEventWatchService from "@/server/services/standalone-services/deployment-event-watch.service";
import { simpleRoute } from "@/server/utils/action-wrapper.utils";
import { NextResponse } from "next/server";
import { z } from "zod";

// Prevents this route's response from being cached
export const dynamic = "force-dynamic";

const routeLogic = (request: Request) => simpleRoute(async () => {
    const url = new URL(request.url);
    const searchParams = url.searchParams;

    const { id } = z.object({
        id: z.string().min(1),
    }).parse({
        id: searchParams.get("id"),
    });

    const app = await appService.getByWebhookId(id);

    // starts the buildwatch service if not already running.
    buildWatchService.startWatch();
    deploymentEventWatchService.startWatch();

    await appService.buildAndDeploy(app.id, true);

    return NextResponse.json({
        status: "success",
        body: "Deployment triggered.",
    });
});


export async function GET(request: Request) {
    return routeLogic(request);
}

export async function POST(request: Request) {
    return routeLogic(request);
}