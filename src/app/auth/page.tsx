import userService from "@/server/services/user.service";
import UserRegistrationForm from "./register-from";
import UserLoginForm from "./login-form";
import { getUserSession } from "@/server/utils/action-wrapper.utils";
import { redirect } from "next/navigation";
import ssoProviderService from "@/server/services/sso-provider.service";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Authentication",
    description: "Authentication",
};

export default async function AuthPage() {
    const session = await getUserSession();
    if (session) {
        redirect('/');
    }
    const allUsers = await userService.getAllUsers();
    const ssoProviders = (await ssoProviderService.getAll())
        .filter((provider) => provider.enabled)
        .map(({ id, name, type }) => ({ id, name, type }));
    return (
        <main className="relative left-1/2 grid min-h-[100dvh] w-screen -translate-x-1/2 place-items-center overflow-hidden  px-4 py-10 sm:px-6">
            <div className="absolute inset-x-0 top-0 h-80  " />
            <div className="relative w-full max-w-md">
                {allUsers.length === 0 ? <UserRegistrationForm /> : <UserLoginForm ssoProviders={ssoProviders} />}
            </div>
        </main>
    )
}
