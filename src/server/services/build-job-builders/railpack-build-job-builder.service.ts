import { V1Job } from "@kubernetes/client-node";
import { BuildJobBuilder, BuildJobBuilderContext } from "./build-job-builder.interface";
import { AppBuildMethod } from "@/shared/model/app-source-info.model";
import { createRailpackBuildJob } from "./railpack-build-job-builder.utils";

export { RAILPACK_FRONTEND_IMAGE } from "./railpack-build-job-builder.utils";

class RailpackBuildJobBuilder implements BuildJobBuilder {

    readonly buildMethod: AppBuildMethod = 'RAILPACK';

    async buildJobDefinition(ctx: BuildJobBuilderContext): Promise<V1Job> {
        return createRailpackBuildJob(ctx, this.buildMethod);
    }
}

const railpackBuildJobBuilder = new RailpackBuildJobBuilder();
export default railpackBuildJobBuilder;
