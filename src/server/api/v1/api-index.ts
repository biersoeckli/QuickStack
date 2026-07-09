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
                version: '1.0.0'
            },
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
