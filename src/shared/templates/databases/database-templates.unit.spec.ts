import { AppExtendedModel } from '@/shared/model/app-extended.model';
import { postCreateTemplateFunctions } from '@/shared/templates/all.templates';
import { databaseTemplates } from '@/shared/templates/all.templates';

describe('database template post-create functions', () => {
    it.each(databaseTemplates)('disables outgoing internet connections for $name', async (template) => {
        const databaseApp = {
            id: `${template.name.toLowerCase()}-app`,
            appNetworkPolicy: {
                allowInternetAccess: true,
                rules: [],
            },
        } as unknown as AppExtendedModel;

        const postCreateFunction = postCreateTemplateFunctions.get(template.name);

        expect(postCreateFunction).toBeDefined();

        const [createdDatabaseApp] = await postCreateFunction!([databaseApp]);

        expect(createdDatabaseApp.appNetworkPolicy).toMatchObject({
            allowInternetAccess: false,
            rules: [],
        });
    });
});
