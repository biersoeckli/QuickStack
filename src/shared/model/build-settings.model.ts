import { stringToOptionalNumber } from "@/shared/utils/zod.utils";
import { z } from "zod";
import { Constants } from "@/shared/utils/constants";

const stringToParallelBuilds = z.preprocess((val) => {
    if (val === null || val === undefined || val === '') {
        return undefined;
    }
    if (typeof val === 'string') {
        const parsed = parseInt(val, 10);
        return Number.isNaN(parsed) ? undefined : parsed;
    }
    return val;
}, z.number().int({
    message: 'Max parallel builds must be a whole number.',
}).min(Constants.DEFAULT_MAX_PARALLEL_BUILDS, {
    message: `Max parallel builds must be between ${Constants.DEFAULT_MAX_PARALLEL_BUILDS} and ${Constants.MAX_PARALLEL_BUILDS_LIMIT}.`,
}).max(Constants.MAX_PARALLEL_BUILDS_LIMIT, {
    message: `Max parallel builds must be between ${Constants.DEFAULT_MAX_PARALLEL_BUILDS} and ${Constants.MAX_PARALLEL_BUILDS_LIMIT}.`,
}));

export const buildSettingsZodModel = z.object({
    maxParallelBuilds: stringToParallelBuilds,
    memoryReservation: stringToOptionalNumber,
    memoryLimit: stringToOptionalNumber,
    cpuReservation: stringToOptionalNumber,
    cpuLimit: stringToOptionalNumber,
    buildNode: z.string().optional().nullable(),
});

export type BuildSettingsModel = z.infer<typeof buildSettingsZodModel>;
