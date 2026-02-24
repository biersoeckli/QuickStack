import { revalidateTag, unstable_cache } from "next/cache";
import dataAccess from "../adapter/db.client";
import { Tags } from "../utils/cache-tag-generator.utils";
import { App, AppBasicAuth, AppDomain, AppFileMount, AppPort, AppVolume, Prisma } from "@prisma/client";
import { AppExtendedModel, AppWithProjectModel } from "@/shared/model/app-extended.model";
import { ServiceException } from "@/shared/model/service.exception.model";
import { KubeObjectNameUtils } from "../utils/kube-object-name.utils";
import deploymentService from "./deployment.service";
import buildService from "./build.service";
import ingressService from "./ingress.service";
import pvcService from "./pvc.service";
import svcService from "./svc.service";
import deploymentLogService, { dlog } from "./deployment-logs.service";
import crypto from "crypto";
import networkPolicyService from "./network-policy.service";
import { AppBasicAuthModel, AppDomainModel, AppFileMountModel, AppModel, AppPortModel, AppVolumeModel } from "@/shared/model/generated-zod";
import { z } from "zod";

class AppService {

    async buildAndDeploy(appId: string, forceBuild: boolean = false) {
        const deploymentId = crypto.randomUUID();
        return await deploymentLogService.catchErrosAndLog(deploymentId, async () => {
            const app = await this.getExtendedById(appId);

            await dlog(deploymentId, `
-----------------------------------------------
 Deployment:   ${deploymentId}
 App:          ${app.id}
 Project:      ${app.projectId}
-----------------------------------------------`, false);

            if (app.sourceType === 'GIT') {
                // first make build
                const [buildJobName, gitCommitHash, buildPromise] = await buildService.buildApp(deploymentId, app, forceBuild);
                buildPromise.then(async () => {
                    console.log('Build job finished, deploying...');
                    dlog(deploymentId, `Starting deployment with output from build "${buildJobName}"`);
                    await deploymentService.createDeployment(deploymentId, app, buildJobName, gitCommitHash);
                });
            } else {
                // only deploy
                await deploymentService.createDeployment(deploymentId, app);
            }
        });
    }

    async deleteById(id: string) {
        const existingApp = await this.getById(id);
        if (!existingApp) {
            return;
        }
        try {
            await svcService.deleteService(existingApp.projectId, existingApp.id);
            await deploymentService.deleteDeploymentIfExists(existingApp.projectId, existingApp.id);
            await ingressService.deleteAllIngressForApp(existingApp.projectId, existingApp.id);
            await pvcService.deleteAllPvcOfApp(existingApp.projectId, existingApp.id);
            await buildService.deleteAllBuildsOfApp(existingApp.id);
            await networkPolicyService.deleteNetworkPolicy(existingApp.id, existingApp.projectId);
            await dataAccess.client.app.delete({
                where: {
                    id
                }
            });
        } finally {
            revalidateTag(Tags.apps(existingApp.projectId));
            revalidateTag(Tags.app(existingApp.id));
            revalidateTag(Tags.projects());
            revalidateTag(Tags.userGroups());
            revalidateTag(Tags.users());
        }
    }

    async getAllAppsByProjectID(projectId: string) {
        return await unstable_cache(async (projectId: string) => await dataAccess.client.app.findMany({
            where: {
                projectId
            },
            include: {
                appPorts: true,
                appDomains: true
            },
            orderBy: {
                name: 'asc'
            }
        }),
            [Tags.apps(projectId)], {
            tags: [Tags.apps(projectId)]
        })(projectId as string);
    }

    async getExtendedById(appId: string, cached = true, tx?: Prisma.TransactionClient): Promise<AppExtendedModel> {
        const include = {
            project: true,
            appDomains: true,
            appVolumes: true,
            appPorts: true,
            appFileMounts: true,
            appBasicAuths: true
        };

        const client = tx || dataAccess.client;
        if (cached) {
            return await unstable_cache(async (id: string) => await client.app.findFirstOrThrow({
                where: {
                    id
                },
                include
            }),
                [Tags.app(appId)], {
                tags: [Tags.app(appId)]
            })(appId);
        } else {
            return await client.app.findFirstOrThrow({
                where: {
                    id: appId
                }, include
            });
        }
    }

    async getById(appId: string) {
        return await unstable_cache(async (id: string) => await dataAccess.client.app.findFirstOrThrow({
            where: {
                id
            }
        }),
            [Tags.app(appId)], {
            tags: [Tags.app(appId)]
        })(appId);
    }

    async getByWebhookId(webhookId: string) {
        return await dataAccess.client.app.findFirstOrThrow({
            where: {
                webhookId
            }
        });
    }

