import { AgentExtendedModel } from "@/shared/model/agent-extended.model";
import { AgentTemplatePostCreateContext } from "@/shared/model/agent-template.model";
import { AgentFileMount } from "@prisma/client";
import {
    buildLiteLlmEnvironment,
    createCliAgentTemplate,
    setHarnessRuntimeEnvironment,
} from "./agent-harness-template.utils";

const DEEPSEEK_HARNESS_VERSION = '0.1.2-rc.1';
const DEEPSEEK_HARNESS_BOOTSTRAP_SCRIPT = `#!/bin/sh
set -eu
tool_root=/workspace/.quickstack/deepseek
mkdir -p "$tool_root" "$tool_root/home" /workspace/.quickstack/bin
if [ ! -f "$tool_root/.version" ] || [ "$(cat "$tool_root/.version")" != "${DEEPSEEK_HARNESS_VERSION}" ]; then
  rm -rf "$tool_root/node_modules" "$tool_root/package.json" "$tool_root/package-lock.json"
  apt-get update && apt-get install -y --no-install-recommends python3 make g++
  npm install --prefix "$tool_root" --no-save @deepseek-ai/dsh@${DEEPSEEK_HARNESS_VERSION}
  printf '%s\\n' '${DEEPSEEK_HARNESS_VERSION}' > "$tool_root/.version"
fi
cp /workspace/quickstack-dsh-settings.yaml "$tool_root/home/settings.yaml"
cat > /workspace/.quickstack/bin/dsh <<'QS_WRAPPER'
#!/bin/sh
set -eu
. /workspace/quickstack-harness.env
export DSH_HOME=/workspace/.quickstack/deepseek/home
exec /workspace/.quickstack/deepseek/node_modules/.bin/dsh "$@"
QS_WRAPPER
chmod +x /workspace/.quickstack/bin/dsh
ln -sf /workspace/.quickstack/bin/dsh /workspace/.quickstack/bin/qs-dsh
ln -sf /workspace/.quickstack/bin/dsh /usr/local/bin/dsh
exec sleep infinity
`;

export const deepSeekHarnessCliAgentTemplate = createCliAgentTemplate(
    'DeepSeek Harness CLI',
    'node:24-bookworm',
    'exec /bin/sh /workspace/quickstack-bootstrap.sh',
    {
        iconName: 'deepseek-harness.svg',
        description: 'A plugin-based terminal harness for coding agents, with tools, sessions, and configurable providers. It can use QuickStack LiteLLM or a directly configured OpenAI-compatible provider.',
        websiteUrl: 'https://github.com/deepseek-ai/deepseek-harness',
    },
);

export async function postCreateDeepSeekHarnessCliTemplate(
    createdAgents: AgentExtendedModel[],
    _context: AgentTemplatePostCreateContext,
): Promise<AgentExtendedModel[]> {
    const agent = createdAgents[0];
    if (!agent) return createdAgents;
    const config = buildLiteLlmEnvironment(agent);
    setHarnessRuntimeEnvironment(agent, config, [
        { name: 'DSH_HOME', value: '/workspace/.quickstack/deepseek/home' },
    ]);
    const deepSeekConfig = [
        'llm-pi-ai:',
        '  providers:',
        '    quickstack-litellm:',
        '      displayName: QuickStack LiteLLM',
        '      apiKeyEnv: QS_VIRTUAL_KEY',
        '      api: openai-completions',
        `      baseURL: ${config.baseUrl}`,
        '      compat:',
        '        supportsDeveloperRole: false',
        '        maxTokensField: max_tokens',
        '      models:',
        ...config.modelAliases.map((model) => `        - id: ${model}`),
        '',
    ].join('\n');
    agent.agentFileMounts = [
        {
            containerMountPath: '/workspace/quickstack-harness.env',
            content: config.environment,
        } as AgentFileMount,
        {
            containerMountPath: '/workspace/quickstack-bootstrap.sh',
            content: DEEPSEEK_HARNESS_BOOTSTRAP_SCRIPT,
        } as AgentFileMount,
        {
            containerMountPath: '/workspace/quickstack-dsh-settings.yaml',
            content: deepSeekConfig,
        } as AgentFileMount,
    ];
    return [agent];
}
