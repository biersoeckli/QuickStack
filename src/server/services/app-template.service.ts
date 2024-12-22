import { AppTemplateContentModel, AppTemplateInputSettingsModel, AppTemplateModel } from "@/shared/model/app-template.model";
import { ServiceException } from "@/shared/model/service.exception.model";
import appService from "./app.service";
import { allTemplates } from "@/shared/templates/all.templates";
import { AppTemplateUtils } from "../utils/app-template.utils";
import { DatabaseTemplateInfoModel } from "@/shared/model/database-template-info.model";
import { revalidateTag } from "next/cache";
import { Tags } from "../utils/cache-tag-generator.utils";

class AppTemplateService {

    async createAppFromTemplate(projectId: string, template: AppTemplateModel) {
        if (!allTemplates.find(x => x.name === template.name)) {
            throw new ServiceException(`Template with name '${template.name}' not found.`);
        }

        let databaseInfo: DatabaseTemplateInfoModel | undefined;

        for (const tmpl of template.templates) {
            const createdAppId = await this.createAppFromTemplateContent(projectId, tmpl, tmpl.inputSettings);
            const extendedApp = await appService.getExtendedById(createdAppId, false);

            // used for templates with multiple apps and a database
            if (databaseInfo) {
                AppTemplateUtils.replacePlaceholdersInEnvVariablesWithDatabaseInfo(extendedApp, databaseInfo);
                await appService.save({
                    id: createdAppId,
                    envVars: extendedApp.envVars
                });
            }
            if (extendedApp.appType !== 'APP') {
                databaseInfo = AppTemplateUtils.getDatabaseModelFromApp(extendedApp);
            }
        }
    }

    private async createAppFromTemplateContent(projectId: string, template: AppTemplateContentModel,
        inputValues: AppTemplateInputSettingsModel[]) {

        const mappedApp = AppTemplateUtils.mapTemplateInputValuesToApp(template, inputValues);
        const createdApp = await appService.save({
            ...mappedApp,
            projectId
        }, false);

        const savedDomains = await Promise.all(template.appDomains.map(async x => {
            return await appService.saveDomain({
                ...x,
                appId: createdApp.id
            });
        }));

        const savedVolumes = await Promise.all(template.appVolumes.map(async x => {
            return await appService.saveVolume({
                ...x,
                appId: createdApp.id
            });
        }));

        const savedPorts = await Promise.all(template.appPorts.map(async x => {
            return await appService.savePort({
                ...x,
                appId: createdApp.id
            });
        }));

        return createdApp.id;
    }
}

const appTermplateService = new AppTemplateService();
export default appTermplateService;
