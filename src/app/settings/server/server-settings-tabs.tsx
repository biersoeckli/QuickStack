"use client"

import { Tabs } from "@/components/ui/tabs"
import { usePathname, useSearchParams } from "next/navigation"
import { ReactNode, useEffect, useState } from "react"
import { TabNavigationUtils } from "@/frontend/utils/tab-navigation.utils"

interface ServerSettingsTabsProps {
    children: ReactNode
    defaultTab: string
}

export function ServerSettingsTabs({ children, defaultTab }: ServerSettingsTabsProps) {
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const [activeTab, setActiveTab] = useState(defaultTab)

    useEffect(() => {
        setActiveTab(defaultTab)
    }, [defaultTab])

    const onTabChange = (value: string) => {
        setActiveTab(value)
        const params = new URLSearchParams(searchParams.toString())
        params.set("tab", value)
        TabNavigationUtils.replaceQuery(params, pathname)
    }

    return (
        <Tabs value={activeTab} onValueChange={onTabChange} className="space-y-4">
            {children}
        </Tabs>
    )
}
