import {
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useDialog } from "@/frontend/states/zustand.states";
import { cloneElement, type MouseEvent, type ReactElement } from "react";
import { TerminalSetupInfoModel } from "@/shared/model/terminal-setup-info.model";
import TerminalStreamed from "./terminal-streamed";

function TerminalDialogContent({ terminalInfo }: { terminalInfo: TerminalSetupInfoModel }) {
  return <>
    <DialogHeader>
      <DialogTitle>Terminal</DialogTitle>
    </DialogHeader>
    <div className="space-y-4">
      <TerminalStreamed terminalInfo={terminalInfo} />
    </div>
  </>;
}

export function TerminalDialog({
  terminalInfo,
  children
}: {
  terminalInfo: TerminalSetupInfoModel;
  children: ReactElement<{ onClick?: (event: MouseEvent) => void }>;
}) {
  const { openDialog } = useDialog();

  const openTerminalDialog = () => {
    void openDialog(
      <TerminalDialogContent terminalInfo={terminalInfo} />,
      { maxWidth: '1300px' },
    );
  };

  return cloneElement(children, {
    onClick: (event) => {
      children.props.onClick?.(event);
      openTerminalDialog();
    },
  });
}