    async save(item: Prisma.AppUncheckedCreateInput | Prisma.AppUncheckedUpdateInput, createDefaultPort = true, tx?: Prisma.TransactionClient) {
        let savedItem: App;
        const client = tx || dataAccess.client;
        try {
            if (item.id) {
                savedItem = await client.app.update({
                    where: {
                        id: item.id as string
                    },
                    data: item
                });
            } else {
                item.id = KubeObjectNameUtils.toAppId(item.name as string);
                savedItem = await client.app.create({
                    data: item as Prisma.AppUncheckedCreateInput
                });
                if (createDefaultPort) {
                    // add default port 80
                    await client.appPort.create({
                        data: {
                            appId: savedItem.id,
                            port: 80
                        }
                    });
                }
            }
        } finally {
            revalidateTag(Tags.apps(item.projectId as string));
            revalidateTag(Tags.app(item.id as string));
            revalidateTag(Tags.projects());
            revalidateTag(Tags.userGroups());
            revalidateTag(Tags.users());
        }
        return savedItem;
    }

    async saveAppExtendedModel(app: AppExtendedModel, tx?: Prisma.TransactionClient) {

        const parsedAppModel = AppModel.parse(app);
        await this.save({
            ...parsedAppModel,
            id: app.id
        }, false, tx);

        // for new objects, make sure some params are optional, wich will be created by prisma
        const optionalParam = z.object({
            id: z.string().optional(),
            createdAt: z.date().optional(),
            updatedAt: z.date().optional(),
        });

        const parsedDomains = AppDomainModel.merge(optionalParam).array().parse(app.appDomains);
        for (const domain of parsedDomains) {
            await this.saveDomain({
                ...domain,
                appId: app.id
            }, tx);
        }

        const parsedVolumes = AppVolumeModel.merge(optionalParam).array().parse(app.appVolumes);
        for (const volume of parsedVolumes) {
            await this.saveVolume({
                ...volume,
                appId: app.id
            }, tx);
        }

        const parsedFileMounts = AppFileMountModel.merge(optionalParam).array().parse(app.appFileMounts);
        for (const fileMount of parsedFileMounts) {
            await this.saveFileMount({
                ...fileMount,
                appId: app.id
            }, tx);
        }

        const parsedPorts = AppPortModel.merge(optionalParam).array().parse(app.appPorts);
        for (const port of parsedPorts) {
            await this.savePort({
                ...port,
                appId: app.id
            }, tx);
        }

        const parsedBasicAuths = AppBasicAuthModel.merge(optionalParam).array().parse(app.appBasicAuths);
        for (const basicAuth of parsedBasicAuths) {
            await this.saveBasicAuth({
                ...basicAuth,
                appId: app.id
            }, tx);
        }
    }

    async regenerateWebhookId(appId: string) {
        const existingApp = await this.getById(appId);

        const randomBytes = crypto.randomBytes(32).toString('hex');
        await this.save({
            ...existingApp,
            webhookId: randomBytes
        });
    }

    async saveDomain(domainToBeSaved: Prisma.AppDomainUncheckedCreateInput | Prisma.AppDomainUncheckedUpdateInput, tx?: Prisma.TransactionClient) {
        let savedItem: AppDomain;
        const client = tx || dataAccess.client;
        const existingApp = await this.getExtendedById(domainToBeSaved.appId as string);
        const existingDomainWithSameHostname = await client.appDomain.findFirst({
            where: {
                hostname: domainToBeSaved.hostname as string,
            }
        });
        try {
            if (domainToBeSaved.id) {
                if (domainToBeSaved.hostname === existingDomainWithSameHostname?.hostname &&
                    domainToBeSaved.id &&
                    domainToBeSaved.id !== existingDomainWithSameHostname?.id) {
                    throw new ServiceException("Hostname is already in use by this or another app.");
                }
                savedItem = await client.appDomain.update({
                    where: {
                        id: domainToBeSaved.id as string
                    },
                    data: domainToBeSaved
                });
            } else {
                if (existingDomainWithSameHostname) {
                    throw new ServiceException("Hostname is already in use by this or another app.");
                }
                savedItem = await client.appDomain.create({
                    data: domainToBeSaved as Prisma.AppDomainUncheckedCreateInput
                });
            }

        } finally {
            revalidateTag(Tags.apps(existingApp.projectId as string));
            revalidateTag(Tags.app(existingApp.id as string));
        }
        return savedItem;
    }

    async getDomainById(id: string) {
        return await dataAccess.client.appDomain.findFirstOrThrow({
            where: {
                id
            }
        });
    }

