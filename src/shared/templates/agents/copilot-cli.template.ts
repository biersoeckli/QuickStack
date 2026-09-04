import { AgentExtendedModel } from "@/shared/model/agent-extended.model";
import { AgentTemplatePostCreateContext } from "@/shared/model/agent-template.model";
import { AgentFileMount } from "@prisma/client";
import {
    HARNESS_VIRTUAL_KEY_REFERENCE,
    buildLiteLlmEnvironment,
    createCliAgentTemplate,
    setHarnessRuntimeEnvironment,
} from "./agent-harness-template.utils";

const COPILOT_VERSION = '1.0.82';
const COPILOT_BOOTSTRAP_SCRIPT = `#!/bin/sh
set -eu
tool_root=/workspace/.quickstack/copilot
mkdir -p "$tool_root" /workspace/.quickstack/bin
if [ ! -f "$tool_root/.version" ] || [ "$(cat "$tool_root/.version")" != "${COPILOT_VERSION}" ]; then
  rm -rf "$tool_root/node_modules" "$tool_root/package.json" "$tool_root/package-lock.json"
  npm install --prefix "$tool_root" --no-save @github/copilot@${COPILOT_VERSION}
  printf '%s\\n' '${COPILOT_VERSION}' > "$tool_root/.version"
fi
cat > /workspace/.quickstack/bin/copilot <<'QS_WRAPPER'
#!/bin/sh
set -eu
. /workspace/quickstack-harness.env
export COPILOT_PROVIDER_TYPE=openai
export COPILOT_PROVIDER_BASE_URL="$QS_LITELLM_BASE_URL"
export COPILOT_PROVIDER_API_KEY="$QS_VIRTUAL_KEY"
export COPILOT_MODEL="$QS_MODEL_ALIAS"
export COPILOT_OFFLINE=true
exec /workspace/.quickstack/copilot/node_modules/.bin/copilot "$@"
QS_WRAPPER
chmod +x /workspace/.quickstack/bin/copilot
ln -sf /workspace/.quickstack/bin/copilot /workspace/.quickstack/bin/qs-copilot
ln -sf /workspace/.quickstack/bin/copilot /usr/local/bin/copilot
exec sleep infinity
`;

export const copilotCliAgentTemplate = createCliAgentTemplate(
    'GitHub Copilot CLI',
    'node:24-bookworm',
    'exec /bin/sh /workspace/quickstack-bootstrap.sh',
    {
        iconName: 'github-copilot.svg',
        description: 'GitHub\'s terminal coding agent for explaining, changing, and testing code. It can use QuickStack LiteLLM or GitHub Copilot with a directly configured provider.',
        websiteUrl: 'https://github.com/features/copilot',
    },
);

export async function postCreateCopilotCliTemplate(
    createdAgents: AgentExtendedModel[],
    _context: AgentTemplatePostCreateContext,
): Promise<AgentExtendedModel[]> {
    const agent = createdAgents[0];
    if (!agent) return createdAgents;
    const config = buildLiteLlmEnvironment(agent);
    setHarnessRuntimeEnvironment(agent, config, [
        { name: 'COPILOT_PROVIDER_TYPE', value: 'openai' },
        { name: 'COPILOT_PROVIDER_BASE_URL', value: config.baseUrl },
        { name: 'COPILOT_PROVIDER_API_KEY', value: HARNESS_VIRTUAL_KEY_REFERENCE },
        { name: 'COPILOT_MODEL', value: config.defaultModelAlias },
        { name: 'COPILOT_OFFLINE', value: 'true' },
    ]);
    agent.agentFileMounts = [
        {
            containerMountPath: '/workspace/quickstack-harness.env',
            content: config.environment,
        } as AgentFileMount,
        {
            containerMountPath: '/workspace/quickstack-bootstrap.sh',
            content: COPILOT_BOOTSTRAP_SCRIPT,
        } as AgentFileMount,
    ];
    return [agent];
}
