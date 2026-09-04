import agentHarnessConfigService from './agent-harness-config.service';
import { ServiceException } from '@/shared/model/service.exception.model';
import type { AgentExtendedModel } from '@/shared/model/agent-extended.model';

function makeAgent(overrides: Partial<AgentExtendedModel> = {}): AgentExtendedModel {
    return {
        id: 'agent-1', name: 'Harness', projectId: 'project-1', llmGatewayId: 'gateway-1',
        modelAlias: ['first-model', 'second-model'],
        llmGateway: { id: 'gateway-1', baseUrl: 'https://litellm.example/' },
        ...overrides,
    } as AgentExtendedModel;
}

describe('agent-harness-config.service', () => {
    it('normalizes LiteLLM URLs and selects the first alias as default', () => {
        expect(agentHarnessConfigService.buildConnection(makeAgent())).toEqual({
            gatewayBaseUrl: 'https://litellm.example', baseUrl: 'https://litellm.example/v1',
            defaultModelAlias: 'first-model', modelAliases: ['first-model', 'second-model'],
        });
    });

    it('does not duplicate v1 when the gateway is configured with its API URL', () => {
        const agent = makeAgent({
            llmGateway: { id: 'gateway-1', baseUrl: 'https://litellm.example/v1' },
        } as Partial<AgentExtendedModel>);
        expect(agentHarnessConfigService.buildConnection(agent)).toMatchObject({
            gatewayBaseUrl: 'https://litellm.example', baseUrl: 'https://litellm.example/v1',
        });
    });

    it('creates a secret-free environment mount and DeepSeek provider config', () => {
        const agent = makeAgent();
        expect(agentHarnessConfigService.buildEnvironment(agent)).toContain('QS_MODEL_ALIAS=first-model');
        const config = agentHarnessConfigService.buildDeepSeekConfig(agent);
        expect(config).toContain('apiKeyEnv: QS_VIRTUAL_KEY');
        expect(config).toContain('baseURL: https://litellm.example/v1');
        expect(config).toContain('- id: second-model');
    });

    it('requires a gateway URL and model alias', () => {
        expect(() => agentHarnessConfigService.buildConnection(makeAgent({ llmGateway: undefined }))).toThrow(ServiceException);
        expect(() => agentHarnessConfigService.buildConnection(makeAgent({ modelAlias: [] }))).toThrow('At least one model alias');
    });
});
