import { Constants } from "@/shared/utils/constants";
import { AppTemplateModel } from "../../model/app-template.model";
import { mariadbAppTemplate } from "../databases/mariadb.template";

export const wordpressAppTemplate: AppTemplateModel = {
    name: "WordPress",
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
        appPorts: [{
            port: 3306,
        }]
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
        appPorts: [{
            port: 80,
        }]
    }]
}