import { AgentExtendedModel } from "@/shared/model/agent-extended.model";
import { AgentTemplatePostCreateContext } from "@/shared/model/agent-template.model";
import { AgentFileMount } from "@prisma/client";
import {
    HARNESS_VIRTUAL_KEY_REFERENCE,
    buildLiteLlmEnvironment,
    createCliAgentTemplate,
    setHarnessRuntimeEnvironment,
} from "./agent-harness-template.utils";

const CLAUDE_CODE_VERSION = '2.1.260';
const CLAUDE_CODE_BOOTSTRAP_SCRIPT = `#!/bin/sh
set -eu
tool_root=/workspace/.quickstack/claude
mkdir -p "$tool_root" /workspace/.quickstack/bin
if [ ! -f "$tool_root/.version" ] || [ "$(cat "$tool_root/.version")" != "${CLAUDE_CODE_VERSION}" ]; then
  rm -rf "$tool_root/node_modules" "$tool_root/package.json" "$tool_root/package-lock.json"
  npm install --prefix "$tool_root" --no-save @anthropic-ai/claude-code@${CLAUDE_CODE_VERSION}
  printf '%s\\n' '${CLAUDE_CODE_VERSION}' > "$tool_root/.version"
fi
cat > /workspace/.quickstack/bin/claude <<'QS_WRAPPER'
#!/bin/sh
set -eu
. /workspace/quickstack-harness.env
export ANTHROPIC_BASE_URL="$QS_LITELLM_GATEWAY_BASE_URL"
export ANTHROPIC_AUTH_TOKEN="$QS_VIRTUAL_KEY"
export ANTHROPIC_API_KEY="$QS_VIRTUAL_KEY"
export ANTHROPIC_MODEL="$QS_MODEL_ALIAS"
export DISABLE_AUTOUPDATER=1
exec /workspace/.quickstack/claude/node_modules/.bin/claude "$@"
QS_WRAPPER
chmod +x /workspace/.quickstack/bin/claude
ln -sf /workspace/.quickstack/bin/claude /workspace/.quickstack/bin/qs-claude
ln -sf /workspace/.quickstack/bin/claude /usr/local/bin/claude
exec sleep infinity
`;

export const claudeCodeAgentTemplate = createCliAgentTemplate(
    'Claude Code CLI',
    'node:24-bookworm',
    'exec /bin/sh /workspace/quickstack-bootstrap.sh',
    {
        iconName: 'claude-code.svg',
        description: 'Anthropic\'s terminal coding agent for exploring repositories, implementing changes, and running development workflows. It can use QuickStack LiteLLM or Anthropic directly.',
        websiteUrl: 'https://code.claude.com/docs/en/overview',
    },
);

export async function postCreateClaudeCodeTemplate(
    createdAgents: AgentExtendedModel[],
    _context: AgentTemplatePostCreateContext,
): Promise<AgentExtendedModel[]> {
    const agent = createdAgents[0];
    if (!agent) return createdAgents;
    const config = buildLiteLlmEnvironment(agent);
    setHarnessRuntimeEnvironment(agent, config, [
        { name: 'ANTHROPIC_BASE_URL', value: config.gatewayBaseUrl },
        { name: 'ANTHROPIC_AUTH_TOKEN', value: HARNESS_VIRTUAL_KEY_REFERENCE },
        { name: 'ANTHROPIC_API_KEY', value: HARNESS_VIRTUAL_KEY_REFERENCE },
        { name: 'ANTHROPIC_MODEL', value: config.defaultModelAlias },
        { name: 'DISABLE_AUTOUPDATER', value: '1' },
    ]);
    agent.agentFileMounts = [
        {
            containerMountPath: '/workspace/quickstack-harness.env',
            content: config.environment,
        } as AgentFileMount,
        {
            containerMountPath: '/workspace/quickstack-bootstrap.sh',
            content: CLAUDE_CODE_BOOTSTRAP_SCRIPT,
        } as AgentFileMount,
    ];
    return [agent];
}
