import { AgentExtendedModel } from "@/shared/model/agent-extended.model";
import { AgentTemplatePostCreateContext } from "@/shared/model/agent-template.model";
import { AgentFileMount } from "@prisma/client";
import {
    HARNESS_VIRTUAL_KEY_REFERENCE,
    buildLiteLlmEnvironment,
    createCliAgentTemplate,
    setHarnessRuntimeEnvironment,
} from "./agent-harness-template.utils";

const GEMINI_VERSION = '0.58.0';
const GEMINI_BOOTSTRAP_SCRIPT = `#!/bin/sh
set -eu
tool_root=/workspace/.quickstack/gemini
mkdir -p "$tool_root" /workspace/.quickstack/bin
if [ ! -f "$tool_root/.version" ] || [ "$(cat "$tool_root/.version")" != "${GEMINI_VERSION}" ]; then
  rm -rf "$tool_root/node_modules" "$tool_root/package.json" "$tool_root/package-lock.json"
  npm install --prefix "$tool_root" --no-save @google/gemini-cli@${GEMINI_VERSION}
  printf '%s\\n' '${GEMINI_VERSION}' > "$tool_root/.version"
fi
cat > /workspace/.quickstack/bin/gemini <<'QS_WRAPPER'
#!/bin/sh
set -eu
exec /workspace/.quickstack/gemini/node_modules/.bin/gemini "$@"
QS_WRAPPER
chmod +x /workspace/.quickstack/bin/gemini
ln -sf /workspace/.quickstack/bin/gemini /workspace/.quickstack/bin/qs-gemini
ln -sf /workspace/.quickstack/bin/gemini /usr/local/bin/gemini
exec sleep infinity
`;

export const geminiCliAgentTemplate = createCliAgentTemplate(
    'Gemini CLI',
    'node:24-bookworm',
    'exec /bin/sh /workspace/quickstack-bootstrap.sh',
    {
        iconName: 'gemini-cli.svg',
        description: 'Google\'s terminal coding agent for understanding codebases, editing files, and running commands. It can use QuickStack LiteLLM or Google Gemini directly.',
        websiteUrl: 'https://github.com/google-gemini/gemini-cli',
    },
);

export async function postCreateGeminiCliTemplate(
    createdAgents: AgentExtendedModel[],
    _context: AgentTemplatePostCreateContext,
): Promise<AgentExtendedModel[]> {
    const agent = createdAgents[0];
    if (!agent) return createdAgents;
    const config = buildLiteLlmEnvironment(agent);
    setHarnessRuntimeEnvironment(agent, config, [
        { name: 'GEMINI_API_KEY', value: HARNESS_VIRTUAL_KEY_REFERENCE },
        { name: 'GEMINI_MODEL', value: config.defaultModelAlias },
        { name: 'GOOGLE_GEMINI_BASE_URL', value: `${config.gatewayBaseUrl}/gemini` },
    ]);
    agent.agentFileMounts = [
        {
            containerMountPath: '/workspace/quickstack-harness.env',
            content: config.environment,
        } as AgentFileMount,
        {
            containerMountPath: '/workspace/quickstack-bootstrap.sh',
            content: GEMINI_BOOTSTRAP_SCRIPT,
        } as AgentFileMount,
    ];
    return [agent];
}
