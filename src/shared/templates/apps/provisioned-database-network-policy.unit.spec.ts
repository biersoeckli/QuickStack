import { AppExtendedModel } from '@/shared/model/app-extended.model';
import { postCreateDocmostAppTemplate } from './docmost.template';
import { postCreateLibredeskAppTemplate } from './libredesk.template';
import { postCreateLiteLLMAppTemplate } from './litellm.template';
import { postCreateWordpressAppTemplate } from './wordpress.template';

function createApp(
    id: string,
    appType: AppExtendedModel['appType'],
    envVars = '',
): AppExtendedModel {
    return {
        id,
        appType,
        envVars,
        appFileMounts: [],
        appNetworkPolicy: {
            allowInternetAccess: true,
            rules: [],
        },
    } as unknown as AppExtendedModel;
}

describe('provisioned database network policies', () => {
    it.each([
        {
            name: 'WordPress',
            postCreate: postCreateWordpressAppTemplate,
            apps: () => [
                createApp('wordpress-mariadb', 'MARIADB'),
                createApp('wordpress', 'APP'),
            ],
            databaseIndexes: [0],
        },
        {
            name: 'Docmost',
            postCreate: postCreateDocmostAppTemplate,
            apps: () => [
                createApp('docmost-postgres', 'POSTGRES', 'POSTGRES_DB=docmost\nPOSTGRES_USER=docmost\nPOSTGRES_PASSWORD=secret'),
                createApp('docmost-redis', 'REDIS'),
                createApp('docmost', 'APP'),
            ],
            databaseIndexes: [0, 1],
        },
        {
            name: 'Libredesk',
            postCreate: postCreateLibredeskAppTemplate,
            apps: () => [
                createApp('libredesk-postgres', 'POSTGRES', 'POSTGRES_DB=libredesk\nPOSTGRES_USER=libredesk\nPOSTGRES_PASSWORD=secret'),
                createApp('libredesk-redis', 'REDIS'),
                createApp('libredesk', 'APP'),
            ],
            databaseIndexes: [0, 1],
        },
        {
            name: 'LiteLLM',
            postCreate: postCreateLiteLLMAppTemplate,
            apps: () => [
                createApp('litellm-postgres', 'POSTGRES', 'POSTGRES_DB=litellm\nPOSTGRES_USER=litellm\nPOSTGRES_PASSWORD=secret'),
                createApp('litellm-redis', 'REDIS'),
                createApp('litellm', 'APP'),
            ],
            databaseIndexes: [0, 1],
        },
    ])('disables internet access for databases provisioned by $name', async ({ postCreate, apps, databaseIndexes }) => {
        const createdApps = await postCreate(apps());

        for (const databaseIndex of databaseIndexes) {
            expect(createdApps[databaseIndex].appNetworkPolicy).toMatchObject({
                allowInternetAccess: false,
            });
            expect(createdApps[databaseIndex].appNetworkPolicy?.rules).not.toHaveLength(0);
        }
    });
});
