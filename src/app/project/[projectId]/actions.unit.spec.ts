import { z } from 'zod';

vi.mock('@/server/utils/action-wrapper.utils', () => ({
    getAuthUserSession: vi.fn().mockResolvedValue({}),
    isAuthorizedDeleteForProject: vi.fn(),
    saveFormAction: async (input: unknown, schema: z.ZodType, action: (data: unknown) => unknown) => {
        const result = schema.safeParse(input);
        if (!result.success) throw result.error;
        return action(result.data);
    },
    simpleAction: (action: () => unknown) => action(),
}));
vi.mock('@/server/utils/shared-authorization.utils', () => ({
    ensureCreateProjectWorkloadInProject: vi.fn(),
    ensureDeleteProjectWorkloadInProject: vi.fn(),
    ensureWriteProject: vi.fn(),
}));
vi.mock('@/server/services/addons/agent-sandbox-addon.service', () => ({
    default: { isAvailable: vi.fn() },
}));
vi.mock('@/server/services/agent.service', () => ({ default: { saveAgent: vi.fn() } }));
vi.mock('@/server/services/agent-template.service', () => ({ default: { createAgentFromTemplate: vi.fn() } }));
vi.mock('@/server/services/app.service', () => ({ default: {} }));
vi.mock('@/server/services/app-template.service', () => ({ default: {} }));
vi.mock('@/server/services/db-tool-services/dbgate.service', () => ({ default: {} }));
vi.mock('@/server/services/file-browser-service', () => ({ default: {} }));
vi.mock('@/server/services/db-tool-services/phpmyadmin.service', () => ({ default: {} }));
vi.mock('@/server/services/db-tool-services/pgadmin.service', () => ({ default: {} }));
vi.mock('@/server/services/llm-gateway.service', () => ({ default: {} }));
vi.mock('@/server/services/project-network-graph-layout.service', () => ({ default: {} }));
vi.mock('@/server/services/param.service', () => ({
    default: {},
    ParamService: { FEATURE_NEW_NETWORK_POLICY_EXPLENATION: 'feature' },
}));
vi.mock('@/shared/model/app-template.model', () => ({ appTemplateZodModel: z.unknown() }));
vi.mock('@/shared/model/agent-template.model', () => ({ agentTemplateZodModel: z.unknown() }));
vi.mock('@/shared/model/rename-agent.model', () => ({ renameAgentZodModel: z.unknown() }));
vi.mock('@/shared/model/project-network-graph-layout.model', () => ({
    projectNetworkGraphPositionSchema: z.unknown(),
}));

import agentSandboxAddonService from '@/server/services/addons/agent-sandbox-addon.service';
import agentService from '@/server/services/agent.service';
import agentTemplateService from '@/server/services/agent-template.service';
import { createAgent, createAgentFromTemplate } from './actions';

describe('agent creation actions', () => {
    beforeEach(() => {
        vi.mocked(agentSandboxAddonService.isAvailable).mockResolvedValue(false);
    });

    it('rejects direct single-agent creation when the add-on is unavailable', async () => {
        await expect(createAgent('Agent', 'project-1', 'gateway-1', ['model-1']))
            .rejects.toThrow('The Agent Sandbox Add-on is not available.');

        expect(agentService.saveAgent).not.toHaveBeenCalled();
    });

    it('rejects direct template-based agent creation when the add-on is unavailable', async () => {
        await expect(createAgentFromTemplate(null, {}, 'project-1'))
            .rejects.toThrow('The Agent Sandbox Add-on is not available.');

        expect(agentTemplateService.createAgentFromTemplate).not.toHaveBeenCalled();
    });
});
