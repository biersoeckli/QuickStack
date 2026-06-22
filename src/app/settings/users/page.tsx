'use server'

import { getAdminUserSession, getAuthUserSession } from "@/server/utils/action-wrapper.utils";
import PageTitle from "@/components/custom/page-title";
import S3TargetEditOverlay from "./user-edit-overlay";
import { Button } from "@/components/ui/button";
import BreadcrumbSetter from "@/components/breadcrumbs-setter";
import UsersTable from "./users-table";
import userService from "@/server/services/user.service";
import userGroupService from "@/server/services/user-group.service";
import { CircleUser, UserRoundCog } from "lucide-react";
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs"
import UserGroupsTable from "./user-groups-table";
import appService from "@/server/services/app.service";
import projectService from "@/server/services/project.service";

export default async function UsersAndGroupsPage() {

    const session = await getAdminUserSession();
    const users = await userService.getAllUsers();
    const userGroups = await userGroupService.getAll();
    const allApps = await projectService.getAll();
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
                </TabsList>
                <TabsContent value="users">
                    <UsersTable session={session} users={users} userGroups={userGroups} />
                </TabsContent>
                <TabsContent value="groups">
                    <UserGroupsTable projects={allApps} userGroups={userGroups} />
                </TabsContent>
            </Tabs>
        </div>
    )
}
