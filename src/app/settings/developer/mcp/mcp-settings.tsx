'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Copy, ShieldAlert } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import LoadingSpinner from '@/components/ui/loading-spinner';
import { Toast } from '@/frontend/utils/toast.utils';
import { setMcpServerEnabled } from '../../actions';

function Snippet({ value }: { value: string }) {
    return (
        <div className="relative">
            <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1 h-7 w-7"
                onClick={() => {
                    navigator.clipboard.writeText(value);
                    toast.success('Copied to clipboard');
                }}
            >
                <Copy className="h-4 w-4" />
            </Button>
            <pre className="overflow-x-auto rounded-md bg-muted p-3 pr-10 text-xs font-mono">
                {value}
            </pre>
        </div>
    );
}

function Step({ title, children }: { title: string; children: ReactNode }) {
    return (
        <div className="space-y-2">
            <h4 className="text-sm font-medium">{title}</h4>
            {children}
        </div>
    );
}

export default function McpSettings({ mcpEnabled }: { mcpEnabled: boolean }) {
    const [isEnabled, setIsEnabled] = useState(mcpEnabled);
    const [loading, setLoading] = useState(false);
    const [origin, setOrigin] = useState('');

    useEffect(() => {
        setOrigin(window.location.origin);
    }, []);

    const mcpUrl = `${origin || 'https://<your-quickstack-url>'}/api/mcp`;

    const handleToggle = async (checked: boolean) => {
        const previousState = isEnabled;
        try {
            setLoading(true);
            setIsEnabled(checked);

            await Toast.fromAction(
                () => setMcpServerEnabled(checked),
                `MCP server ${checked ? 'enabled' : 'disabled'}`,
                `Updating MCP server...`
            );
        } catch {
            setIsEnabled(previousState);
        } finally {
            setLoading(false);
        }
    };

    const claudeJson = `{
  "mcpServers": {
    "quickstack": {
      "type": "http",
      "url": "${mcpUrl}",
      "headers": { "Authorization": "Bearer <YOUR_REST_API_KEY>" }
    }
  }
}`;

    const claudeCli = `claude mcp add --transport http quickstack ${mcpUrl} \\
  --header "Authorization: Bearer <YOUR_REST_API_KEY>"`;

    const codexToml = `[mcp_servers.quickstack]
url = "${mcpUrl}"
bearer_token_env_var = "QUICKSTACK_API_KEY"`;

    const codexStaticToml = `[mcp_servers.quickstack]
url = "${mcpUrl}"
http_headers = { Authorization = "Bearer <YOUR_REST_API_KEY>" }`;

    const copilotJson = `{
  "servers": {
    "quickstack": {
      "type": "http",
      "url": "${mcpUrl}",
      "headers": { "Authorization": "Bearer \${input:quickstack-api-key}" }
    }
  }
}`;

    const genericJson = `POST ${mcpUrl}
Content-Type: application/json
Accept: application/json, text/event-stream
Authorization: Bearer <YOUR_REST_API_KEY>

{"jsonrpc":"2.0","id":1,"method":"tools/list"}`;

    return (
        <div className="space-y-4">
            <Alert variant="destructive">
                <ShieldAlert />
                <AlertTitle>Canary feature: secrets can flow through MCP</AlertTitle>
                <AlertDescription>
                    The MCP server is a canary feature. Tool arguments and results are passed to the AI host and model.
                    Read operations can return secrets in plaintext, including App environment variables, build arguments,
                    Git tokens, container registry credentials and App basic-auth passwords. Write operations can send the
                    same values. Agent Git SSH keys are returned encrypted. Only connect trusted clients and use a REST API
                    Key from a user with the minimum required permissions.
                </AlertDescription>
            </Alert>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        MCP Server
                        <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">Canary</span>
                    </CardTitle>
                    <CardDescription>
                        Expose QuickStack as a remote Model Context Protocol server. AI clients such as Claude Code,
                        Codex and GitHub Copilot can then act on QuickStack through the REST API using a REST API Key.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex gap-4 items-center">
                        <div className="flex items-center space-x-3">
                            <Switch disabled={loading} checked={isEnabled} onCheckedChange={handleToggle} />
                            <Label>Enable the MCP server at /api/mcp</Label>
                        </div>
                        {loading && <LoadingSpinner />}
                    </div>
                </CardContent>
            </Card>

            {isEnabled && <Card>
                <CardHeader>
                    <CardTitle>Connection</CardTitle>
                    <CardDescription>
                        Use the endpoint URL below and authenticate with a REST API Key created under
                        {' '}Settings &rarr; Account &amp; Access &rarr; API Keys. QuickStack exposes two tools:
                        {' '}<span className="font-mono">search_operations</span> to discover operations and
                        {' '}<span className="font-mono">execute_operation</span> to run one.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                    <Label>MCP endpoint</Label>
                    <Snippet value={mcpUrl} />
                    <p className="text-sm text-muted-foreground">
                        Send the key as <span className="font-mono">Authorization: Bearer &lt;key&gt;</span>. The server follows
                        the MCP Streamable HTTP transport and is stateless.
                    </p>
                </CardContent>
            </Card>}

            {isEnabled && <Card>
                <CardHeader>
                    <CardTitle>Client setup</CardTitle>
                    <CardDescription>Add QuickStack as a remote MCP server in your AI client.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Tabs defaultValue="claude">
                        <TabsList>
                            <TabsTrigger value="claude">Claude Code</TabsTrigger>
                            <TabsTrigger value="codex">Codex</TabsTrigger>
                            <TabsTrigger value="copilot">GitHub Copilot</TabsTrigger>
                            <TabsTrigger value="generic">Generic</TabsTrigger>
                        </TabsList>

                        <TabsContent value="claude" className="space-y-4 pt-4">
                            <Step title="Add to .mcp.json in your project root, or to your user configuration:">
                                <Snippet value={claudeJson} />
                            </Step>
                            <Step title="Or add it with the CLI:">
                                <Snippet value={claudeCli} />
                            </Step>
                        </TabsContent>

                        <TabsContent value="codex" className="space-y-4 pt-4">
                            <Step title="Add a Streamable HTTP server to ~/.codex/config.toml and export the key:">
                                <Snippet value={codexToml} />
                                <Snippet value={`export QUICKSTACK_API_KEY="<YOUR_REST_API_KEY>"`} />
                            </Step>
                            <Step title="Or embed a static header (not recommended in shared repositories):">
                                <Snippet value={codexStaticToml} />
                            </Step>
                        </TabsContent>

                        <TabsContent value="copilot" className="space-y-4 pt-4">
                            <Step title="Add the server to .vscode/mcp.json. VS Code prompts for the key through the input variable:">
                                <Snippet value={copilotJson} />
                            </Step>
                            <p className="text-sm text-muted-foreground">
                                VS Code also reads a portable <span className="font-mono">.mcp.json</span> at the workspace root,
                                which uses the same <span className="font-mono">mcpServers</span> shape as Claude Code.
                            </p>
                        </TabsContent>

                        <TabsContent value="generic" className="space-y-4 pt-4">
                            <Step title="Any MCP Streamable HTTP client can call the endpoint directly:">
                                <Snippet value={genericJson} />
                            </Step>
                            <p className="text-sm text-muted-foreground">
                                Call <span className="font-mono">search_operations</span> first to discover operation ids and their
                                input/output schemas, then call <span className="font-mono">execute_operation</span> with
                                {' '}<span className="font-mono">pathParams</span>, <span className="font-mono">query</span> and
                                {' '}<span className="font-mono">body</span>. Clients set the MCP protocol headers themselves.
                            </p>
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>}
        </div>
    );
}