    async deleteDomainById(id: string) {
        const existingDomain = await dataAccess.client.appDomain.findFirst({
            where: {
                id
            }, include: {
                app: true
            }
        });
        if (!existingDomain) {
            return;
        }
        try {
            await dataAccess.client.appDomain.delete({
                where: {
                    id
                }
            });
        } finally {
            revalidateTag(Tags.app(existingDomain.appId));
            revalidateTag(Tags.apps(existingDomain.app.projectId));
        }
    }

    async getAllVolumesWithApp() {
        return await dataAccess.client.appVolume.findMany({
            include: {
                app: true
            },
            orderBy: {
                appId: 'asc'
            }
        });
    }

    async getVolumeById(id: string) {
        return await dataAccess.client.appVolume.findFirst({
            where: {
                id
            }
        });
    }

    async getShareableVolumesByProjectId(projectId: string, appId: string) {
        return await dataAccess.client.appVolume.findMany({
            where: {
                app: {
                    projectId
                },
                appId: {
                    not: appId
                },
                shareWithOtherApps: true,
                accessMode: 'ReadWriteMany',
                sharedVolumeId: null
            },
            include: {
                app: true
            },
            orderBy: {
                createdAt: 'desc'
            }
        });
    }

    async saveVolume(volumeToBeSaved: Prisma.AppVolumeUncheckedCreateInput | Prisma.AppVolumeUncheckedUpdateInput, tx?: Prisma.TransactionClient) {
        let savedItem: AppVolume;
        const client = tx || dataAccess.client;
        const existingApp = await this.getExtendedById(volumeToBeSaved.appId as string, false, client);
        const existingAppWithSameVolumeMountPath = await client.appVolume.findMany({
            where: {
                appId: volumeToBeSaved.appId as string,
            }
        });

        if (existingAppWithSameVolumeMountPath
            .filter(x => x.id !== volumeToBeSaved.id)
            .some(x => x.containerMountPath === volumeToBeSaved.containerMountPath)) {
            throw new ServiceException("Mount Path is already configured within the same app.");
        }

        try {
            if (volumeToBeSaved.id) {
                savedItem = await client.appVolume.update({
                    where: {
                        id: volumeToBeSaved.id as string
                    },
                    data: volumeToBeSaved
                });
            } else {
                savedItem = await client.appVolume.create({
                    data: volumeToBeSaved as Prisma.AppVolumeUncheckedCreateInput
                });
            }

        } finally {
            revalidateTag(Tags.apps(existingApp.projectId as string));
            revalidateTag(Tags.app(existingApp.id as string));
        }
        return savedItem;
    }

    async deleteVolumeById(id: string) {
        const existingVolume = await dataAccess.client.appVolume.findFirst({
            where: {
                id
            }, include: {
                app: true,
                sharedVolumes: true
            }
        });
        if (!existingVolume) {
            return;
        }

        // get ids of all apps that use this volume as shared volume --> to reset cache
        let additionalAppIds = existingVolume.sharedVolumes.map(v => v.appId);
        try {
            await dataAccess.client.appVolume.delete({
                where: {
                    id
                }
            });
        } finally {
            revalidateTag(Tags.app(existingVolume.appId));
            revalidateTag(Tags.apps(existingVolume.app.projectId));
            for (const appId of additionalAppIds) {
                revalidateTag(Tags.app(appId));
            }
        }
    }

    async saveFileMount(fileMountToBeSaved: Prisma.AppFileMountUncheckedCreateInput | Prisma.AppFileMountUncheckedUpdateInput, tx?: Prisma.TransactionClient) {
        let savedItem: AppFileMount;
        const client = tx || dataAccess.client;
        const existingApp = await this.getExtendedById(fileMountToBeSaved.appId as string, false, client);
        const existingAppWithSameVolumeMountPath = await client.appFileMount.findMany({
            where: {
                appId: fileMountToBeSaved.appId as string,
            }
        });

        if (existingAppWithSameVolumeMountPath.filter(x => x.id !== fileMountToBeSaved.id)
            .some(x => x.containerMountPath === fileMountToBeSaved.containerMountPath)) {
            throw new ServiceException("Mount Path is already configured within the same app.");
        }

        try {
            if (fileMountToBeSaved.id) {
                savedItem = await client.appFileMount.update({
                    where: {
                        id: fileMountToBeSaved.id as string
                    },
                    data: fileMountToBeSaved
                });
            } else {
                savedItem = await client.appFileMount.create({
                    data: fileMountToBeSaved as Prisma.AppFileMountUncheckedCreateInput
                });
            }

        } finally {
            revalidateTag(Tags.apps(existingApp.projectId as string));
            revalidateTag(Tags.app(existingApp.id as string));
        }
        return savedItem;
    }

