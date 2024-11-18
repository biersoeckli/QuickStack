import * as crypto from 'crypto';

export class StringUtils {

    private static readonly MAX_OBJECT_NAME_LENGTH = 30; // in Kubernetes, the maximum length of an object name is 63 characters

    static toSnakeCase(str: string): string {
        if (!str) {
            return str;
        }
        return str
            .replace(/([a-z])([A-Z])/g, '$1_$2')   // Insert underscore between camel case boundaries
            .replace(/\s+/g, '_')                   // Replace spaces with underscores
            .replace(/[^\w_]+/g, '')                // Remove any non-alphanumeric characters except underscores
            .toLowerCase();                         // Convert to lowercase
    }

    static toObjectId(str: string): string {
        let snakeCase = StringUtils.toSnakeCase(str);
        const randomString = crypto.randomBytes(4).toString('hex');
        snakeCase = `${snakeCase}-${randomString}`;
        return snakeCase
            .replace(/_/g, '-')                     // Replace underscores with hyphens
            .replace(/[^a-zA-Z0-9-]+/g, '')         // Remove any non-alphanumeric characters except hyphens
            .toLowerCase();                         // Convert to lowercase
    }

    static toProjectId(str: string): string {
        str = str.substring(0, StringUtils.MAX_OBJECT_NAME_LENGTH).trim();
        return `proj-${StringUtils.toObjectId(str)}`;
    }

    static toAppId(str: string): string {
        str = str.substring(0, StringUtils.MAX_OBJECT_NAME_LENGTH).trim();
        return `app-${StringUtils.toObjectId(str)}`;
    }

    static toJobName(appId: string) {
        return `build-${appId}`;
    }

    static addRandomSuffix(str: string): string {
        // added suffix is 8 characters long
        const randomString = crypto.randomBytes(4).toString('hex');
        return `${str}-${randomString}`;
    }

    static toServiceName(appId: string) {
        return `svc-${appId}`;
    }

    static toPvcName(volumeId: string): `pvc-${string}` {
        return `pvc-${volumeId}`;
    }

    static getIngressName(domainId: string) {
        return `ingress-${domainId}`;
    }
}