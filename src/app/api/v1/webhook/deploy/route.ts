import k3s from "@/server/adapter/kubernetes-api.adapter";
import appService from "@/server/services/app.service";
import deploymentService from "@/server/services/deployment.service";
import { getAuthUserSession, simpleRoute } from "@/server/utils/action-wrapper.utils";
import { Informer, V1Pod } from "@kubernetes/client-node";
import { NextResponse } from "next/server";
import { z } from "zod";

// Prevents this route's response from being cached
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    return simpleRoute(async () => {
        const url = new URL(request.url);
        const searchParams = url.searchParams;

        const { id } = z.object({
            id: z.string().min(1),
        }).parse({
            id: searchParams.get("id"),
        });

        const app = await appService.getByWebhookId(id);
        await appService.buildAndDeploy(app.id, true);

        return NextResponse.json({
            status: "success",
            body: "Deployment triggered.",
        });
    });
}