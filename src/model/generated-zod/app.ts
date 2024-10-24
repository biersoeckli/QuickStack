import * as z from "zod"
import * as imports from "../../../prisma/null"
import { CompleteProject, RelatedProjectModel, CompleteAppDomain, RelatedAppDomainModel, CompleteAppVolume, RelatedAppVolumeModel } from "./index"

export const AppModel = z.object({
  id: z.string(),
  name: z.string(),
  projectId: z.string(),
  sourceType: z.string(),
  containerImageSource: z.string().nullish(),
  gitUrl: z.string().nullish(),
  gitBranch: z.string().nullish(),
  gitUsername: z.string().nullish(),
  gitToken: z.string().nullish(),
  dockerfilePath: z.string(),
  replicas: z.number().int(),
  envVars: z.string(),
  memoryReservation: z.number().int().nullish(),
  memoryLimit: z.number().int().nullish(),
  cpuReservation: z.number().int().nullish(),
  cpuLimit: z.number().int().nullish(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export interface CompleteApp extends z.infer<typeof AppModel> {
  project: CompleteProject
  appDomains: CompleteAppDomain[]
  appVolumes: CompleteAppVolume[]
}

/**
 * RelatedAppModel contains all relations on your model in addition to the scalars
 *
 * NOTE: Lazy required in case of potential circular dependencies within schema
 */
export const RelatedAppModel: z.ZodSchema<CompleteApp> = z.lazy(() => AppModel.extend({
  project: RelatedProjectModel,
  appDomains: RelatedAppDomainModel.array(),
  appVolumes: RelatedAppVolumeModel.array(),
}))
