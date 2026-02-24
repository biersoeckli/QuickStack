import { AppExtendedModel } from "@/shared/model/app-extended.model";
import { AppTemplateContentModel, AppTemplateInputSettingsModel } from "@/shared/model/app-template.model";
import { DatabaseTemplateInfoModel, databaseTemplateInfoZodModel } from "@/shared/model/database-template-info.model";
import { ServiceException } from "@/shared/model/service.exception.model";
import crypto from "crypto";
import { EnvVarUtils } from "./env-var.utils";
import { KubeObjectNameUtils } from "./kube-object-name.utils";

export class AppTemplateUtils {
    static mapTemplateInputValuesToApp(appTemplate: AppTemplateContentModel,
        inputValues: AppTemplateInputSettingsModel[]) {

        this.populateRandomValues(inputValues);

        const app = { ...appTemplate.appModel };

        const envVariables = inputValues.filter(x => x.isEnvVar);
        const otherConfigValues = inputValues.filter(x => !x.isEnvVar);

        for (const envVariable of envVariables) {
            app.envVars += `${envVariable.key}=${envVariable.value}\n`;
        }

        for (const configValue of otherConfigValues) {
            (app as any)[configValue.key] = configValue.value;
        }

        return app;
    }

    /**
     * Replaces placeholders in the env variables with the database information.
     *
     * params:
     * - {databaseName}
     * - {username}
     * - {password}
     * - {port}
     * - {hostname}
     */
    static replacePlaceholdersInEnvVariablesWithDatabaseInfo(app: AppExtendedModel, databaseInfo: DatabaseTemplateInfoModel) {
        app.envVars = app.envVars.replaceAll(/\{databaseName\}/g, databaseInfo.databaseName);
        app.envVars = app.envVars.replaceAll(/\{username\}/g, databaseInfo.username);
        app.envVars = app.envVars.replaceAll(/\{password\}/g, databaseInfo.password);
        app.envVars = app.envVars.replaceAll(/\{port\}/g, databaseInfo.port + '');
        app.envVars = app.envVars.replaceAll(/\{hostname\}/g, databaseInfo.hostname);
    }

    static populateRandomValues(inputValues: AppTemplateInputSettingsModel[]) {
        for (const input of inputValues) {
            if (input.randomGeneratedIfEmpty && !input.value) {
                input.value = crypto.randomBytes(16).toString('hex');
            }
        }
    }

    static getRandomKey(hexCharsCount = 32): string {
        return crypto.randomBytes(hexCharsCount / 2).toString('hex');
    }

    /**
     * Generates a strong password that contains at least
     * one uppercase letter, one lowercase letter, one number, and one special character.
     * Valid length range: 10-72 characters.
     */
    static generateStrongPasswort(length = 25): string {
        if (length < 10 || length > 72) {
            throw new ServiceException('Password must be 10-72 characters long');
        }
        const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const lowercase = 'abcdefghijklmnopqrstuvwxyz';
        const numbers = '0123456789';
        const special = '!$%*()-_+[]{};,.';
        const all = uppercase + lowercase + numbers + special;

        // Guarantee at least one character from each required category
        const required = [
            uppercase[crypto.randomInt(uppercase.length)],
            lowercase[crypto.randomInt(lowercase.length)],
            numbers[crypto.randomInt(numbers.length)],
            special[crypto.randomInt(special.length)],
        ];

        const remaining = Array.from({ length: length - required.length }, () =>
            all[crypto.randomInt(all.length)]
        );

        const combined = [...required, ...remaining];

        // Fisher-Yates shuffle to avoid predictable positions
        for (let i = combined.length - 1; i > 0; i--) {
            const j = crypto.randomInt(i + 1);
            [combined[i], combined[j]] = [combined[j], combined[i]];
        }

        return combined.join('');
    }

