import { V1Job } from "@kubernetes/client-node";
import { BuildJobBuilder, BuildJobBuilderContext } from "./build-job-builder.interface";
import { AppBuildMethod } from "@/shared/model/app-source-info.model";
import { RailpackBuildJobBuilderUtils } from "./railpack-build-job-builder.utils";

export const RAILPACK_FRONTEND_IMAGE = RailpackBuildJobBuilderUtils.RAILPACK_FRONTEND_IMAGE;

class RailpackBuildJobBuilder implements BuildJobBuilder {

    readonly buildMethod: AppBuildMethod = 'RAILPACK';

    async buildJobDefinition(ctx: BuildJobBuilderContext): Promise<V1Job> {
        return RailpackBuildJobBuilderUtils.createBuildJob(ctx, this.buildMethod);
    }
}

const railpackBuildJobBuilder = new RailpackBuildJobBuilder();
export default railpackBuildJobBuilder;
