'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { CircleHelp, Copy, Key } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import LoadingSpinner from '@/components/ui/loading-spinner';
import { Toast } from '@/frontend/utils/toast.utils';
import { MCP_SERVER_MODE_LABELS, McpServerMode, mcpServerModeZodModel } from '@/shared/model/mcp-settings.model';
import { McpSettingsUtils } from '@/shared/utils/mcp.utils';
import { setMcpSendSecrets, setMcpServerMode } from '../../actions';
import Link from 'next/link';

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

export default function McpSettings({ mcpMode, sendSecrets }: { mcpMode: McpServerMode; sendSecrets: boolean }) {
    const [mode, setMode] = useState<McpServerMode>(mcpMode);
    const [sendSecretsViaMcp, setSendSecretsViaMcp] = useState(sendSecrets);
    const [loading, setLoading] = useState(false);
    const [origin, setOrigin] = useState('');

    useEffect(() => {
        setOrigin(window.location.origin);
    }, []);

    const mcpUrl = `${origin || 'https://<your-quickstack-url>'}/api/mcp`;
    const isEnabled = McpSettingsUtils.isMcpServerEnabled(mode);

    const handleModeChange = async (value: string | null) => {
        const parsedMode = mcpServerModeZodModel.safeParse(value);
        if (!parsedMode.success) {
            return;
        }

        const previousMode = mode;
        try {
            setLoading(true);
            setMode(parsedMode.data);

            await Toast.fromAction(
                () => setMcpServerMode(parsedMode.data),
                `MCP server set to ${MCP_SERVER_MODE_LABELS[parsedMode.data]}`,
                'Updating MCP server...'
            );
        } catch {
            setMode(previousMode);
        } finally {
            setLoading(false);
        }
    };

    const handleSendSecretsToggle = async (checked: boolean) => {
        const previousState = sendSecretsViaMcp;
        try {
            setLoading(true);
            setSendSecretsViaMcp(checked);

            await Toast.fromAction(
                () => setMcpSendSecrets(checked),
                `MCP secrets ${checked ? 'enabled' : 'disabled'}`,
                'Updating MCP secret handling...'
            );
        } catch {
            setSendSecretsViaMcp(previousState);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-4">

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        MCP Server
                        <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">Beta</span>
                    </CardTitle>
                    <CardDescription>
                        Expose QuickStack as a remote Model Context Protocol server. AI clients such as Claude Code,
                        Codex and GitHub Copilot can then act on QuickStack through the REST API using a REST API Key.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                    <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-3">
                            <Label htmlFor="mcp-server-mode">MCP status</Label>
                            <Select value={mode} onValueChange={handleModeChange} disabled={loading}>
                                <SelectTrigger id="mcp-server-mode" className="w-[180px]">
                                    <SelectValue>{MCP_SERVER_MODE_LABELS[mode]}</SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                    {mcpServerModeZodModel.options.map((option) => (
                                        <SelectItem key={option} value={option}>
                                            {MCP_SERVER_MODE_LABELS[option]}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {loading && <LoadingSpinner />}
                        </div>
                        <p className="text-sm text-muted-foreground">
                            <span className="font-medium">Read only</span> exposes the search and read tools.
                            <span className="font-medium"> Read &amp; write</span> also exposes the mutating tool.
                        </p>
                    </div>

                    <div className="space-y-2">
                        <div className="flex items-center space-x-3">
                            <Switch
                                id="mcp-send-secrets"
                                disabled={loading || !isEnabled}
                                checked={sendSecretsViaMcp}
                                onCheckedChange={handleSendSecretsToggle}
                            />
                            <Label htmlFor="mcp-send-secrets">Expose secrets in MCP responses</Label>
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger render={<button type="button" aria-label="About secrets in MCP responses" className="text-muted-foreground"><CircleHelp className="h-4 w-4" /></button>} />
                                    <TooltipContent className="max-w-80">
                                        When off, fields marked as secret (environment variables, build arguments, registry passwords,
                                        Git tokens, SSH private keys, basic-auth passwords, webhook IDs, health-check headers and
                                        LLM admin keys) are removed from MCP results. Temporary sandbox access URLs and API tokens
                                        are also redacted. The normal REST API is not affected.
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {isEnabled && <Card>
                <CardHeader>
                    <CardTitle>Connection</CardTitle>
                    <CardDescription>
                        Use the endpoint URL below and authenticate with a REST API Key.
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
                <CardFooter>
                    <Link href="/settings/account/api-keys" className="mr-auto">
                        <Button variant={'secondary'}><Key /> Manage API Keys</Button>
                    </Link>
                </CardFooter>
            </Card>}

        </div>
    );
}
