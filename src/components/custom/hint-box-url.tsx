import Link from "next/link";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import { Button } from "../ui/button";
import { CircleHelp } from "lucide-react";




export function HintBoxUrl({ url }: { url: string }) {

    const uri = new URL(url);


    return <TooltipProvider>
        <Tooltip>
            <TooltipTrigger render={<Link href={url} target="_blank">
                    <Button type="button" variant="outline" className="h-8 w-8 p-0"><CircleHelp /></Button>
                </Link>} />
            <TooltipContent>
                <p>Link to {uri.hostname}</p>
            </TooltipContent>
        </Tooltip>
    </TooltipProvider>
}