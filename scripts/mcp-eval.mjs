#!/usr/bin/env node
/**
 * QuickStack MCP evaluation harness.
 *
 * Runs realistic tasks against a live QuickStack MCP endpoint and reports
 * success rate, tool calls, tool errors, token usage and latency.
 *
 * Modes:
 *   scripted - deterministic MCP calls that smoke-test the endpoint contract.
 *   llm      - an OpenAI-compatible model drives the MCP tools through a
 *              search -> inspect schema -> execute loop.
 *
 * Usage:
 *   MCP_API_KEY=... yarn mcp:eval
 *   MCP_API_KEY=... EVAL_LLM_API_KEY=... EVAL_LLM_MODEL=... yarn mcp:eval --mode llm
 *   MCP_API_KEY=... yarn mcp:eval --json
 *   MCP_API_KEY=... MCP_EVAL_APP_ID=... MCP_EVAL_AGENT_ID=... yarn mcp:eval
 *   MCP_API_KEY=... MCP_EVAL_ALLOW_WRITES=1 yarn mcp:eval --allow-writes
 */

import { parseArgs } from 'node:util';

const PROTOCOL_VERSION = '2026-07-28';
const TOOL_SEARCH = 'quickstack_search_operations';
const TOOL_READ = 'quickstack_execute_read_operation';
const TOOL_WRITE = 'quickstack_execute_operation';
const MAX_TOOL_RESULT_CHARS = 8_000;

const { values: options } = parseArgs({
    allowPositionals: false,
    options: {
        url: { type: 'string', default: process.env.MCP_URL ?? 'http://localhost:3000/api/mcp' },
        'api-key': { type: 'string', default: process.env.MCP_API_KEY ?? '' },
        mode: { type: 'string', default: process.env.MCP_EVAL_MODE ?? 'scripted' },
        'max-steps': { type: 'string', default: '8' },
        'allow-writes': { type: 'boolean', default: process.env.MCP_EVAL_ALLOW_WRITES === '1' },
        json: { type: 'boolean', default: false },
        help: { type: 'boolean', default: false },
    },
});

if (options.help) {
    printHelp();
    process.exit(0);
}

const mode = options.mode;
if (mode !== 'scripted' && mode !== 'llm') {
    fail(`Unknown mode "${mode}". Use scripted or llm.`);
}
if (!options['api-key']) {
    fail('Missing API key. Set MCP_API_KEY or pass --api-key.');
}
if (mode === 'llm' && (!process.env.EVAL_LLM_API_KEY || !process.env.EVAL_LLM_MODEL)) {
    fail('LLM mode needs EVAL_LLM_API_KEY and EVAL_LLM_MODEL (optionally EVAL_LLM_BASE_URL).');
}

const maxSteps = Number.parseInt(options['max-steps'], 10);
if (!Number.isInteger(maxSteps) || maxSteps < 1) {
    fail('--max-steps must be a positive integer.');
}

class McpClient {
    constructor(url, apiKey) {
        this.url = url;
        this.apiKey = apiKey;
        this.nextId = 1;
    }

