'use server'

import { Button } from "@/components/ui/button";

import Link from "next/link";
import { getAuthUserSession, getUserSession } from "@/server/utils/action-wrapper.utils";
import projectService from "@/server/services/project.service";
import AppTable from "./apps-table";
import { EditAppDialog } from "./edit-app-dialog";
import appService from "@/server/services/app.service";
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import PageTitle from "@/components/custom/page-title";
import ProjectBreadcrumbs from "./project-breadcrumbs";
import { Plus } from "lucide-react";
import ChooseTemplateDialog from "./choose-template-dialog";


export default async function AppsPage({
    searchParams,
}: {
    searchParams?: { [key: string]: string | undefined };
}) {
    await getAuthUserSession();

    const projectId = searchParams?.projectId;
    if (!projectId) {
        return <p>Could not find project with id {projectId}</p>
    }
    const project = await projectService.getById(projectId);
    const data = await appService.getAllAppsByProjectID(projectId);
    return (
        <div className="flex-1 space-y-4 pt-6">
            <PageTitle
                title="Apps"
                subtitle={`All Apps for Project "${project.name}"`}>
                <ChooseTemplateDialog projectId={projectId}><Button variant="secondary"><Plus /> Create App from Template</Button></ChooseTemplateDialog>
                <EditAppDialog projectId={projectId}><Button><Plus /> Create App</Button></EditAppDialog>
            </PageTitle>
            <AppTable app={data} projectId={project.id} />
            <ProjectBreadcrumbs project={project} />
        </div>
    )
}
