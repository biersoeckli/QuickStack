import { agentTemplateZodModel } from '@/shared/model/agent-template.model';
import {
    claudeCodeAgentTemplate, copilotCliAgentTemplate, deepSeekHarnessCliAgentTemplate,
    deepSeekHarnessWebAgentTemplate, geminiCliAgentTemplate, opencodeCliAgentTemplate, postCreateCliHarnessTemplate,
} from './cli-harnesses.template';
import { opencodeAgentTemplate } from './opencode.template';
import type { AgentExtendedModel } from '@/shared/model/agent-extended.model';

describe('CLI harness templates', () => {
    const cliTemplates = [opencodeCliAgentTemplate, geminiCliAgentTemplate, copilotCliAgentTemplate, claudeCodeAgentTemplate, deepSeekHarnessCliAgentTemplate];

    it('validates every CLI template and keeps its sandbox alive', () => {
        for (const template of cliTemplates) {
            expect(agentTemplateZodModel.parse(template)).toEqual(template);
            expect(JSON.parse(template.templates[0].containerArgs!)).toEqual(['exec sleep infinity']);
            expect(template.templates[0].agentDomains).toEqual([]);
        }
    });

    it('validates the DeepSeek web template and starts the web profile', () => {
        expect(agentTemplateZodModel.parse(deepSeekHarnessWebAgentTemplate)).toEqual(deepSeekHarnessWebAgentTemplate);
        expect(JSON.parse(deepSeekHarnessWebAgentTemplate.templates[0].containerArgs!)[0]).toContain('qs-dsh web');
    });

    it('registers all seven visible Agent Templates', () => {
        expect([
            opencodeAgentTemplate, ...cliTemplates, deepSeekHarnessWebAgentTemplate,
        ].map((template) => template.name)).toEqual([
            'OpenCode', 'OpenCode CLI', 'Gemini CLI', 'GitHub Copilot CLI', 'Claude Code CLI',
            'DeepSeek Harness CLI', 'DeepSeek Harness Web',
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
            expect.objectContaining({ containerMountPath: '/etc/quickstack/harness.env', content: expect.not.stringContaining('QS_VIRTUAL_KEY=') }),
            expect.objectContaining({ containerMountPath: '/root/.dsh/settings.yaml', content: expect.stringContaining('apiKeyEnv: QS_VIRTUAL_KEY') }),
        ]));
    });
});