    async request(method, params = {}) {
        const id = this.nextId++;
        const headers = {
            'content-type': 'application/json',
            accept: 'application/json, text/event-stream',
            'mcp-protocol-version': PROTOCOL_VERSION,
            'mcp-method': method,
            authorization: `Bearer ${this.apiKey}`,
        };
        if (method === 'tools/call' && params.name) {
            headers['mcp-name'] = params.name;
        }

        const response = await fetch(this.url, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                jsonrpc: '2.0',
                id,
                method,
                params: {
                    ...params,
                    _meta: {
                        'io.modelcontextprotocol/protocolVersion': PROTOCOL_VERSION,
                        'io.modelcontextprotocol/clientCapabilities': {},
                        'io.modelcontextprotocol/clientInfo': { name: 'quickstack-mcp-eval', version: '1.0.0' },
                    },
                },
            }),
        });

        const payload = await readJsonRpcPayload(response);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${payload?.error?.message ?? response.statusText}`);
        }
        if (payload?.error) {
            throw new Error(`JSON-RPC ${payload.error.code}: ${payload.error.message}`);
        }
        return payload?.result;
    }

    async discover() {
        return this.request('server/discover');
    }

    async initialize() {
        return this.request('initialize', {
            protocolVersion: PROTOCOL_VERSION,
            capabilities: {},
            clientInfo: { name: 'quickstack-mcp-eval', version: '1.0.0' },
        });
    }

    async listTools() {
        return this.request('tools/list');
    }

    async callTool(name, args) {
        const result = await this.request('tools/call', { name, arguments: args });
        const isError = result?.isError === true;
        return { result, isError };
    }
}

async function readJsonRpcPayload(response) {
    const contentType = response.headers.get('content-type') ?? '';
    const text = await response.text();
    if (!text) {
        return undefined;
    }
    if (contentType.includes('text/event-stream')) {
        const dataLines = text
            .split('\n')
            .filter((line) => line.startsWith('data:'))
            .map((line) => line.slice('data:'.length).trim())
            .filter(Boolean);
        const last = dataLines.at(-1);
        return last ? JSON.parse(last) : undefined;
    }
    try {
        return JSON.parse(text);
    } catch {
        return { error: { code: -32700, message: text.slice(0, 500) } };
    }
}

function redact(value) {
    if (typeof value !== 'string') {
        return value;
    }
    return value.length > 300 ? `${value.slice(0, 300)}...` : value;
}

function summarizeToolResult(result) {
    if (!result) {
        return '';
    }
    const structured = result.structuredContent;
    const text = structured ? JSON.stringify(structured) : (result.content ?? [])
        .map((entry) => entry.text ?? '')
        .join('\n');
    const normalized = result.isError ? `[tool error] ${text}` : text;
    return normalized.length > MAX_TOOL_RESULT_CHARS
        ? `${normalized.slice(0, MAX_TOOL_RESULT_CHARS)}\n[truncated by eval harness]`
        : normalized;
}

function searchOperations(calls) {
    return calls
        .filter((call) => call.tool === 'search' && !call.isError)
        .flatMap((call) => call.result?.structuredContent?.operations ?? []);
}

function executedResult(call) {
    return call?.result?.structuredContent?.result;
}

function readOnlyTasks() {
    const tasks = [
        {
            id: 'find-deploy-operation',
            goal: 'Find the QuickStack operation that deploys an App and report its full input schema. Do not deploy anything.',
            script: [{ tool: 'search', args: { search: 'deploy app', detail: 'full' } }],
            verify({ calls }) {
                const deployApp = searchOperations(calls).find((operation) => operation.operationId === 'deployApp');
                return Boolean(deployApp?.querySchema && deployApp?.pathParamsSchema);
            },
        },
        {
            id: 'list-projects',
            goal: 'List the QuickStack projects. Do not create, update or delete anything.',
            script: [{ tool: 'read', args: { operationId: 'listProjects' } }],
            verify({ calls }) {
                const call = calls.find((candidate) => candidate.tool === 'read' && !candidate.isError);
                return Boolean(call) && Array.isArray(executedResult(call));
            },
        },
        {
            id: 'paginate-projects',
            goal: 'List at most 1 project using the pagination parameters and report the total number of projects. Do not change anything.',
            script: [{ tool: 'read', args: { operationId: 'listProjects', query: { limit: 1 } } }],
            verify({ calls }) {
                const result = executedResult(calls.find((call) => call.tool === 'read' && !call.isError));
                return Boolean(
                    result
                    && Array.isArray(result.items)
                    && result.items.length <= 1
                    && typeof result.total === 'number'
                    && typeof result.limit === 'number'
                );
            },
        },
    ];

    const appId = process.env.MCP_EVAL_APP_ID;
    if (appId) {
        tasks.push({
            id: 'inspect-app-logs',
            goal: `Read the last 50 log lines of app "${appId}". Do not change anything.`,
            script: [{
                tool: 'read',
                args: { operationId: 'getAppLogs', pathParams: { appId }, query: { lines: 50 } },
            }],
            verify({ calls }) {
                const result = executedResult(calls.find((call) => call.tool === 'read' && !call.isError));
                return Boolean(result && result.lines === 50 && Array.isArray(result.logs));
            },
        });
    }

    const agentId = process.env.MCP_EVAL_AGENT_ID;
    if (agentId) {
        tasks.push({
            id: 'list-agent-sandboxes',
            goal: `List at most 5 sandboxes of agent "${agentId}". Do not start or delete a sandbox.`,
            script: [{
                tool: 'read',
                args: { operationId: 'listAgentSandboxes', pathParams: { agentId }, query: { limit: 5 } },
            }],
            verify({ calls }) {
                const result = executedResult(calls.find((call) => call.tool === 'read' && !call.isError));
                return Boolean(
                    result
                    && Array.isArray(result.items)
                    && result.items.length <= 5
                    && typeof result.total === 'number'
                );
            },
        });
    }

    return tasks;
}

function writeTasks(runId) {
    const projectName = `mcp-eval-${runId}`;
    return [{
        id: 'create-project',
        goal: `Create a QuickStack project named "${projectName}" and report its id. Do not create or delete anything else.`,
        script: [{
            tool: 'write',
            args: { operationId: 'saveProject', body: { name: projectName } },
        }],
        verify({ calls }) {
            const call = calls.find((candidate) =>
                candidate.tool === 'write'
                && candidate.args?.operationId === 'saveProject'
                && !candidate.isError
            );
            const result = executedResult(call);
            return Boolean(result?.id && result?.name === projectName);
        },
        async cleanup(client, calls) {
            const created = calls
                .filter((call) =>
                    call.tool === 'write'
                    && call.args?.operationId === 'saveProject'
                    && !call.isError
                )
                .map(executedResult)
                .find((result) => result?.id && result?.name === projectName);
            if (!created?.id) {
                return;
            }
            await client.callTool(TOOL_WRITE, {
                operationId: 'deleteProject',
                pathParams: { id: created.id },
            });
        },
    }];
}

class ScriptedRunner {
    async runTask(client, task) {
        const calls = [];
        for (const step of task.script) {
            const startedAt = Date.now();
            const tool = step.tool === 'search' ? TOOL_SEARCH : step.tool === 'read' ? TOOL_READ : TOOL_WRITE;
            const execution = await executeTool(client, tool, step.args);
            calls.push({ ...execution, tool: step.tool, durationMs: Date.now() - startedAt });
        }
        return calls;
    }
}

class LlmRunner {
    constructor(config) {
        this.baseUrl = (config.baseUrl ?? 'https://api.openai.com/v1').replace(/\/$/, '');
        this.apiKey = config.apiKey;
        this.model = config.model;
    }

    async runTask(client, task, tools) {
        const messages = [
            {
                role: 'system',
                content: [
                    'You are evaluating the QuickStack MCP server.',
                    'Use the provided MCP tools. Start with quickstack_search_operations to find the operation id.',
                    'Inspect detail "full" before executing a write operation.',
                    'Never perform operations the task did not ask for. In particular do not delete or deploy anything unless the task says so.',
                    'When finished, reply with a short summary. Do not invent tool results.',
                ].join(' '),
            },
            { role: 'user', content: task.goal },
        ];
        const calls = [];
        let inputTokens = 0;
        let outputTokens = 0;

        for (let step = 0; step < maxSteps; step++) {
            const response = await fetch(`${this.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    authorization: `Bearer ${this.apiKey}`,
                },
                body: JSON.stringify({
                    model: this.model,
                    messages,
                    tools,
                    temperature: 0,
                }),
            });
            if (!response.ok) {
                throw new Error(`LLM HTTP ${response.status}: ${(await response.text()).slice(0, 500)}`);
            }
            const body = await response.json();
            inputTokens += body.usage?.prompt_tokens ?? 0;
            outputTokens += body.usage?.completion_tokens ?? 0;

            const message = body.choices?.[0]?.message;
            if (!message) {
                throw new Error('LLM response contained no message.');
            }
            if (!message.tool_calls?.length) {
                break;
            }

            messages.push({
                role: 'assistant',
                content: message.content ?? null,
                tool_calls: message.tool_calls,
            });

            for (const toolCall of message.tool_calls) {
                const tool = toolCall.function?.name;
                const args = parseToolArguments(toolCall.function?.arguments);
                const toolKind = tool === TOOL_SEARCH ? 'search' : tool === TOOL_READ ? 'read' : 'write';
                const startedAt = Date.now();
                let execution;
                try {
                    execution = await executeTool(client, tool, args);
                } catch (error) {
                    execution = {
                        result: undefined,
                        isError: true,
                        errorMessage: error instanceof Error ? error.message : String(error),
                    };
                }
                const call = { ...execution, tool: toolKind, args, durationMs: Date.now() - startedAt };
                calls.push(call);
                messages.push({
                    role: 'tool',
                    tool_call_id: toolCall.id,
                    content: execution.isError
                        ? `Error: ${execution.errorMessage ?? summarizeToolResult(execution.result)}`
                        : summarizeToolResult(execution.result),
                });
            }
        }

        return { calls, inputTokens, outputTokens };
    }
}

