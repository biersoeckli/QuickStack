import scheduleService from "@/server/services/standalone-services/schedule.service";
import { simpleRoute } from "@/server/utils/action-wrapper.utils";
import { NextResponse } from "next/server";

// Prevents this route's response from being cached
export const dynamic = "force-dynamic";


export async function GET() {
    return simpleRoute(async () => {
        scheduleService.printScheduledJobs();
        return NextResponse.json({
            status: "success"
        });
    })
}
