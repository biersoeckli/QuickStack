import { Constants } from "@/shared/utils/constants";
import { AppTemplateModel } from "../../model/app-template.model";
import { AppExtendedModel } from "@/shared/model/app-extended.model";
import { NetworkPolicyTemplateUtils } from "../network-policy-template.utils";

export const wordpressAppTemplate: AppTemplateModel = {
    name: "WordPress",
    description: 'A popular content management system for websites, blogs, and online publishing.',
    websiteUrl: 'https://github.com/WordPress/wordpress-develop',
    iconName: 'wordpress.png',
    templates: [{
        // MariaDB
        inputSettings: [
            {
                key: "containerImageSource",
                label: "Container Image",
                value: "mariadb:11",
                isEnvVar: false,
                randomGeneratedIfEmpty: false,
            },
            {
                key: "MYSQL_PASSWORD",
                label: "Database Passwort",
                value: "",
                isEnvVar: true,
                randomGeneratedIfEmpty: true,
            },
            {
                key: "MYSQL_ROOT_PASSWORD",
                label: "Root Password",
                value: "",
                isEnvVar: true,
                randomGeneratedIfEmpty: true,
            },
        ],
        appModel: {
            name: "MariaDb",
            appType: 'MARIADB',
            sourceType: 'CONTAINER',
            containerImageSource: "",
            replicas: 1,
            ingressNetworkPolicy: Constants.DEFAULT_INGRESS_NETWORK_POLICY_DATABASES,
            egressNetworkPolicy: Constants.DEFAULT_EGRESS_NETWORK_POLICY_DATABASES,
            envVars: `MYSQL_DATABASE=wordpress
MYSQL_USER=wordpress
`,
            useNetworkPolicy: true,
            networkPolicyMode: Constants.DEFAULT_NETWORK_POLICY_MODE_APPS,
            healthCheckPeriodSeconds: 15,
            healthCheckTimeoutSeconds: 5,
            healthCheckFailureThreshold: Constants.DEFAULT_HEALTH_CHECK_FAILURE_THRESHOLD,
        },
        appDomains: [],
        appVolumes: [{
            size: 500,
            containerMountPath: '/var/lib/mysql',
            accessMode: 'ReadWriteOnce',
            storageClassName: 'longhorn',
            shareWithOtherApps: false,
        }],
        appFileMounts: [],
    },
    // WordPress Backend
    {
        inputSettings: [
            {
                key: "containerImageSource",
                label: "Container Image",
                value: "wordpress:latest",
                isEnvVar: false,
                randomGeneratedIfEmpty: false,
            },
        ],
        appModel: {
            name: "WordPress",
            appType: 'APP',
            sourceType: 'CONTAINER',
            containerImageSource: "",
            replicas: 1,
            ingressNetworkPolicy: Constants.DEFAULT_INGRESS_NETWORK_POLICY_APPS,
            egressNetworkPolicy: Constants.DEFAULT_EGRESS_NETWORK_POLICY_APPS,
            envVars: `WORDPRESS_DB_HOST={hostname}:{port}
WORDPRESS_DB_NAME={databaseName}
WORDPRESS_DB_USER={username}
WORDPRESS_DB_PASSWORD={password}
WORDPRESS_TABLE_PREFIX=wp_
`,
            useNetworkPolicy: true,
            networkPolicyMode: Constants.DEFAULT_NETWORK_POLICY_MODE_APPS,
            healthCheckPeriodSeconds: Constants.DEFAULT_HEALTH_CHECK_PERIOD_SECONDS,
            healthCheckTimeoutSeconds: Constants.DEFAULT_HEALTH_CHECK_TIMEOUT_SECONDS,
            healthCheckFailureThreshold: Constants.DEFAULT_HEALTH_CHECK_FAILURE_THRESHOLD,
        },
        appDomains: [],
        appVolumes: [{
            size: 500,
            containerMountPath: '/var/www/html',
            accessMode: 'ReadWriteMany',
            storageClassName: 'longhorn',
            shareWithOtherApps: false,
        }],
        appFileMounts: [{
            containerMountPath: '/usr/local/etc/php/conf.d/custom.ini',
            content: `upload_max_filesize = 100M
post_max_size = 100M
`
        }],
    }]
}

export const postCreateWordpressAppTemplate = async (createdApps: AppExtendedModel[]): Promise<AppExtendedModel[]> => {
    const mariadbApp = createdApps[0];
    const wordpressApp = createdApps[1];

    if (!mariadbApp || !wordpressApp) {
        throw new Error('Created templates for MariaDB or WordPress not found.');
    }

    NetworkPolicyTemplateUtils.allowAppConnection(wordpressApp, mariadbApp, 3306);
    return [mariadbApp, wordpressApp];
};
