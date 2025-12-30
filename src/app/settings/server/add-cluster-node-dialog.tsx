'use client'

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button"
import { Code } from "@/components/custom/code"



export default function AddClusterNodeDialog({ children, clusterJoinToken }: { children: React.ReactNode; clusterJoinToken?: string }) {

    const [isOpen, setIsOpen] = useState<boolean>(false);
    const [command, setCommand] = useState<string>(``);

    useEffect(() => {
        setCommand(`curl -sfL https://get.quickstack.dev/setup-worker.sh | K3S_URL=https://MASTER_IP:6443 JOIN_TOKEN=${clusterJoinToken ?? ''} sh -`);
    }, [clusterJoinToken]);

    return (
        <>
            <div onClick={() => setIsOpen(true)}>
                {children}
            </div>
            <Dialog open={!!isOpen} onOpenChange={(isOpened) => setIsOpen(false)}>
                <DialogContent className="sm:max-w-[700px]">
                    <DialogHeader>
                        <DialogTitle>Add Cluster Node</DialogTitle>
                        <DialogDescription>
                            Add a new quickstack cluster node by running the following command on the node you want to add.
                        </DialogDescription>
                    </DialogHeader>

                    <Code>{command}</Code>

                    <div><p className="font-semibold mt-2">Note:</p>
                        <ul className="list-disc list-inside text-xs text-slate-500">
                            <li>Replace MASTER-IP with the IP address or hostname of the master node.</li>
                            <li>Ensure the node you want to add has access to the internet and the master node's IP address.</li>
                            <li>Run the command on the node you want to add to the cluster.</li>
                            <li className={clusterJoinToken ? '' : 'text-red-500'}>If the token is invalid or not shown in command above, run <Code className="text-xs">sudo cat /var/lib/rancher/k3s/server/node-token</Code> on your master node to retrieve a new one.</li>
                        </ul>
                    </div>
                    <DialogFooter>
                        <Button onClick={() => setIsOpen(false)}>Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )



}