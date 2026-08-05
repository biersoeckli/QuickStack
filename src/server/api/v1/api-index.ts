import { fromTypes, openapi } from '@elysiajs/openapi';
import { Elysia } from 'elysia';
import { ApiUtils } from '../../utils/api-response.utils';
import { projectRoutes } from './project/route';
import { appRoutes } from './app/route';
import { appDeployRoutes } from './app/deploy/route';
import { agentRoutes } from './agent/route';
import { agentDeployRoutes } from './agent/deploy/route';
import { agentSandboxRoutes } from './agent/sandbox/route';

export const v1Api = new Elysia({ prefix: '/api/v1' })
    .derive(ApiUtils.deriveFunc)
    .use(openapi({
        path: '/openapi',
        specPath: '/openapi.json',
        references: fromTypes(),
        mapJsonSchema: {
            zod: ApiUtils.toJsonSchema
        },
        documentation: {
            info: {
                title: 'QuickStack REST API',
                version: '1.0.0',
                description: 'This is the REST API for QuickStack. Furhter details about QuickStack can be found in the [documentation](https://quickstack.dev).',
            },
            tags: [
                { name: 'Projects', description: 'CRUD operations for manging projects.' },
                { name: 'Apps', description: 'CRUD, deploy and monitoring operations for app workloads.' },
                { name: 'Agents', description: 'CRUD and deploy operations for agent templates. Agent templates are a definition of a structure of an agent. Running agents are called "Agent Sandboxes".' },
                { name: 'Agent Sandboxes', description: 'Start/Stop operations for agent sandboxes (running instances of an agent) and APIs to interact with running agent sandbox instances.' },
            ],
            components: {
                securitySchemes: {
                    bearerAuth: {
                        type: 'http',
                        scheme: 'bearer'
                    }
                }
            }
        }
    }))
    .onError(({ error }) => {
        if (error instanceof Response) {
            return error;
        }
        return ApiUtils.mapError(error);
    })
    .use(projectRoutes)
    .use(appRoutes)
    .use(agentRoutes)
    .use(agentDeployRoutes)
    .use(agentSandboxRoutes)
    .use(appDeployRoutes);
