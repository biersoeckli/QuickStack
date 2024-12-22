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
            };
        } else if (app.appType === 'MYSQL') {
            returnVal = {
                databaseName: envVars.find(x => x.name === 'MYSQL_DATABASE')?.value!,
                username: envVars.find(x => x.name === 'MYSQL_USER')?.value!,
                password: envVars.find(x => x.name === 'MYSQL_PASSWORD')?.value!,
                port,
                hostname,
            };
        } else if (app.appType === 'POSTGRES') {
            returnVal = {
                databaseName: envVars.find(x => x.name === 'POSTGRES_DB')?.value!,
                username: envVars.find(x => x.name === 'POSTGRES_USER')?.value!,
                password: envVars.find(x => x.name === 'POSTGRES_PASSWORD')?.value!,
                port,
                hostname,
            };
        } else if (app.appType === 'MARIADB') {
            returnVal = {
                databaseName: envVars.find(x => x.name === 'MYSQL_DATABASE')?.value!,
                username: envVars.find(x => x.name === 'MYSQL_USER')?.value!,
                password: envVars.find(x => x.name === 'MYSQL_PASSWORD')?.value!,
                port,
                hostname,
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