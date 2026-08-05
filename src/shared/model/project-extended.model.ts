import { Agent, App, Project } from "@prisma/client";

export type ProjectExtendedModel = Project & {
    apps: App[];
    agents: Agent[];
}