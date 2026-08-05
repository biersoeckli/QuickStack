import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import React from "react";
import { TerminalSetupInfoModel } from "@/shared/model/terminal-setup-info.model";
import TerminalStreamed from "./terminal-streamed";

export function TerminalDialog({
  terminalInfo,
  children
}: {
  terminalInfo: TerminalSetupInfoModel;
  children: React.ReactNode;
}) {

  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <Dialog open={isOpen} onOpenChange={(isO) => {
      setIsOpen(isO);
    }}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[1300px]">
        <DialogHeader>
          <DialogTitle>Terminal</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {terminalInfo ? <TerminalStreamed terminalInfo={terminalInfo} /> : 'Currently there is no Terminal available'}
        </div>
      </DialogContent>
    </Dialog>
  )
}
