import { AppTemplateContentModel, AppTemplateInputSettingsModel, AppTemplateModel } from "@/shared/model/app-template.model";
import { ServiceException } from "@/shared/model/service.exception.model";
import appService from "./app.service";
import { allTemplates } from "@/shared/templates/all.templates";

class AppTemplateService {

    async createAppFromTemplate(projectId: string, template: AppTemplateModel) {
        if (!allTemplates.find(x => x.name === template.name)) {
            throw new ServiceException(`Template with name '${template.name}' not found.`);
        }

        for (const tmpl of template.templates) {
            await this.createAppFromTemplateContent(projectId, tmpl, tmpl.inputSettings);
        }
    }

    private async createAppFromTemplateContent(projectId: string, template: AppTemplateContentModel, inputValues: AppTemplateInputSettingsModel[]) {

        const mappedApp = this.mapTemplateInputValuesToApp(template, inputValues);
        const createdApp = await appService.save({
            ...mappedApp,
            projectId
        });

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

    mapTemplateInputValuesToApp(appTemplate: AppTemplateContentModel,
        inputValues: AppTemplateInputSettingsModel[]) {

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
}

const appTermplateService = new AppTemplateService();
export default appTermplateService;
