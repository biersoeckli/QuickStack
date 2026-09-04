# CLI harness Agents

QuickStack supplies six Agent Templates: OpenCode Web, OpenCode CLI, Gemini CLI,
GitHub Copilot CLI, Claude Code CLI, and DeepSeek Harness CLI.

Create the Agent with an LLM Gateway and one or more LiteLLM Model Aliases, deploy
it, then start a sandbox. CLI templates deliberately run `sleep infinity`; execute
the installed CLI through the existing command endpoint:

```sh
curl -X POST "$QUICKSTACK_URL/api/v1/agents/$AGENT_ID/sandboxes/$SANDBOX_NAME/commands" \
  -H "Authorization: Bearer $QUICKSTACK_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"command":"copilot -p \"Summarize this repository\"","cwd":"/workspace","timeoutSec":600}'
```

Use `opencode`, `gemini`, `copilot`, `claude`, or `dsh`, according to the template.
The bootstrap script installs pinned CLI versions into the Agent Volume and creates
global wrappers where needed. The LiteLLM endpoint, selected default Model Alias,
and provider-specific variables are injected through the Agent Runtime Secret, so
they are available to terminal commands and the harness process. Gemini CLI uses
the LiteLLM Gateway root URL. For non-Gemini models, configure a Gemini-facing
LiteLLM `router_settings.model_group_alias` (for example, `gemini-2.5-pro` to a
DeepSeek deployment) and select that Gemini-facing alias for the Agent.
they are available in the terminal and in every command API execution.
Do not pass provider API keys to the command endpoint.

OpenCode Web uses port 4096. DeepSeek Harness is currently available as CLI only
because its Web UI binds to loopback and needs a dedicated reverse-proxy sidecar.