    async deleteFileMountById(id: string) {
        const existingVolume = await dataAccess.client.appFileMount.findFirst({
            where: {
                id
            }, include: {
                app: true
            }
        });
        if (!existingVolume) {
            return;
        }
        try {
            await dataAccess.client.appFileMount.delete({
                where: {
                    id
                }
            });
        } finally {
            revalidateTag(Tags.app(existingVolume.appId));
            revalidateTag(Tags.apps(existingVolume.app.projectId));
        }
    }

    async savePort(portToBeSaved: Prisma.AppPortUncheckedCreateInput | Prisma.AppPortUncheckedUpdateInput, tx?: Prisma.TransactionClient) {
        let savedItem: AppPort;
        const client = tx || dataAccess.client;
        const existingApp = await this.getExtendedById(portToBeSaved.appId as string, false, client);
        const allPortsOfApp = await client.appPort.findMany({
            where: {
                appId: portToBeSaved.appId as string,
            }
        });
        if (allPortsOfApp.filter(x => x.id !== portToBeSaved.id)
            .some(x => x.port === portToBeSaved.port)) {
            throw new ServiceException("Port is already configured within the same app.");
        }
        try {
            if (portToBeSaved.id) {
                savedItem = await client.appPort.update({
                    where: {
                        id: portToBeSaved.id as string
                    },
                    data: portToBeSaved
                });
            } else {
                savedItem = await client.appPort.create({
                    data: portToBeSaved as Prisma.AppPortUncheckedCreateInput
                });
            }

        } finally {
            revalidateTag(Tags.apps(existingApp.projectId as string));
            revalidateTag(Tags.app(existingApp.id as string));
        }
        return savedItem;
    }

    async getPortById(portId: string) {
        return await dataAccess.client.appPort.findFirstOrThrow({
            where: {
                id: portId
            }
        });
    }

    async deletePortById(id: string) {
        const existingPort = await dataAccess.client.appPort.findFirst({
            where: {
                id
            }, include: {
                app: true
            }
        });
        if (!existingPort) {
            return;
        }
        try {
            await dataAccess.client.appPort.delete({
                where: {
                    id
                }
            });
        } finally {
            revalidateTag(Tags.app(existingPort.appId));
            revalidateTag(Tags.apps(existingPort.app.projectId));
        }
    }

    async saveBasicAuth(itemToBeSaved: Prisma.AppBasicAuthUncheckedCreateInput | Prisma.AppBasicAuthUncheckedUpdateInput, tx?: Prisma.TransactionClient) {
        let savedItem: AppBasicAuth;
        const client = tx || dataAccess.client;
        const existingApp = await this.getExtendedById(itemToBeSaved.appId as string, false, tx);
        try {
            if (itemToBeSaved.id) {
                savedItem = await client.appBasicAuth.update({
                    where: {
                        id: itemToBeSaved.id as string
                    },
                    data: itemToBeSaved
                });
            } else {
                savedItem = await client.appBasicAuth.create({
                    data: itemToBeSaved as Prisma.AppBasicAuthUncheckedCreateInput
                });
            }

        } finally {
            revalidateTag(Tags.apps(existingApp.projectId as string));
            revalidateTag(Tags.app(existingApp.id as string));
        }
        return savedItem;
    }

    async deleteBasicAuthById(id: string) {
        const existingItem = await dataAccess.client.appBasicAuth.findFirst({
            where: {
                id
            }, include: {
                app: true
            }
        });
        if (!existingItem) {
            return;
        }
        try {
            await dataAccess.client.appBasicAuth.delete({
                where: {
                    id
                }
            });
        } finally {
            revalidateTag(Tags.app(existingItem.appId));
            revalidateTag(Tags.apps(existingItem.app.projectId));
        }
    }

    async getBasicAuthById(id: string) {
        return await dataAccess.client.appBasicAuth.findFirstOrThrow({
            where: {
                id
            }
        });
    }

    async getAll() {
        const apps = await dataAccess.client.app.findMany({
            orderBy: {
                name: 'asc'
            },
            include: {
                project: true,
            }
        }) as AppWithProjectModel[];

        apps.sort((a, b) => {
            if (a.project.name.toLocaleLowerCase() < b.project.name.toLocaleLowerCase()) {
                return -1;
            }
            if (a.project.name.toLocaleLowerCase() > b.project.name.toLocaleLowerCase()) {
                return 1;
            }
            if (a.name.toLocaleLowerCase() < b.name.toLocaleLowerCase()) {
                return -1;
            }
            if (a.name.toLocaleLowerCase() > b.name.toLocaleLowerCase()) {
                return 1;
            }
            return 0;
        });
        return apps;
    }
}

const appService = new AppService();
export default appService;
