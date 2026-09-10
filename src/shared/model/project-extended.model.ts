import { Agent, App, Project } from "@prisma/client";

export type ProjectExtendedModel = Project & {
    apps: App[];
    agents: Agent[];
}

export type ProjectWorkloadNavigationModel = {
    id: string;
    name: string;
};

/** Project scalars plus only the workload id/name needed for sidebar navigation. */
export type ProjectNavigationModel = Project & {
    apps: ProjectWorkloadNavigationModel[];
    agents: ProjectWorkloadNavigationModel[];
};

/** Project scalars plus aggregate workload counts needed for the projects table. */
export type ProjectWithCountsModel = Project & {
    _count: {
        apps: number;
        agents: number;
    };
};
