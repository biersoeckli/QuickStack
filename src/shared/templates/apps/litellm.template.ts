import { AppTemplateUtils } from "@/server/utils/app-template.utils";
import { AppExtendedModel } from "@/shared/model/app-extended.model";
import { Constants } from "@/shared/utils/constants";
import { AppTemplateModel } from "../../model/app-template.model";
import { getPostgresAppTemplate } from "../databases/postgres.template";
import { getRedisAppTemplate, postCreateRedisAppTemplate } from "../databases/redis.template";
import { NetworkPolicyTemplateUtils } from "../network-policy-template.utils";

export const litellmAppTemplate: AppTemplateModel = {
    name: "LiteLLM",
    description: 'An AI gateway that exposes many language-model providers through a single OpenAI-compatible API.',
    websiteUrl: 'https://github.com/BerriAI/litellm',
    iconName: 'litellm.jpg',
    templates: [
        getPostgresAppTemplate({
            appName: 'LiteLLM PostgreSQL',
            dbName: 'litellm',
            dbUsername: 'litellm'
        }),
        getRedisAppTemplate({
            appName: 'LiteLLM Redis'
        }),
        {
            inputSettings: [
                {
                    key: "containerImageSource",
                    label: "Container Image",
                    value: "ghcr.io/berriai/litellm-database:latest",
                    isEnvVar: false,
                    randomGeneratedIfEmpty: false,
                },
            ],
            appModel: {
                name: "LiteLLM",
                appType: 'APP',
                sourceType: 'CONTAINER',
                containerImageSource: "",
                containerArgs: '["--config", "/app/config.yaml", "--port", "4000"]',
                replicas: 1,
                ingressNetworkPolicy: Constants.DEFAULT_INGRESS_NETWORK_POLICY_APPS,
                egressNetworkPolicy: Constants.DEFAULT_EGRESS_NETWORK_POLICY_APPS,
                envVars: ``,
                useNetworkPolicy: true,
            networkPolicyMode: Constants.DEFAULT_NETWORK_POLICY_MODE_APPS,
                healthCheckPeriodSeconds: Constants.DEFAULT_HEALTH_CHECK_PERIOD_SECONDS,
                healthCheckTimeoutSeconds: Constants.DEFAULT_HEALTH_CHECK_TIMEOUT_SECONDS,
                healthCheckFailureThreshold: Constants.DEFAULT_HEALTH_CHECK_FAILURE_THRESHOLD,
            },
            appDomains: [],
            appVolumes: [],
            appFileMounts: [{
                containerMountPath: '/app/config.yaml',
                content: `model_list: []

general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
  database_url: os.environ/DATABASE_URL
  store_model_in_db: true

router_settings:
  routing_strategy: simple-shuffle
  redis_host: os.environ/REDIS_HOST
  redis_port: os.environ/REDIS_PORT
  redis_password: os.environ/REDIS_PASSWORD

litellm_settings:
  cache: true
  cache_params:
    type: redis
    host: os.environ/REDIS_HOST
    port: os.environ/REDIS_PORT
    password: os.environ/REDIS_PASSWORD
`
            }],
        }
    ],
};

export const postCreateLiteLLMAppTemplate = async (createdApps: AppExtendedModel[]): Promise<AppExtendedModel[]> => {
    const createdPostgresApp = createdApps[0];
    const createdRedisApp = createdApps[1];
    const createdLiteLLMApp = createdApps[2];

    if (!createdPostgresApp || !createdRedisApp || !createdLiteLLMApp) {
        throw new Error('Created templates for PostgreSQL, Redis or LiteLLM not found.');
    }

    await postCreateRedisAppTemplate([createdRedisApp]);

    const postgresConnectionInfo = AppTemplateUtils.getDatabaseModelFromApp(createdPostgresApp);
    const redisConnectionInfo = AppTemplateUtils.getDatabaseModelFromApp(createdRedisApp);

    createdLiteLLMApp.envVars = `DATABASE_URL=${postgresConnectionInfo.internalConnectionUrl}
LITELLM_MASTER_KEY=sk-${AppTemplateUtils.getRandomKey(48)}
LITELLM_SALT_KEY=sk-${AppTemplateUtils.getRandomKey(48)}
STORE_MODEL_IN_DB=true
LITELLM_MODE=PRODUCTION
REDIS_HOST=${redisConnectionInfo.hostname}
REDIS_PORT=${redisConnectionInfo.port}
REDIS_PASSWORD=${redisConnectionInfo.password}
${createdLiteLLMApp.envVars.split('\n').filter(line =>
        !line.startsWith('DATABASE_URL=') &&
        !line.startsWith('LITELLM_MASTER_KEY=') &&
        !line.startsWith('LITELLM_SALT_KEY=') &&
        !line.startsWith('STORE_MODEL_IN_DB=') &&
        !line.startsWith('LITELLM_MODE=') &&
        !line.startsWith('REDIS_HOST=') &&
        !line.startsWith('REDIS_PORT=') &&
        !line.startsWith('REDIS_PASSWORD=')
    ).join('\n')}`;
    NetworkPolicyTemplateUtils.allowAppConnection(createdLiteLLMApp, createdPostgresApp, 5432);
    NetworkPolicyTemplateUtils.allowAppConnection(createdLiteLLMApp, createdRedisApp, 6379);

    return [createdPostgresApp, createdRedisApp, createdLiteLLMApp];
};
