import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { cn } from "@/frontend/utils/utils"
import { Toaster } from "@/components/ui/sonner"
import "./globals.css";
import { Suspense } from "react";
import FullLoadingSpinner from "@/components/ui/full-loading-spinnter";
import { ConfirmDialog } from "@/components/custom/confirm-dialog";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "./sidebar";
import { cookies } from "next/headers";
import { BreadcrumbsGenerator } from "../components/custom/breadcrumbs-generator";
import { getUserSession } from "@/server/utils/action-wrapper.utils";
import { InputDialog } from "@/components/custom/input-dialog";
import userGroupService from "@/server/services/user-group.service";
import PodsStatusPollingProvider from "@/components/custom/pods-status-polling-provider";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "QuickStack",
  description: "", // todo
  icons: [
    { rel: "favicon", url: "/quickstack-icon-dark.png" },
    { rel: "icon", url: "/quickstack-icon-dark.png" },
    { rel: "apple-touch-icon", url: "/quickstack-icon-dark.png" }
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies()
  const cookieSidebarState = cookieStore.get("sidebar:state")?.value ?? 'true';
  const defaultOpen = cookieSidebarState === "true";
  const session = await getUserSession();
  const userIsLoggedIn = !!session;

  // todo remove in future versions and handle migrations in an other way
  await userGroupService.createDefaultRolesIfNotExists();

  return (
    <html lang="en">
      <body className={cn(
        "min-h-screen bg-background font-sans antialiased",
        inter.variable
      )}>
        <SidebarProvider defaultOpen={defaultOpen}>
          <AppSidebar />
          <main className="flex w-full flex-col items-center">
            <div className="w-full max-w-8xl px-2 lg:px-4">
              <div className="flex-col md:flex p-6">
                {userIsLoggedIn && <BreadcrumbsGenerator />}
                <Suspense fallback={<FullLoadingSpinner />}>
                  {children}
                </Suspense>
              </div>
            </div>
          </main>
        </SidebarProvider>

        <Toaster />
        <ConfirmDialog />
        <InputDialog />
        {userIsLoggedIn && <PodsStatusPollingProvider />}
      </body>
    </html>
  );
}