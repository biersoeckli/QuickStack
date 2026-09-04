import type { AgentExtendedModel } from '@/shared/model/agent-extended.model';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { agentTemplateZodModel } from '@/shared/model/agent-template.model';
import { buildLiteLlmEnvironment } from './agent-harness-template.utils';
import { claudeCodeAgentTemplate, postCreateClaudeCodeTemplate } from './claude-code.template';
import { copilotCliAgentTemplate, postCreateCopilotCliTemplate } from './copilot-cli.template';
import { deepSeekHarnessCliAgentTemplate, postCreateDeepSeekHarnessCliTemplate } from './deepseek-harness-cli.template';
import { geminiCliAgentTemplate, postCreateGeminiCliTemplate } from './gemini-cli.template';
import { opencodeCliAgentTemplate } from './opencode-cli.template';
import { opencodeAgentTemplate } from './opencode.template';

function makeAgent(): AgentExtendedModel {
    return {
        id: 'agent-1', projectId: 'project-1', modelAlias: ['model-a', 'model-b'],
        llmGateway: { baseUrl: 'https://litellm.example/v1' }, agentFileMounts: [],
    } as unknown as AgentExtendedModel;
}

describe('Agent harness templates', () => {
    it('registers six valid Agent Templates', () => {
        const templates = [opencodeAgentTemplate, opencodeCliAgentTemplate, geminiCliAgentTemplate, copilotCliAgentTemplate, claudeCodeAgentTemplate, deepSeekHarnessCliAgentTemplate];
        expect(templates.map((template) => template.name)).toEqual(['OpenCode Web', 'OpenCode CLI', 'Gemini CLI', 'GitHub Copilot CLI', 'Claude Code CLI', 'DeepSeek Harness CLI']);
        templates.forEach((template) => expect(agentTemplateZodModel.parse(template)).toEqual(template));
    });

    it('provides local logos, descriptions, and website links for every Agent Template', () => {
        const templates = [opencodeAgentTemplate, opencodeCliAgentTemplate, geminiCliAgentTemplate, copilotCliAgentTemplate, claudeCodeAgentTemplate, deepSeekHarnessCliAgentTemplate];
        for (const template of templates) {
            expect(template.iconName).toMatch(/\.svg$/);
            expect(existsSync(join(process.cwd(), 'public/template-icons', template.iconName!))).toBe(true);
            expect(template.description).toBeTruthy();
            expect(template.websiteUrl).toMatch(/^https:\/\//);
        }
    });

    it('normalizes LiteLLM and keeps the Agent Runtime Secret out of file mounts', () => {
        const config = buildLiteLlmEnvironment(makeAgent());
        expect(config.baseUrl).toBe('https://litellm.example/v1');
        expect(config.environment).toContain('QS_MODEL_ALIAS=model-a');
        expect(config.environment).not.toContain('QS_VIRTUAL_KEY=');
    });

    it('writes readable, pinned bootstrap scripts for runtime-installed CLIs', async () => {
        const cases = [
            [postCreateGeminiCliTemplate, 'Gemini CLI', '@google/gemini-cli@0.58.0', 'gemini'],
            [postCreateCopilotCliTemplate, 'GitHub Copilot CLI', '@github/copilot@1.0.82', 'copilot'],
            [postCreateClaudeCodeTemplate, 'Claude Code CLI', '@anthropic-ai/claude-code@2.1.260', 'claude'],
            [postCreateDeepSeekHarnessCliTemplate, 'DeepSeek Harness CLI', '@deepseek-ai/dsh@0.1.2-rc.1', 'dsh'],
        ] as const;
        for (const [postCreate, templateName, packageSpec, binary] of cases) {
            const [agent] = await postCreate([makeAgent()], { templateName, templates: [] });
            const bootstrap = agent.agentFileMounts.find((mount) => mount.containerMountPath === '/workspace/quickstack-bootstrap.sh');
            expect(bootstrap?.content).toContain(packageSpec);
            expect(bootstrap?.content).toContain(`/usr/local/bin/${binary}`);
            expect(bootstrap?.content).toContain('exec sleep infinity');
        }
    });

    it('injects provider settings into the runtime secret for every CLI harness', async () => {
        const cases = [
            [postCreateGeminiCliTemplate, 'Gemini CLI', 'GEMINI_API_KEY'],
            [postCreateCopilotCliTemplate, 'GitHub Copilot CLI', 'COPILOT_PROVIDER_API_KEY'],
            [postCreateClaudeCodeTemplate, 'Claude Code CLI', 'ANTHROPIC_AUTH_TOKEN'],
            [postCreateDeepSeekHarnessCliTemplate, 'DeepSeek Harness CLI', 'DSH_HOME'],
        ] as const;
        for (const [postCreate, templateName, requiredVariable] of cases) {
            const [agent] = await postCreate([makeAgent()], { templateName, templates: [] });
            const environment = JSON.parse(agent.encryptedEnvVars ?? '[]') as Array<{ name: string; value: string }>;
            expect(environment).toContainEqual(expect.objectContaining({ name: 'QS_LITELLM_BASE_URL' }));
            expect(environment).toContainEqual(expect.objectContaining({ name: requiredVariable }));
        }
    });

    it('uses a Node base image and a pinned Gemini CLI bootstrap script', async () => {
        expect(geminiCliAgentTemplate.templates[0].containerImageSource).toBe('');
        expect(geminiCliAgentTemplate.templates[0].inputSettings[0].value).toBe('node:24-bookworm');
        const [agent] = await postCreateGeminiCliTemplate([makeAgent()], { templateName: 'Gemini CLI', templates: [] });
        const bootstrap = agent.agentFileMounts.find((mount) => mount.containerMountPath === '/workspace/quickstack-bootstrap.sh');
        expect(bootstrap?.content).toContain('@google/gemini-cli@0.58.0');
        expect(bootstrap?.content).toContain('/usr/local/bin/gemini');
    });

    it('configures Gemini CLI with the LiteLLM Proxy root URL', async () => {
        const [agent] = await postCreateGeminiCliTemplate([makeAgent()], { templateName: 'Gemini CLI', templates: [] });
        const environment = JSON.parse(agent.encryptedEnvVars ?? '[]') as Array<{ name: string; value: string }>;

        expect(environment).toContainEqual({
            name: 'GOOGLE_GEMINI_BASE_URL',
            value: 'https://litellm.example',
        });
        expect(environment).toContainEqual({
            name: 'GEMINI_MODEL',
            value: 'model-a',
        });
    });
});
