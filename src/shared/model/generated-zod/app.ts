import * as z from "zod"

import { CompleteProject, RelatedProjectModel, CompleteAppDomain, RelatedAppDomainModel, CompleteAppPort, RelatedAppPortModel, CompleteAppVolume, RelatedAppVolumeModel, CompleteAppFileMount, RelatedAppFileMountModel, CompleteAppBasicAuth, RelatedAppBasicAuthModel, CompleteRoleAppPermission, RelatedRoleAppPermissionModel } from "./index"

export const AppModel = z.object({
  id: z.string(),
  name: z.string(),
  appType: z.string(),
  projectId: z.string(),
  sourceType: z.string(),
  containerImageSource: z.string().nullish(),
  containerRegistryUsername: z.string().nullish(),
  containerRegistryPassword: z.string().nullish(),
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
  webhookId: z.string().nullish(),
  ingressNetworkPolicy: z.string(),
  egressNetworkPolicy: z.string(),
  useNetworkPolicy: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export interface CompleteApp extends z.infer<typeof AppModel> {
  project: CompleteProject
  appDomains: CompleteAppDomain[]
  appPorts: CompleteAppPort[]
  appVolumes: CompleteAppVolume[]
  appFileMounts: CompleteAppFileMount[]
  appBasicAuths: CompleteAppBasicAuth[]
  roleAppPermissions: CompleteRoleAppPermission[]
}

/**
 * RelatedAppModel contains all relations on your model in addition to the scalars
 *
 * NOTE: Lazy required in case of potential circular dependencies within schema
 */
export const RelatedAppModel: z.ZodSchema<CompleteApp> = z.lazy(() => AppModel.extend({
  project: RelatedProjectModel,
  appDomains: RelatedAppDomainModel.array(),
  appPorts: RelatedAppPortModel.array(),
  appVolumes: RelatedAppVolumeModel.array(),
  appFileMounts: RelatedAppFileMountModel.array(),
  appBasicAuths: RelatedAppBasicAuthModel.array(),
  roleAppPermissions: RelatedRoleAppPermissionModel.array(),
}))
