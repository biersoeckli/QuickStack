import { ServerActionResult } from "@/shared/model/server-action-error-return.model";
import { toast } from "sonner";

export class Actions {
    static async run<TReturnData>(action: () => Promise<ServerActionResult<unknown, TReturnData>>) {
        try {
            const retVal = await action();
            if (!retVal || (retVal as ServerActionResult<unknown, TReturnData>).status !== 'success') {
                toast.error(retVal?.message ?? 'An unknown error occurred.');
                throw new Error(retVal?.message ?? 'An unknown error occurred.');
            }
            return retVal.data!;
        } catch (error) {
            toast.error('An unknown error occurred.');
            throw error;
        }
    }
}