async function executeTool(client, name, args) {
    try {
        const { result, isError } = await client.callTool(name, args);
        return {
            name,
            args,
            result,
            isError,
            errorMessage: isError ? summarizeToolResult(result) : undefined,
        };
    } catch (error) {
        return {
            name,
            args,
            result: undefined,
            isError: true,
            errorMessage: error instanceof Error ? error.message : String(error),
        };
    }
}

function parseToolArguments(raw) {
    if (!raw) {
        return {};
    }
    try {
        return JSON.parse(raw);
    } catch {
        return { __invalidArguments: redact(raw) };
    }
}

function verifyTask(task, calls) {
    try {
        return task.verify({ calls });
    } catch {
        return false;
    }
}

async function main() {
    const startedAt = Date.now();
    const runId = `${new Date().toISOString().replace(/[:.]/g, '-')}-${Math.random().toString(36).slice(2, 6)}`;
    const tasks = readOnlyTasks();
    if (options['allow-writes']) {
        tasks.push(...writeTasks(runId));
    }

    const client = new McpClient(options.url, options['api-key']);
    let tools = [];
    let serverInfo;

    try {
        try {
            serverInfo = await client.initialize();
        } catch {
            serverInfo = await client.discover();
        }
        const toolsResult = await client.listTools();
        tools = toolsResult?.tools ?? [];
    } catch (error) {
        fail(`MCP connection failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    if (tools.length === 0) {
        fail('MCP server returned no tools.');
    }

    const llmRunner = mode === 'llm'
        ? new LlmRunner({
            baseUrl: process.env.EVAL_LLM_BASE_URL,
            apiKey: process.env.EVAL_LLM_API_KEY,
            model: process.env.EVAL_LLM_MODEL,
        })
        : undefined;
    const scriptedRunner = new ScriptedRunner();
    const openAiTools = tools.map((tool) => ({
        type: 'function',
        function: {
            name: tool.name,
            description: tool.description ?? '',
            parameters: tool.inputSchema ?? { type: 'object', properties: {} },
        },
    }));

    const results = [];
    for (const task of tasks) {
        const taskStartedAt = Date.now();
        try {
            const run = mode === 'llm'
                ? await llmRunner.runTask(client, task, openAiTools)
                : { calls: await scriptedRunner.runTask(client, task), inputTokens: 0, outputTokens: 0 };
            const calls = run.calls;
            const passed = verifyTask(task, calls);

            if (task.cleanup) {
                try {
                    await task.cleanup(client, calls);
                } catch (error) {
                    calls.push({
                        tool: 'write',
                        args: { operationId: 'cleanup' },
                        isError: true,
                        errorMessage: `Cleanup failed: ${error instanceof Error ? error.message : String(error)}`,
                        durationMs: 0,
                    });
                }
            }

            results.push({
                id: task.id,
                status: passed ? 'passed' : 'failed',
                calls,
                inputTokens: run.inputTokens,
                outputTokens: run.outputTokens,
                durationMs: Date.now() - taskStartedAt,
            });
        } catch (error) {
            results.push({
                id: task.id,
                status: 'failed',
                calls: [],
                inputTokens: 0,
                outputTokens: 0,
                durationMs: Date.now() - taskStartedAt,
                message: error instanceof Error ? error.message : String(error),
            });
        }
    }

    const report = buildReport({ mode, url: options.url, runId, serverInfo, results, startedAt });
    if (options.json) {
        console.log(JSON.stringify(report, null, 2));
    } else {
        printReport(report);
    }

    process.exitCode = report.summary.failed > 0 || report.summary.passed === 0 ? 1 : 0;
}

function buildReport({ mode, url, runId, serverInfo, results, startedAt }) {
    const calls = results.flatMap((result) => result.calls);
    const toolCalls = calls.length;
    const toolErrors = calls.filter((call) => call.isError).length;
    const inputTokens = results.reduce((sum, result) => sum + result.inputTokens, 0);
    const outputTokens = results.reduce((sum, result) => sum + result.outputTokens, 0);
    const passed = results.filter((result) => result.status === 'passed').length;
    const failed = results.filter((result) => result.status === 'failed').length;

    return {
        mode,
        url,
        runId,
        server: {
            name: serverInfo?.serverInfo?.name ?? serverInfo?.name,
            version: serverInfo?.serverInfo?.version ?? serverInfo?.version,
            instructions: Boolean(serverInfo?.instructions),
            protocolVersion: serverInfo?.protocolVersion,
        },
        summary: {
            tasks: results.length,
            passed,
            failed,
            successRate: results.length > 0 ? round(passed / results.length) : 0,
            toolCalls,
            toolErrors,
            errorRate: toolCalls > 0 ? round(toolErrors / toolCalls) : 0,
            avgToolCallsPerTask: results.length > 0 ? round(toolCalls / results.length) : 0,
            inputTokens,
            outputTokens,
            totalTokens: inputTokens + outputTokens,
            durationMs: Date.now() - startedAt,
        },
        tasks: results.map((result) => ({
            id: result.id,
            status: result.status,
            toolCalls: result.calls.length,
            toolErrors: result.calls.filter((call) => call.isError).length,
            inputTokens: result.inputTokens,
            outputTokens: result.outputTokens,
            durationMs: result.durationMs,
            ...(result.message ? { message: result.message } : {}),
            calls: result.calls.map((call) => ({
                tool: call.tool,
                operationId: call.args?.operationId,
                isError: call.isError,
                durationMs: call.durationMs,
                ...(call.errorMessage ? { error: redact(call.errorMessage) } : {}),
            })),
        })),
    };
}

function printReport(report) {
    const { summary, server } = report;
    console.log(`QuickStack MCP evaluation (${report.mode})`);
    console.log(`URL: ${report.url}`);
    if (server.name) {
        console.log(`Server: ${server.name} ${server.version ?? ''} protocol=${server.protocolVersion ?? 'unknown'} instructions=${server.instructions}`);
    }
    console.log('');
    console.log(`Success: ${summary.passed}/${summary.tasks} tasks (${(summary.successRate * 100).toFixed(1)}%)`);
    console.log(`Tool calls: ${summary.toolCalls} (${summary.toolErrors} errors, ${(summary.errorRate * 100).toFixed(1)}%)`);
    console.log(`Tokens: ${summary.inputTokens} in / ${summary.outputTokens} out = ${summary.totalTokens} total`);
    console.log(`Duration: ${(summary.durationMs / 1000).toFixed(1)}s`);
    console.log('');
    for (const task of report.tasks) {
        const tokens = task.inputTokens + task.outputTokens;
        const suffix = tokens > 0 ? ` tokens=${tokens}` : '';
        console.log(`  ${task.status.toUpperCase().padEnd(6)} ${task.id} calls=${task.toolCalls} errors=${task.toolErrors} ${task.durationMs}ms${suffix}`);
        if (task.message) {
            console.log(`         ${task.message}`);
        }
        for (const call of task.calls.filter((entry) => entry.isError)) {
            console.log(`         error in ${call.operationId ?? call.tool}: ${call.error}`);
        }
    }
}

function round(value) {
    return Math.round(value * 1000) / 1000;
}

function printHelp() {
    console.log(`QuickStack MCP evaluation harness

Environment:
  MCP_URL                    MCP endpoint (default http://localhost:3000/api/mcp)
  MCP_API_KEY                QuickStack REST API key
  MCP_EVAL_MODE              scripted (default) or llm
  MCP_EVAL_APP_ID            Optional app id for the app-logs task
  MCP_EVAL_AGENT_ID          Optional agent id for the sandbox task
  MCP_EVAL_ALLOW_WRITES=1    Add the create-project write task (cleaned up afterwards)
  EVAL_LLM_BASE_URL          OpenAI-compatible base URL (default https://api.openai.com/v1)
  EVAL_LLM_API_KEY           LLM API key (llm mode)
  EVAL_LLM_MODEL             LLM model name (llm mode)

Flags:
  --url <url>                MCP endpoint
  --api-key <key>            QuickStack REST API key
  --mode scripted|llm        Evaluation mode
  --max-steps <n>            Maximum LLM tool loop iterations per task (default 8)
  --allow-writes             Add the write task
  --json                     Print the full report as JSON
  --help                     Show this help`);
}

function fail(message) {
    console.error(message);
    process.exit(1);
}

main().catch((error) => {
    console.error(error instanceof Error ? error.stack : error);
    process.exit(1);
});
