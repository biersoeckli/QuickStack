import { AppTemplateContentModel, AppTemplateInputSettingsModel, AppTemplateModel } from "@/shared/model/app-template.model";
import { ServiceException } from "@/shared/model/service.exception.model";
import appService from "./app.service";
import { allTemplates, postCreateTemplateFunctions } from "@/shared/templates/all.templates";
import { AppTemplateUtils } from "../utils/app-template.utils";
import { DatabaseTemplateInfoModel } from "@/shared/model/database-template-info.model";
import { AppExtendedModel } from "@/shared/model/app-extended.model";
import dataAccess from "../adapter/db.client";
import { Prisma } from "@prisma/client";

class AppTemplateService {

    async createAppFromTemplate(projectId: string, template: AppTemplateModel) {
        if (!allTemplates.find(x => x.name === template.name)) {
            throw new ServiceException(`Template with name '${template.name}' not found.`);
        }

        return await dataAccess.client.$transaction(async (tx) => {
            let databaseInfo: DatabaseTemplateInfoModel | undefined;

            const createdTemplates: AppExtendedModel[] = [];

            for (const tmpl of template.templates) {
                const createdAppId = await this.createAppFromTemplateContent(projectId, tmpl, tmpl.inputSettings, tx);
                let extendedApp = await appService.getExtendedById(createdAppId, false, tx);

                // used for templates with multiple apps and a database
                if (databaseInfo) {
                    AppTemplateUtils.replacePlaceholdersInEnvVariablesWithDatabaseInfo(extendedApp, databaseInfo);
                    await appService.save({
                        id: createdAppId,
                        envVars: extendedApp.envVars
                    }, false, tx);
                    extendedApp = await appService.getExtendedById(createdAppId, false, tx);
                }
                if (extendedApp.appType !== 'APP') {
                    databaseInfo = AppTemplateUtils.getDatabaseModelFromApp(extendedApp);
                }
                createdTemplates.push(extendedApp);
            }

            // run post create function if exists for this template
            const postFunctionForTempalte = postCreateTemplateFunctions.get(template.name);
            if (postFunctionForTempalte) {
                const updatedApps = await postFunctionForTempalte(createdTemplates);
                // save updated apps todo
                for (const app of updatedApps) {
                    await appService.saveAppExtendedModel(app, tx);
                }
            }
        });
    }

    private async createAppFromTemplateContent(projectId: string, template: AppTemplateContentModel,
        inputValues: AppTemplateInputSettingsModel[], tx: Prisma.TransactionClient) {

        const mappedApp = AppTemplateUtils.mapTemplateInputValuesToApp(template, inputValues);
        const createdApp = await appService.save({
            ...mappedApp,
            projectId
        }, false, tx);

        for (const domain of template.appDomains) {
            await appService.saveDomain({
                ...domain,
                appId: createdApp.id
            }, tx);
        }

        for (const volume of template.appVolumes) {
            await appService.saveVolume({
                ...volume,
                appId: createdApp.id
            }, tx);
        }

        for (const fileMount of template.appFileMounts) {
            await appService.saveFileMount({
                ...fileMount,
                appId: createdApp.id
            }, tx);
        }

        for (const port of template.appPorts) {
            await appService.savePort({
                ...port,
                appId: createdApp.id
            }, tx);
        }

        return createdApp.id;
    }
}

const appTermplateService = new AppTemplateService();
export default appTermplateService;
