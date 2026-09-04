# Gemini CLI with LiteLLM research

Date: 2026-09-04.

## Current QuickStack template

Before the correction, `src/shared/templates/agents/gemini-cli.template.ts`
installed pinned Gemini CLI `0.58.0` and persisted these runtime variables:

```text
GEMINI_API_KEY=<QuickStack virtual key>
GEMINI_MODEL=<selected QuickStack model alias>
GOOGLE_GEMINI_BASE_URL=<LiteLLM base URL>/gemini
```

## Findings

1. **The base URL is wrong.** LiteLLM's Gemini CLI tutorial configures
   `GOOGLE_GEMINI_BASE_URL` to the LiteLLM proxy root, e.g.
   `http://localhost:4000`; it does not append `/gemini`.
   [LiteLLM Gemini CLI tutorial](https://docs.litellm.ai/docs/tutorials/litellm_gemini_cli#step-2-configure-gemini-cli-for-litellm-proxy).
   LiteLLM implements Gemini-compatible routes at the root
   (`/v1beta/models/{model}:generateContent`); `/gemini/{endpoint}` is a
   separate Google AI Studio pass-through route, not the proxy router route.
   [LiteLLM Gemini router source](https://github.com/BerriAI/litellm/blob/main/litellm/proxy/google_endpoints/endpoints.py#L17-L20),
   [LiteLLM pass-through source](https://github.com/BerriAI/litellm/blob/main/litellm/proxy/pass_through_endpoints/llm_passthrough_endpoints.py#L256-L260).

2. **The authentication variables are otherwise correct.** The tutorial
   requires `GOOGLE_GEMINI_BASE_URL` and `GEMINI_API_KEY`; the latter is the
   LiteLLM Proxy API key. A QuickStack virtual key is the appropriate value for
   this requirement. [LiteLLM tutorial](https://docs.litellm.ai/docs/tutorials/litellm_gemini_cli#step-2-configure-gemini-cli-for-litellm-proxy).

3. **`GEMINI_MODEL` is supported by Gemini CLI 0.58.0.** The pinned source
   resolves the model from `--model`, then `GEMINI_MODEL`, then settings. It
   also selects gateway auth whenever `GOOGLE_GEMINI_BASE_URL` is set.
   [Gemini CLI 0.58.0 config source](https://github.com/google-gemini/gemini-cli/blob/v0.58.0/packages/cli/src/config/config.ts#L842-L856),
   [gateway auth source](https://github.com/google-gemini/gemini-cli/blob/v0.58.0/packages/core/src/core/contentGenerator.ts#L73-L93).

4. **A Gemini-facing alias is the documented way to route non-Gemini models.**
   LiteLLM documents non-Gemini models by having Gemini CLI request a known
   Gemini identifier such as `gemini-2.5-pro`, then mapping that identifier to
   the actual LiteLLM deployment with
   `router_settings.model_group_alias`. This is explicitly how the tutorial
   routes to Anthropic, OpenAI, and Bedrock. [LiteLLM advanced configuration](https://docs.litellm.ai/docs/tutorials/litellm_gemini_cli#use-anthropic-openai-bedrock-etc-models-on-gemini-cli).

   Gemini CLI itself resolves `GEMINI_MODEL` without a Gemini-name allowlist;
   LiteLLM accepts a deployment name or `model_group_alias`. Thus
   `GEMINI_MODEL=deepseek-v4-pro` can work *if* that exact value is exposed by
   the LiteLLM model list and its backend supports Gemini protocol/tool
   semantics. [Gemini CLI model resolution](https://github.com/google-gemini/gemini-cli/blob/v0.58.0/packages/cli/src/config/config.ts#L842-L856),
   [LiteLLM router matching](https://github.com/BerriAI/litellm/blob/main/litellm/router.py#L1412-L1425).
   The Gemini-facing alias remains the documented, conservative configuration.

5. **The adapter still has Gemini-specific assumptions.** Gemini CLI uses the
   Gemini API protocol and tool/content semantics. LiteLLM can proxy supported
   non-Gemini providers, but compatibility depends on the selected model and
   LiteLLM's translation layer; this is not a generic OpenAI-compatible client.
   [LiteLLM tutorial benefits and routing examples](https://docs.litellm.ai/docs/tutorials/litellm_gemini_cli#benefits-of-using-gemini-cli-with-litellm).

## Implemented correction

Change the template to persist:

```text
GEMINI_API_KEY=<QuickStack virtual key>
GEMINI_MODEL=<selected LiteLLM model alias>
GOOGLE_GEMINI_BASE_URL=<LiteLLM base URL>
```

For a QuickStack-selected model alias such as `deepseek-v4-pro`, the template
may use it directly only when LiteLLM recognizes the exact name and its Gemini
adapter supports the selected backend. For portable behaviour, configure a
Gemini-facing LiteLLM `model_group_alias` and select that alias for the Agent.
QuickStack cannot safely create gateway-global mappings per Agent: they would
affect other Agents, require a LiteLLM configuration reload, and can conflict
when Agents select different targets. A future mapping-management feature could
make that explicit at the LLM Gateway level.

The previous alternatives were:

1. expose/configure LiteLLM `model_group_alias` mappings and use their
   Gemini-facing names for Gemini CLI; or
2. limit this template's selectable aliases to Gemini-compatible model names.

The first option preserves LiteLLM's documented multi-provider routing.
