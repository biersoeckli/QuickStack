import {
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import React from "react";

import LogsStreamed from "@/components/custom/logs-streamed";

export function LogsDialogContent({
  namespace,
  podName,
}: {
  namespace: string;
  podName: string;
}) {

  const [linesCountInput, setLinesCountInput] = React.useState<number>(100);
  const [linesCount, setLinesCount] = React.useState<number>(100);

  return (<>
    <DialogHeader>
      <DialogTitle>Logs {podName}</DialogTitle>
    </DialogHeader>
    <div className="space-y-4">
      <Input placeholder="Lines showed (default 100)" value={linesCountInput} onChange={(e) => setLinesCountInput(parseInt(e.target.value || '0'))}
        onBlur={(e) => {
          const value = parseInt(e.target.value || '0');
          if (value > 0) {
            setLinesCount(value);
          }
        }} />
      {(namespace && podName) ? <LogsStreamed namespace={namespace} podName={podName} linesCount={linesCount} fullHeight={true} /> : 'Currently there are no Logs available'}
    </div>
  </>
  )
}
