'use client';

import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { deactivate2fa } from "./actions";
import { Toast } from "@/frontend/utils/toast.utils";
import TotpCreateDialog from "./totp-create-dialog";
import { Button } from "@/components/ui/button";

export default function ToTpSettings({ totpEnabled }: { totpEnabled: boolean }) {


    return <>
        <Card>
            <CardHeader>
                <CardTitle>2FA Settings</CardTitle>
                <CardDescription>Two-factor authentication (2FA) adds an extra layer of security to your account.</CardDescription>
            </CardHeader>
            <CardFooter className="gap-4">
                <TotpCreateDialog >
                    <Button variant={totpEnabled ? 'outline' : 'default'}>{totpEnabled ? 'Replace current 2FA Config' : 'Enable 2FA'}</Button>
                </TotpCreateDialog>
                {totpEnabled && <Button onClick={() => Toast.fromAction(() => deactivate2fa())} variant="destructive">Deactivate 2FA</Button>}
            </CardFooter>
        </Card >
    </>;
}