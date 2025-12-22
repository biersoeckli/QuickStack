import { ServiceException } from "@/shared/model/service.exception.model";
import { KubeObjectNameUtils } from "../../utils/kube-object-name.utils";
import { randomBytes } from "crypto";
import { V1Deployment, V1EnvVar } from "@kubernetes/client-node";
import { Constants } from "@/shared/utils/constants";
import { AppTemplateUtils } from "../../utils/app-template.utils";
import appService from "../app.service";
import { BaseDbToolService } from "./base-db-tool.service";
import configMapService from "../config-map.service";
import { AppExtendedModel } from "@/shared/model/app-extended.model";

class PgAdminService extends BaseDbToolService {

    readonly pgPassPath = '/pgadmin-config/pgpass';
    readonly pgAdminConfigPath = '/pgadmin-config/servers.json';

    constructor() {
        super((app) => KubeObjectNameUtils.toPgAdminId(app));
    }

    async getLoginCredentialsForRunningDbGate(appId: string) {
        return await this.getLoginCredentialsForRunningTool(appId, (deployment) => {
            const username = deployment.spec?.template.spec?.containers[0].env?.find(e => e.name === 'PGADMIN_DEFAULT_EMAIL')?.value;
            const password = deployment.spec?.template.spec?.containers[0].env?.find(e => e.name === 'PGADMIN_DEFAULT_PASSWORD')?.value;
            if (!username || !password) {
                throw new ServiceException('Could not find login credentials for PGAdmin, please restart PGAdmin');
            }
            return { username, password };
        });
    }

    async deleteToolForAppIfExists(appId: string) {
        const app = await appService.getExtendedById(appId);
        await configMapService.deleteConfigMapIfExists(app.projectId, KubeObjectNameUtils.getConfigMapName(this.appIdToToolNameConverter(app.id)));
        await configMapService.deleteConfigMapIfExists(app.projectId, 'pgpass-' + this.appIdToToolNameConverter(app.id));
        await super.deleteToolForAppIfExists(appId);
    }

    async deploy(appId: string) {
        await this.deployToolForDatabase(appId, 80, async (app) => {

            const projectId = app.projectId;
            const appName = this.appIdToToolNameConverter(app.id);
            const configMapName = KubeObjectNameUtils.getConfigMapName(appName);

            const volumeConfigServerJsonFile = await this.createServerJsonConfigMap(configMapName, app);
            const volumeConfigPgPassFile = await this.createPgPassConfigMap(appName, app);

            const authPassword = randomBytes(15).toString('hex');

            const body: V1Deployment = {
                metadata: {
                    name: appName
                },
                spec: {
                    replicas: 1,
                    selector: {
                        matchLabels: {
                            app: appName
                        }
                    },
                    template: {
                        metadata: {
                            labels: {
                                app: appName,
                                [Constants.QS_ANNOTATION_CONTAINER_TYPE]: Constants.QS_ANNOTATION_CONTAINER_TYPE_DB_TOOL
                            },
                            annotations: {
                                [Constants.QS_ANNOTATION_APP_ID]: app.id,
                                [Constants.QS_ANNOTATION_PROJECT_ID]: projectId,
                                deploymentTimestamp: new Date().getTime() + "",
                                "kubernetes.io/change-cause": `Deployment ${new Date().toISOString()}`
                            }
                        },
                        spec: {
                            containers: [
                                {
                                    name: appName,
                                    image: 'dpage/pgadmin4:latest',
                                    imagePullPolicy: 'Always',
                                    env: [
                                        {
                                            name: 'PGADMIN_DEFAULT_EMAIL',
                                            value: 'quickstack@quickstack.dev'
                                        },
                                        {
                                            name: 'PGADMIN_DEFAULT_PASSWORD',
                                            value: authPassword
                                        },
                                        {
                                            name: 'PGADMIN_SERVER_JSON_FILE',
                                            value: this.pgAdminConfigPath
                                        },
                                        {
                                            name: 'PGPASS_FILE',
                                            value: this.pgPassPath // todo has to be chmod 0600
                                        },
                                    ],
                                    readinessProbe: {
                                        httpGet: {
                                            path: '/misc/ping',
                                            port: 80
                                        },
                                        initialDelaySeconds: 30,
                                        periodSeconds: 15,
                                        failureThreshold: 5,
                                    },
                                    volumeMounts: [volumeConfigServerJsonFile.fileVolumeMount, volumeConfigPgPassFile.fileVolumeMount]
                                }
                            ],
                            volumes: [volumeConfigServerJsonFile.fileVolume, volumeConfigPgPassFile.fileVolume]
                        }
                    }
                }
            };
            return body;
        });
    }

    private async createServerJsonConfigMap(configMapName: string, app: AppExtendedModel) {
        const dbCredentials = AppTemplateUtils.getDatabaseModelFromApp(app);
        const configMapManifest = {
            apiVersion: 'v1',
            kind: 'ConfigMap',
            metadata: {
                name: configMapName,
                namespace: app.projectId,
            },
            data: {
                'servers.json': JSON.stringify({
                    "Servers": {
                        "1": {
                            "Name": app.name,
                            "Group": "Servers",
                            "Host": dbCredentials.hostname,
                            "Port": dbCredentials.port,
                            "MaintenanceDB": 'postgres',
                            "Username": dbCredentials.username,
                            "SSLMode": "prefer",
                            "PasswordExecCommand": `echo '${dbCredentials.password}'`, // todo does not work?!
                        }
                    }
                })
            },
        };

        await configMapService.createOrUpdateConfigMap(app.projectId, configMapManifest);
        const volumeConfigServerJsonFile = configMapService.createFileVolumeConfig(configMapName, this.pgAdminConfigPath, 'servers.json');
        return volumeConfigServerJsonFile;
    }

    private async createPgPassConfigMap(appName: string, app: AppExtendedModel) {
        const dbCredentials = AppTemplateUtils.getDatabaseModelFromApp(app);
        const pgPassConfigMapName = 'pgpass-' + appName;
        const configMapManifestPgPass = {
            apiVersion: 'v1',
            kind: 'ConfigMap',
            metadata: {
                name: pgPassConfigMapName,
                namespace: app.projectId,
            },
            data: {
                'pgpass': `${dbCredentials.hostname}:${dbCredentials.port}:postgres:${dbCredentials.username}:${dbCredentials.password}`,
            },
        };
        await configMapService.createOrUpdateConfigMap(app.projectId, configMapManifestPgPass);
        const volumeConfigPgPassFile = configMapService.createFileVolumeConfig(pgPassConfigMapName, this.pgPassPath, 'pgpass');
        return volumeConfigPgPassFile;
    }
}
const pgAdminService = new PgAdminService();
export default pgAdminService;