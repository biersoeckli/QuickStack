'use client';

import { ExternalLink } from 'lucide-react';
import type { ReactNode } from 'react';
import { Item, ItemActions, ItemContent, ItemGroup, ItemTitle } from '@/components/ui/item';
import { Separator } from '@/components/ui/separator';
import type { AppExtendedModel } from '@/shared/model/app-extended.model';
import BuildsTab from '@/app/project/app/[appId]/overview/deployments';
import { RolePermissionEnum } from '@/shared/model/role-extended.model.ts';

export function DrawerOverview({
    app,
    externalUrl,
    role
}: {
    app: AppExtendedModel;
    externalUrl?: string;
    role: RolePermissionEnum
}) {
    return (<>
        <ItemGroup className="gap-0">
            <Item size="xs">
                <ItemContent>
                    <ItemTitle className="font-normal text-muted-foreground">
                        Image
                    </ItemTitle>
                </ItemContent>
                <ItemActions className="max-w-[65%] truncate">
                    {app.sourceType === 'CONTAINER'
                        ? (app.containerImageSource ?? 'Not configured')
                        : (app.gitUrl ?? 'Not configured')}
                </ItemActions>
            </Item>
            <Item size="xs">
                <ItemContent>
                    <ItemTitle className="font-normal text-muted-foreground">
                        Replicas
                    </ItemTitle>
                </ItemContent>
                <ItemActions>{app.replicas}</ItemActions>
            </Item>
            <Item size="xs">
                <ItemContent>
                    <ItemTitle className="font-normal text-muted-foreground">
                        Project
                    </ItemTitle>
                </ItemContent>
                <ItemActions>{app.project.name}</ItemActions>
            </Item>
            {externalUrl && (
                <Item size="xs">
                    <ItemContent>
                        <ItemTitle className="font-normal text-muted-foreground">
                            External URL
                        </ItemTitle>
                    </ItemContent>
                    <ItemActions className="max-w-[65%] truncate">
                        <a
                            href={externalUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1 truncate text-primary underline"
                        >
                            <span className="truncate">{externalUrl}</span>
                            <ExternalLink className="size-3 shrink-0" />
                        </a>
                    </ItemActions>
                </Item>
            )}
        </ItemGroup>
        <Separator className="my-8" />
        <BuildsTab
            key={app.id}
            app={app}
            role={role}
            view="grid"
        />
    </>);
}
