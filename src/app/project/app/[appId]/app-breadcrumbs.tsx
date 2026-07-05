import { AppExtendedModel } from "@/shared/model/app-extended.model";
import WorkloadBreadcrumbs from "@/components/custom/workload-breadcrumbs";

export default function AppBreadcrumbs({ app, apps, tabName }: { app: AppExtendedModel; apps: { id: string; name: string }[]; tabName?: string }) {
    return (
        <WorkloadBreadcrumbs
            projectId={app.projectId}
            projectName={app.project.name}
            workloadId={app.id}
            workloadName={app.name}
            workloads={apps}
            workloadBasePath="/project/app"
            queryParams={{ tabName }}
        />
    );
}
