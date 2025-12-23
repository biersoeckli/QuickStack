"use client"

import { Tabs } from "@/components/ui/tabs"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { ReactNode } from "react"

interface ServerSettingsTabsProps {
    children: ReactNode
    defaultTab: string
}

export function ServerSettingsTabs({ children, defaultTab }: ServerSettingsTabsProps) {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const onTabChange = (value: string) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set("tab", value)
        router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    }

    return (
        <Tabs defaultValue={defaultTab} onValueChange={onTabChange} className="space-y-4">
            {children}
        </Tabs>
    )
}
