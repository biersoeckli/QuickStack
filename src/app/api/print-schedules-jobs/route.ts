import k3s from "@/server/adapter/kubernetes-api.adapter";
import appService from "@/server/services/app.service";
import deploymentService from "@/server/services/deployment.service";
import scheduleService from "@/server/services/standalone-services/schedule.service";
import { getAuthUserSession, simpleRoute } from "@/server/utils/action-wrapper.utils";
import { Informer, V1Pod } from "@kubernetes/client-node";
import { NextResponse } from "next/server";
import { z } from "zod";

// Prevents this route's response from being cached
export const dynamic = "force-dynamic";


export async function GET(request: Request) {
    return simpleRoute(async () => {
        scheduleService.printScheduledJobs();
        return NextResponse.json({
            status: "success"
        });
    })
}