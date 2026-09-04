# CLI harness Agents

QuickStack supplies six Agent Templates: OpenCode Web, OpenCode CLI, Gemini CLI,
GitHub Copilot CLI, Claude Code CLI, and DeepSeek Harness CLI.

Create the Agent with an LLM Gateway and one or more LiteLLM Model Aliases, deploy
it, then start a sandbox. CLI templates deliberately run `sleep infinity`; execute
the installed wrapper through the existing command endpoint:

```sh
curl -X POST "$QUICKSTACK_URL/api/v1/agents/$AGENT_ID/sandboxes/$SANDBOX_NAME/commands" \
  -H "Authorization: Bearer $QUICKSTACK_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"command":"/workspace/.quickstack/bin/qs-copilot -p \"Summarize this repository\"","cwd":"/workspace","timeoutSec":600}'
```

Use `opencode` for OpenCode, `sh /workspace/quickstack-bootstrap.sh <gemini args>` for Gemini,
or `/workspace/.quickstack/bin/qs-copilot`,
`/workspace/.quickstack/bin/qs-copilot`, `/workspace/.quickstack/bin/qs-claude`,
or `/workspace/.quickstack/bin/qs-dsh`. The bootstrap script installs pinned CLI
versions into the Agent Volume and creates the wrappers. They load the Agent's
LiteLLM endpoint, selected default Model Alias, and injected Agent Runtime Secret.
Do not pass provider API keys to the command endpoint.

OpenCode Web uses port 4096. DeepSeek Harness is currently available as CLI only
because its Web UI binds to loopback and needs a dedicated reverse-proxy sidecar.
