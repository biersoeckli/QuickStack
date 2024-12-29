import { toast } from "sonner";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { ClipboardCopy } from "lucide-react";
import { Input } from "../ui/input";

export default function CopyInputField({
    label,
    value,
    secret = false
}: {
    label: string;
    value: string;
    secret?: boolean;
}) {

    const copyValue = (value: string, description?: string) => {
        navigator.clipboard.writeText(value);
        toast.success(description || 'Copied to clipboard.');
    }

    return (<>
        <div className="">
            <Label>{label}</Label>
            <div className="flex items-center space-x-2 pt-2">
                <Input
                    value={secret ? '***************' : value}
                    className="bg-slate-100 cursor-pointer"
                    readOnly
                    onClick={() => copyValue(value)} />

                <Button onClick={() => copyValue(value)} variant="outline">
                    <ClipboardCopy />
                </Button>
            </div>
        </div>
    </>
    )
}