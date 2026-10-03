'use client';

import Link from 'next/link';
import {
    SidebarContent,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar';
import type { QuickStackReleaseInfo } from '@/server/adapter/qs-versioninfo.adapter';
import {
    developerSettingsNavigation,
    serverSettingsHref,
    serverSettingsNavigation,
    type SettingsNavigationGroup,
} from '@/shared/utils/settings-navigation';

export function SettingsNavigationContent({
    path,
    visibleSettingsGroups,
    isAdmin,
    newVersionInfo,
    onNavigate,
}: {
    path: string;
    visibleSettingsGroups: SettingsNavigationGroup[];
    isAdmin: boolean;
    newVersionInfo?: QuickStackReleaseInfo;
    onNavigate?: () => void;
}) {
    return (
        <SidebarContent className="gap-0 py-2">
            {visibleSettingsGroups.map((group) => (
                <SidebarGroup key={group.title}>
                    <SidebarGroupLabel>{group.title}</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {group.items.map((item) => {
                                const Icon = item.icon;
                                return (
                                    <SidebarMenuItem key={item.href}>
                                        <SidebarMenuButton isActive={path === item.href} render={<Link href={item.href} onClick={onNavigate}>
                                            <Icon />
                                            <span>{item.title}</span>
                                        </Link>} />
                                    </SidebarMenuItem>
                                );
                            })}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            ))}
            {isAdmin && (
                <SidebarGroup>
                    <SidebarGroupLabel>Platform</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {serverSettingsNavigation.map((item) => {
                                const Icon = item.icon;
                                const href = serverSettingsHref(item.tab);
                                return (
                                    <SidebarMenuItem key={item.tab}>
                                        <SidebarMenuButton isActive={path === href} render={<Link href={href} onClick={onNavigate}>
                                            <Icon />
                                            <span>{item.title}</span>
                                            {item.tab === 'updates' && newVersionInfo && <span className="ml-auto size-2 animate-pulse rounded-full bg-orange-500" />}
                                        </Link>} />
                                    </SidebarMenuItem>
                                );
                            })}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            )}
            {isAdmin && (
                <SidebarGroup>
                    <SidebarGroupLabel>Developer</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {developerSettingsNavigation.map((item) => {
                                const Icon = item.icon;
                                return (
                                    <SidebarMenuItem key={item.href}>
                                        <SidebarMenuButton isActive={path === item.href} render={<Link href={item.href} onClick={onNavigate}>
                                            <Icon />
                                            <span>{item.title}</span>
                                        </Link>} />
                                    </SidebarMenuItem>
                                );
                            })}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            )}
        </SidebarContent>
    );
}
