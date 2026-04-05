import buildWatchService from "@/server/services/standalone-services/build-watch.service";
import deploymentEventWatchService from "@/server/services/standalone-services/deployment-event-watch.service";
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

        buildWatchService.startWatch();
        deploymentEventWatchService.startWatch();

        return NextResponse.json({ status: "ok" });
    });
}
