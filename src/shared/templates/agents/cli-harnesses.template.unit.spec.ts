import { agentTemplateZodModel } from '@/shared/model/agent-template.model';
import {
    claudeCodeAgentTemplate, copilotCliAgentTemplate, deepSeekHarnessCliAgentTemplate,
    geminiCliAgentTemplate, opencodeCliAgentTemplate, postCreateCliHarnessTemplate,
} from './cli-harnesses.template';
import { opencodeAgentTemplate } from './opencode.template';
import type { AgentExtendedModel } from '@/shared/model/agent-extended.model';

describe('CLI harness templates', () => {
    const cliTemplates = [opencodeCliAgentTemplate, geminiCliAgentTemplate, copilotCliAgentTemplate, claudeCodeAgentTemplate, deepSeekHarnessCliAgentTemplate];

    it('validates every CLI template and starts its configured bootstrap', () => {
        for (const template of cliTemplates) {
            expect(agentTemplateZodModel.parse(template)).toEqual(template);
            const command = JSON.parse(template.templates[0].containerArgs!)[0];
            expect(command).toContain(template.name === 'OpenCode CLI' ? 'sleep infinity' : 'quickstack-bootstrap.sh');
            expect(template.templates[0].agentDomains).toEqual([]);
        }
    });

    it('registers all six visible Agent Templates', () => {
        expect([
            opencodeAgentTemplate, ...cliTemplates,
        ].map((template) => template.name)).toEqual([
            'OpenCode', 'OpenCode CLI', 'Gemini CLI', 'GitHub Copilot CLI', 'Claude Code CLI',
            'DeepSeek Harness CLI',
        ]);
    });

    it('adds LiteLLM configuration mounts without persisting the virtual key', async () => {
        const agent = {
            id: 'agent-1', projectId: 'project-1', modelAlias: ['model-a', 'model-b'],
            llmGateway: { baseUrl: 'https://litellm.example' }, agentFileMounts: [],
        } as unknown as AgentExtendedModel;
        const [updated] = await postCreateCliHarnessTemplate([agent], {
            templateName: 'DeepSeek Harness CLI', templates: [],
        });
        expect(updated.agentFileMounts).toEqual(expect.arrayContaining([
            expect.objectContaining({ containerMountPath: '/workspace/quickstack-harness.env', content: expect.not.stringContaining('QS_VIRTUAL_KEY=') }),
            expect.objectContaining({ containerMountPath: '/workspace/quickstack-bootstrap.sh', content: expect.stringContaining('exec sleep infinity') }),
            expect.objectContaining({ containerMountPath: '/workspace/quickstack-dsh-settings.yaml', content: expect.stringContaining('apiKeyEnv: QS_VIRTUAL_KEY') }),
        ]));
    });
});
