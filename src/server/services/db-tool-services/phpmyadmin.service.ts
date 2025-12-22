import { ServiceException } from "@/shared/model/service.exception.model";
import { KubeObjectNameUtils } from "../../utils/kube-object-name.utils";
import { randomBytes } from "crypto";
import { V1Deployment, V1EnvVar } from "@kubernetes/client-node";
import { Constants } from "@/shared/utils/constants";
import podService from "../pod.service";
import { AppTemplateUtils } from "../../utils/app-template.utils";
import appService from "../app.service";
import { PathUtils } from "../../utils/path.utils";
import { FsUtils } from "../../utils/fs.utils";
import path from "path";
import { BaseDbToolService } from "./base-db-tool.service";

class PhpMyAdminService extends BaseDbToolService {

    constructor() {
        super((app) => KubeObjectNameUtils.toPhpMyAdminId(app));
    }

    async getLoginCredentialsForRunningDbGate(appId: string) {
        return await this.getLoginCredentialsForRunningTool(appId, (_, app) => {
            const dbCredentials = AppTemplateUtils.getDatabaseModelFromApp(app);
            return { username: dbCredentials.username, password: dbCredentials.password };
        });
    }

    async deploy(appId: string) {
        await this.deployToolForDatabase(appId, 80, (app) => {
            const appName = this.appIdToToolNameConverter(app.id);
            const projectId = app.projectId;

            const dbCredentials = AppTemplateUtils.getDatabaseModelFromApp(app);

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
                                    image: 'phpmyadmin/phpmyadmin:latest',
                                    imagePullPolicy: 'Always',
                                    env: [
                                        {
                                            name: 'PMA_PORT',
                                            value: dbCredentials.port + ''
                                        },
                                        {
                                            name: 'PMA_HOST',
                                            value: dbCredentials.hostname
                                        },
                                    ]
                                }
                            ],
                        }
                    }
                }
            };
            return body;
        });
    }
}

const phpMyAdminService = new PhpMyAdminService();
export default phpMyAdminService;