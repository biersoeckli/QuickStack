import { z } from "zod";
import { AppDomainModel, AppModel, AppPortModel, AppVolumeModel, RelatedAppDomainModel, RelatedAppPortModel, RelatedAppVolumeModel } from "./generated-zod";
import { appSourceTypeZodModel, appTypeZodModel } from "./app-source-info.model";
import { appVolumeTypeZodModel } from "./volume-edit.model";

export const databaseTemplateInfoZodModel = z.object({
    username: z.string(),
    password: z.string(),
    port: z.number(),
    hostname: z.string(),
    databaseName: z.string(),
    internalConnectionUrl: z.string(),
});

export type DatabaseTemplateInfoModel = z.infer<typeof databaseTemplateInfoZodModel>;
