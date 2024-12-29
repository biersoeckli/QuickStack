import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AppExtendedModel } from "@/shared/model/app-extended.model";
import { useEffect, useState } from "react";
import { createNewWebhookUrl } from "./actions";
import { Button } from "@/components/ui/button";
import { useConfirmDialog } from "@/frontend/states/zustand.states";
import { Toast } from "@/frontend/utils/toast.utils";
import { ClipboardCopy } from "lucide-react";
import { toast } from "sonner";

export default function WebhookDeploymentInfo({
    app
}: {
    app: AppExtendedModel;
}) {
    const { openConfirmDialog } = useConfirmDialog();
    const [webhookUrl, setWebhookUrl] = useState<string | undefined>(undefined);

    useEffect(() => {
        if (app.webhookId) {
            const hostname = window.location.hostname;
            const port = [80, 443].includes(Number(window.location.port)) ? '' : `:${window.location.port}`;
            const protocol = window.location.protocol;
            setWebhookUrl(`${protocol}//${hostname}${port}/api/v1/webhook/deploy?id=${app.webhookId}`);
        }
    }, [app]);

    const createNewWebhookUrlAsync = async () => {
        if (!await openConfirmDialog({
            title: 'Generate new Webhook URL',
            description: 'Are you sure you want to generate a new Webhook URL? The old URL will be invalidated.',
            okButton: 'Generate new URL'
        })) {
            return;
        }
        await Toast.fromAction(() => createNewWebhookUrl(app.id), 'Webhook URL has been regenerated.');
    }

    const copyWebhookUrl = () => {
        navigator.clipboard.writeText(webhookUrl!);
        toast.success('Webhook URL has been copied to clipboard.');
    }

    return <>
        <Card>
            <CardHeader>
                <CardTitle>Webhook Deployment</CardTitle>
                <CardDescription>Use this webhook URL to trigger deployments from external services (for example GitHub Actions or GitLab Pipelines).</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex gap-4">
                    {webhookUrl && <Button className="flex-1 truncate" variant="secondary" onClick={copyWebhookUrl}>
                        <span className="truncate">{webhookUrl}</span> <ClipboardCopy />
                    </Button>}
                    <Button onClick={createNewWebhookUrlAsync} variant={webhookUrl ? 'ghost' : 'secondary'}>{webhookUrl ? 'Generate new Webhook URL' : 'Enable Webhook deployments'}</Button>
                </div>
            </CardContent>
        </Card>
    </>;
}
