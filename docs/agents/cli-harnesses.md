# CLI harness Agents

QuickStack supplies seven Agent Templates: OpenCode Web, OpenCode CLI, Gemini CLI,
GitHub Copilot CLI, Claude Code CLI, DeepSeek Harness Web, and DeepSeek Harness CLI.

Create the Agent with an LLM Gateway and one or more LiteLLM Model Aliases, deploy
it, then start a sandbox. CLI templates deliberately run `sleep infinity`; execute
the installed wrapper through the existing command endpoint:

```sh
curl -X POST "$QUICKSTACK_URL/api/v1/agents/$AGENT_ID/sandboxes/$SANDBOX_NAME/commands" \
  -H "Authorization: Bearer $QUICKSTACK_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"command":"qs-copilot -p \"Summarize this repository\"","cwd":"/workspace","timeoutSec":600}'
```

Use `qs-opencode`, `qs-gemini`, `qs-copilot`, `qs-claude`, or `qs-dsh`. The wrappers
load the Agent's LiteLLM endpoint, selected default Model Alias, and the injected
Agent Runtime Secret. Do not pass provider API keys to the command endpoint.

OpenCode Web uses port 4096. DeepSeek Harness Web uses port 3080 and is a preview
dependency; configure an Agent Domain when browser access is required.
