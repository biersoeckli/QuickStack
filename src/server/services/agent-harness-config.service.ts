import { AgentExtendedModel } from "@/shared/model/agent-extended.model";
import { ServiceException } from "@/shared/model/service.exception.model";
import { AgentModelAliasUtils } from "../utils/agent-model-alias.utils";

export type AgentHarnessConnection = {
    baseUrl: string;
    gatewayBaseUrl: string;
    defaultModelAlias: string;
    modelAliases: string[];
};

export type CliHarness = 'gemini' | 'copilot' | 'claude' | 'deepseek';

class AgentHarnessConfigService {
    buildConnection(agent: AgentExtendedModel): AgentHarnessConnection {
        const configuredBaseUrl = agent.llmGateway?.baseUrl?.trim().replace(/\/+$/, '');
        if (!configuredBaseUrl) throw new ServiceException('LLM Gateway base URL is missing for Agent.');
        const gatewayBaseUrl = configuredBaseUrl.endsWith('/v1')
            ? configuredBaseUrl.slice(0, -3)
            : configuredBaseUrl;

        const modelAliases = AgentModelAliasUtils.normalize(agent.modelAlias);
        const defaultModelAlias = modelAliases[0];
        if (!defaultModelAlias) throw new ServiceException('At least one model alias must be selected for Agent.');

        return {
            gatewayBaseUrl,
            baseUrl: `${gatewayBaseUrl}/v1`,
            defaultModelAlias,
            modelAliases,
        };
    }

    buildEnvironment(agent: AgentExtendedModel): string {
        const config = this.buildConnection(agent);
        return [
            `QS_LITELLM_BASE_URL=${config.baseUrl}`,
            `QS_LITELLM_GATEWAY_BASE_URL=${config.gatewayBaseUrl}`,
            `QS_MODEL_ALIAS=${config.defaultModelAlias}`,
            `QS_MODEL_ALIASES=${JSON.stringify(config.modelAliases)}`,
            '',
        ].join('\n');
    }

    buildDeepSeekConfig(agent: AgentExtendedModel): string {
        const config = this.buildConnection(agent);
        return [
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
    }

    buildBootstrapScript(agent: AgentExtendedModel, harness: CliHarness): string {
        this.buildConnection(agent);
        if (harness === 'gemini') {
            return `#!/bin/sh
set -eu
. /workspace/quickstack-harness.env
if [ "$#" -gt 0 ]; then
  export GEMINI_API_KEY="$QS_VIRTUAL_KEY"
  export GEMINI_MODEL="$QS_MODEL_ALIAS"
  export GOOGLE_GEMINI_BASE_URL="$QS_LITELLM_GATEWAY_BASE_URL/gemini"
  exec gemini "$@"
fi
exec sleep infinity
`;
        }
        const toolRoot = `/workspace/.quickstack/${harness}`;
        const install = harness === 'deepseek'
            ? `apt-get update && apt-get install -y --no-install-recommends python3 make g++\nnpm install --prefix "${toolRoot}" --no-save @deepseek-ai/dsh@0.1.2-rc.1`
            : `npm install --prefix "${toolRoot}" --no-save ${harness === 'copilot' ? '@github/copilot@1.0.82' : '@anthropic-ai/claude-code@2.1.260'}`;
        const executable = `${toolRoot}/node_modules/.bin/${harness === 'deepseek' ? 'dsh' : harness === 'copilot' ? 'copilot' : 'claude'}`;
        const wrapperName = `qs-${harness === 'deepseek' ? 'dsh' : harness}`;
        const environment = harness === 'copilot'
            ? `export COPILOT_PROVIDER_TYPE=openai\nexport COPILOT_PROVIDER_BASE_URL="$QS_LITELLM_BASE_URL"\nexport COPILOT_PROVIDER_API_KEY="$QS_VIRTUAL_KEY"\nexport COPILOT_MODEL="$QS_MODEL_ALIAS"\nexport COPILOT_OFFLINE=true`
            : harness === 'claude'
                ? `export ANTHROPIC_BASE_URL="$QS_LITELLM_GATEWAY_BASE_URL"\nexport ANTHROPIC_AUTH_TOKEN="$QS_VIRTUAL_KEY"\nexport ANTHROPIC_API_KEY="$QS_VIRTUAL_KEY"\nexport ANTHROPIC_MODEL="$QS_MODEL_ALIAS"\nexport DISABLE_AUTOUPDATER=1`
                : `export DSH_HOME="${toolRoot}/home"`;
        const deepSeekSetup = harness === 'deepseek'
            ? `mkdir -p "${toolRoot}/home"\ncp /workspace/quickstack-dsh-settings.yaml "${toolRoot}/home/settings.yaml"`
            : '';
        const version = harness === 'copilot' ? '1.0.82' : harness === 'claude' ? '2.1.260' : '0.1.2-rc.1';

        return `#!/bin/sh
set -eu
mkdir -p "${toolRoot}" "/workspace/.quickstack/bin"
if [ ! -f "${toolRoot}/.version" ] || [ "$(cat "${toolRoot}/.version")" != "${version}" ]; then
  rm -rf "${toolRoot}/node_modules" "${toolRoot}/package.json" "${toolRoot}/package-lock.json"
  ${install || ':'}
  printf '%s\\n' "${version}" > "${toolRoot}/.version"
fi
${deepSeekSetup}
cat > "/workspace/.quickstack/bin/${wrapperName}" <<'QS_WRAPPER'
#!/bin/sh
set -eu
. /workspace/quickstack-harness.env
${environment}
exec ${executable} "$@"
QS_WRAPPER
chmod +x "/workspace/.quickstack/bin/${wrapperName}"
exec sleep infinity
`;
    }
}

const agentHarnessConfigService = new AgentHarnessConfigService();
export default agentHarnessConfigService;
