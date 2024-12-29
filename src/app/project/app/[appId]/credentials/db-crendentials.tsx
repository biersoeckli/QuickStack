import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AppExtendedModel } from "@/shared/model/app-extended.model";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useConfirmDialog } from "@/frontend/states/zustand.states";
import { Toast } from "@/frontend/utils/toast.utils";
import { ClipboardCopy } from "lucide-react";
import { toast } from "sonner";
import { DatabaseTemplateInfoModel } from "@/shared/model/database-template-info.model";
import { Actions } from "@/frontend/utils/nextjs-actions.utils";
import { getDatabaseCredentials } from "./actions";
import { Label } from "@/components/ui/label";
import CopyInputField from "@/components/custom/copy-input-field";
import FullLoadingSpinner from "@/components/ui/full-loading-spinnter";

export default function DbCredentials({
    app
}: {
    app: AppExtendedModel;
}) {

    const [databaseCredentials, setDatabaseCredentials] = useState<DatabaseTemplateInfoModel | undefined>(undefined);


    const loadCredentials = async (appId: string) => {
        const response = await Actions.run(() => getDatabaseCredentials(appId));
        setDatabaseCredentials(response);
    }

    useEffect(() => {
        loadCredentials(app.id);
        return () => {
            setDatabaseCredentials(undefined);
        }
    }, [app]);

    if (!databaseCredentials) {
        return <FullLoadingSpinner />;
    }

    return <>
        <Card>
            <CardHeader>
                <CardTitle>Database Credentials</CardTitle>
                <CardDescription>Use these credentials to connect to your database from other apps within the same project.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-2 gap-4">
                    <CopyInputField
                        label="Database Name"
                        value={databaseCredentials?.databaseName || ''} />

                    <div></div>

                    <CopyInputField
                        label="Username"
                        value={databaseCredentials?.username || ''} />

                    <CopyInputField
                        label="Password"
                        secret={true}
                        value={databaseCredentials?.password || ''} />


                    <CopyInputField
                        label="Internal Hostname"
                        value={databaseCredentials?.hostname || ''} />

                    <CopyInputField
                        label="Internal Port"
                        value={(databaseCredentials?.port + '')} />
                </div>
                <div className="grid grid-cols-1 gap-4 pt-4">
                    <CopyInputField
                        label="Internal Connection URL"
                        secret={true}
                        value={databaseCredentials?.internalConnectionUrl || ''} />
                </div>
            </CardContent>
        </Card>
    </>;
}
