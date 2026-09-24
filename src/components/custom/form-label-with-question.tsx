import { CircleHelp } from "lucide-react";
import { FormLabel } from "../ui/form";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";


export default function FormLabelWithQuestion(
    { children, hint }: { children: React.ReactNode, hint: string | React.ReactNode }
) {
    return <div className="flex gap-1.5 mt-1 pb-1">
        <FormLabel>{children}</FormLabel>
        <div>
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger render={<CircleHelp  className="h-4 w-4" />} />
                    <TooltipContent>
                        <p className="max-w-[350px]">{hint}</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        </div>
    </div>
}