    static getDatabaseModelFromApp(app: AppExtendedModel): DatabaseTemplateInfoModel {
        if (app.appType === 'APP') {
            throw new ServiceException('Cannot retreive database infos from app');
        }
        let returnVal: DatabaseTemplateInfoModel;
        const envVars = EnvVarUtils.parseEnvVariables(app);
        const port = app.appPorts.find(x => !!x.port)?.port!;
        const hostname = KubeObjectNameUtils.toServiceName(app.id);
        if (app.appType === 'MONGODB') {
            returnVal = {
                databaseName: envVars.find(x => x.name === 'MONGO_INITDB_DATABASE')?.value!,
                username: envVars.find(x => x.name === 'MONGO_INITDB_ROOT_USERNAME')?.value!,
                password: envVars.find(x => x.name === 'MONGO_INITDB_ROOT_PASSWORD')?.value!,
                port,
                hostname,
                internalConnectionUrl: `mongodb://${hostname}:${port}/${envVars.find(x => x.name === 'MONGO_INITDB_DATABASE')?.value!}`,
            };
        } else if (app.appType === 'MYSQL') {
            returnVal = {
                databaseName: envVars.find(x => x.name === 'MYSQL_DATABASE')?.value!,
                username: envVars.find(x => x.name === 'MYSQL_USER')?.value!,
                password: envVars.find(x => x.name === 'MYSQL_PASSWORD')?.value!,
                port,
                hostname,
                internalConnectionUrl: `mysql://${envVars.find(x => x.name === 'MYSQL_USER')?.value!}:${envVars.find(x => x.name === 'MYSQL_PASSWORD')?.value!}@${hostname}:${port}/${envVars.find(x => x.name === 'MYSQL_DATABASE')?.value!}`,
            };
        } else if (app.appType === 'POSTGRES') {
            returnVal = {
                databaseName: envVars.find(x => x.name === 'POSTGRES_DB')?.value!,
                username: envVars.find(x => x.name === 'POSTGRES_USER')?.value!,
                password: envVars.find(x => x.name === 'POSTGRES_PASSWORD')?.value!,
                port,
                hostname,
                internalConnectionUrl: `postgresql://${envVars.find(x => x.name === 'POSTGRES_USER')?.value!}:${envVars.find(x => x.name === 'POSTGRES_PASSWORD')?.value!}@${hostname}:${port}/${envVars.find(x => x.name === 'POSTGRES_DB')?.value!}`,
            };
        } else if (app.appType === 'MARIADB') {
            returnVal = {
                databaseName: envVars.find(x => x.name === 'MYSQL_DATABASE')?.value!,
                username: envVars.find(x => x.name === 'MYSQL_USER')?.value!,
                password: envVars.find(x => x.name === 'MYSQL_PASSWORD')?.value!,
                port,
                hostname,
                internalConnectionUrl: `mariadb://${envVars.find(x => x.name === 'MYSQL_USER')?.value!}:${envVars.find(x => x.name === 'MYSQL_PASSWORD')?.value!}@${hostname}:${port}/${envVars.find(x => x.name === 'MYSQL_DATABASE')?.value!}`,
            };
        } else if (app.appType === 'REDIS') {
            let password = '';
            if (app.containerArgs) {
                try {
                    const args = JSON.parse(app.containerArgs);
                    password = args.find((x: string) => x === '--requirepass') ? args[args.findIndex((x: string) => x === '--requirepass') + 1] : '';
                } catch (e) {
                    console.error('Error parsing container args for redis password', e);
                }
            }
            returnVal = {
                databaseName: '',
                username: '',
                password,
                port,
                hostname,
                internalConnectionUrl: password ? `redis://:${password}@${hostname}:${port}` : `redis://${hostname}:${port}`,
            };
        } else {
            throw new ServiceException('Unknown database type, could not load database information.');
        }

        const parseReturn = databaseTemplateInfoZodModel.safeParse(returnVal);
        if (!parseReturn.success) {
            console.error('Error parsing database info');
            console.error('input', app);
            console.error('database info', returnVal);
            console.error('errors', parseReturn.error);
            throw new ServiceException('Error parsing database info');
        }
        return returnVal;
    }
}