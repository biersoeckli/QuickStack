import { V1Job } from "@kubernetes/client-node";
import { BuildJobBuilder, BuildJobBuilderContext } from "./build-job-builder.interface";
import { AppBuildMethod } from "@/shared/model/app-source-info.model";
import { AppExtendedModel } from "@/shared/model/app-extended.model";
import { createRailpackBuildJob, RailpackBuildOptions } from "./railpack-build-job-builder.utils";

class FrameworkBuildJobBuilder implements BuildJobBuilder {
    readonly buildMethod: AppBuildMethod = 'FRAMEWORK';

    async buildJobDefinition(ctx: BuildJobBuilderContext): Promise<V1Job> {
        return createRailpackBuildJob(ctx, this.buildMethod, this.getFrameworkOptions(ctx));
    }

    private getFrameworkOptions(ctx: BuildJobBuilderContext): RailpackBuildOptions {
        if (ctx.workloadType !== 'app') {
            return {};
        }
        const app = ctx.workload as AppExtendedModel;
        return {
            rootDirectory: app.rootDirectory,
            installCommand: app.installCommand,
            buildCommand: app.buildCommand,
            runCommand: app.runCommand,
            outputDirectory: app.outputDirectory,
            nodeVersion: app.nodeVersion,
        };
    }
}

const frameworkBuildJobBuilder = new FrameworkBuildJobBuilder();
export default frameworkBuildJobBuilder;
