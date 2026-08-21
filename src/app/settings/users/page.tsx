'use server'

import { getAdminUserSession } from "@/server/utils/action-wrapper.utils";
import PageTitle from "@/components/custom/page-title";
import BreadcrumbSetter from "@/components/breadcrumbs-setter";
import UsersTable from "./users-table";
import userService from "@/server/services/user.service";
import userGroupService from "@/server/services/user-group.service";
import { CircleUser, KeyRound, UserRoundCog } from "lucide-react";
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs"
import UserGroupsTable from "./user-groups-table";
import projectService from "@/server/services/project.service";
import ssoProviderService from "@/server/services/sso-provider.service";
import SsoProvidersTable from "./sso-providers-table";

export default async function UsersAndGroupsPage() {

    const session = await getAdminUserSession();
    const users = await userService.getAllUsers();
    const userGroups = await userGroupService.getAll();
    const allApps = await projectService.getAll();
    const ssoProviders = await ssoProviderService.getAll();
    return (
        <div className="flex-1 space-y-4 pt-6">
            <PageTitle
                title={'Users & Groups'} >
            </PageTitle>
            <BreadcrumbSetter items={[
                { name: "Settings", url: "/settings/profile" },
                { name: "Users & Groups" },
            ]} />
            <Tabs defaultValue="users" >
                <TabsList className="">
                    <TabsTrigger className="px-8 gap-1.5" value="users"><CircleUser className="w-3.5 h-3.5" /> Users</TabsTrigger>
                    <TabsTrigger className="px-8 gap-1.5" value="groups"><UserRoundCog className="w-3.5 h-3.5" /> Groups</TabsTrigger>
                    <TabsTrigger className="px-8 gap-1.5" value="sso"><KeyRound className="w-3.5 h-3.5" /> SSO Providers</TabsTrigger>
                </TabsList>
                <TabsContent value="users">
                    <UsersTable session={session} users={users} userGroups={userGroups} ssoProviders={ssoProviders} />
                </TabsContent>
                <TabsContent value="groups">
                    <UserGroupsTable projects={allApps} userGroups={userGroups} />
                </TabsContent>
                <TabsContent value="sso">
                    <SsoProvidersTable ssoProviders={ssoProviders} userGroups={userGroups} />
                </TabsContent>
            </Tabs>
        </div>
    )
}
