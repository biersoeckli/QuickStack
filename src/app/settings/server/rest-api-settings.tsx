'use client';

import { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import LoadingSpinner from '@/components/ui/loading-spinner';
import { Toast } from '@/frontend/utils/toast.utils';
import { setOpenApiSpecEnabled } from './actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BookOpen } from 'lucide-react';
import Link from 'next/link';

export default function RestApiSettings({
    openApiEnabled
}: {
    openApiEnabled: boolean;
}) {
    const [isOpenApiEnabled, setIsOpenApiEnabled] = useState(openApiEnabled);
    const [loading, setLoading] = useState(false);

    const handleOpenApiToggle = async (checked: boolean) => {
        const previousState = isOpenApiEnabled;
        try {
            setLoading(true);
            setIsOpenApiEnabled(checked);

            await Toast.fromAction(
                () => setOpenApiSpecEnabled(checked),
                `OpenAPI spec ${checked ? 'enabled' : 'disabled'}`,
                `Updating OpenAPI spec visibility...`
            );
        } catch {
            setIsOpenApiEnabled(previousState);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    OpenAPI Endpoint
                </CardTitle>
                <CardDescription>
                    Control if the open API Documentation is exposed (
                    <Link href="/api/v1/openapi" target='_blank'><span className="font-mono">/api/v1/openapi</span></Link> and <Link href="/api/v1/openapi.json" target='_blank'><span className="font-mono">/api/v1/openapi.json</span>)</Link>.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex gap-4 items-center">
                    <div className="flex items-center space-x-3">
                        <Switch
                            disabled={loading}
                            checked={isOpenApiEnabled}
                            onCheckedChange={handleOpenApiToggle}
                        />
                        <Label>Expose OpenAPI routes</Label>
                    </div>
                    {loading && <LoadingSpinner />}
                </div>
            </CardContent>
        </Card >
    );
}
