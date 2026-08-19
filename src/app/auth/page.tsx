'use server'

import userService from "@/server/services/user.service";
import UserRegistrationForm from "./register-from";
import UserLoginForm from "./login-form";
import { getUserSession } from "@/server/utils/action-wrapper.utils";
import { redirect } from "next/navigation";
import ssoProviderService from "@/server/services/sso-provider.service";

export default async function AuthPage() {
    const session = await getUserSession();
    if (session) {
        redirect('/');
    }
    const allUsers = await userService.getAllUsers();
    const ssoProviders = (await ssoProviderService.getAll())
        .filter((provider) => provider.enabled)
        .map(({ id, name }) => ({ id, name }));
    return (
        <div className="flex items-center justify-center" style={{ height: '95vh' }}>
            {allUsers.length === 0 ? <UserRegistrationForm /> : <UserLoginForm ssoProviders={ssoProviders} />}
        </div>
    )
}
