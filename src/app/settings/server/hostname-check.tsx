'use client'

import { toast } from "sonner";
import { useEffect } from "react";
import { getConfiguredHostname } from "./actions";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function HostnameCheck() {

    const checkForCorrectHostname = async () => {
        const configuredDomain = await getConfiguredHostname();
        if (configuredDomain.status === 'success') {
            const hostname = window.location.hostname;
            const serverParamHostname = configuredDomain.data;
            if (serverParamHostname && serverParamHostname !== hostname) {
                toast.warning(`QuickStack is configured to run on a different domain. Please open the application on https://${serverParamHostname}`, {
                    duration: 10000,
                    action: {
                        label: <Button variant="ghost"><ExternalLink /> open</Button>,
                        onClick: () => {
                            window.open(`https://${serverParamHostname}`, '_blank');
                        }
                    }
                });
            }
        }
    }

    useEffect(() => {
        checkForCorrectHostname();
    });
    return <></>;
}
