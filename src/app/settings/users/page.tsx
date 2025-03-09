'use server'

import { getAdminUserSession, getAuthUserSession } from "@/server/utils/action-wrapper.utils";
import PageTitle from "@/components/custom/page-title";
import S3TargetEditOverlay from "./user-edit-overlay";
import { Button } from "@/components/ui/button";
import BreadcrumbSetter from "@/components/breadcrumbs-setter";
import UsersTable from "./users-table";
import userService from "@/server/services/user.service";
import roleService from "@/server/services/role.service";
import { CircleUser, Plus, User, UserRoundCog } from "lucide-react";
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs"
import RolesTable from "./roles-table";
import appService from "@/server/services/app.service";

export default async function UsersAndRolesPage() {

    const session = await getAdminUserSession();
    const users = await userService.getAllUsers();
    const roles = await roleService.getAll();
    const allApps = await appService.getAll();
    return (
        <div className="flex-1 space-y-4 pt-6">
            <PageTitle
                title={'Users & Roles'} >
            </PageTitle>
            <BreadcrumbSetter items={[
                { name: "Settings", url: "/settings/profile" },
                { name: "Users & Roles" },
            ]} />
            <Tabs defaultValue="users" >
                <TabsList className="">
                    <TabsTrigger className="px-8 gap-1.5" value="users"><CircleUser className="w-3.5 h-3.5" /> Users</TabsTrigger>
                    <TabsTrigger className="px-8 gap-1.5" value="roles"><UserRoundCog className="w-3.5 h-3.5" /> Roles</TabsTrigger>
                </TabsList>
                <TabsContent value="users">
                    <UsersTable session={session} users={users} roles={roles} />
                </TabsContent>
                <TabsContent value="roles">
                    <RolesTable apps={allApps} roles={roles} />
                </TabsContent>
            </Tabs>
        </div>
    )
}
