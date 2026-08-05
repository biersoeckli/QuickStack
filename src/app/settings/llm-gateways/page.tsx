'use server'

import BreadcrumbSetter from "@/components/breadcrumbs-setter";
import PageTitle from "@/components/custom/page-title";
import { Button } from "@/components/ui/button";
import llmGatewayService from "@/server/services/llm-gateway.service";
import projectService from "@/server/services/project.service";
import { getAdminUserSession } from "@/server/utils/action-wrapper.utils";
import LlmGatewayEditOverlay from "./llm-gateway-edit-overlay";
import LlmGatewaysTable from "./llm-gateways-table";

export default async function LlmGatewaysPage() {
    await getAdminUserSession();
    const [gateways, projects] = await Promise.all([
        llmGatewayService.getAll(),
        projectService.getAll(),
    ]);

    return (
        <div className="flex-1 space-y-4 pt-6">
            <PageTitle
                title={'LLM Gateways'}
                subtitle={'Manage LiteLLM-compatible gateways for Agent workloads.'}>
                <LlmGatewayEditOverlay projects={projects.filter(project => project.projectType === 'APP')}>
                    <Button>Add LLM Gateway</Button>
                </LlmGatewayEditOverlay>
            </PageTitle>
            <BreadcrumbSetter items={[
                { name: "Settings", url: "/settings/profile" },
                { name: "LLM Gateways" },
            ]} />
            <LlmGatewaysTable gateways={gateways} />
        </div>
    );
}
