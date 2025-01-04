import { ServerActionResult } from "@/shared/model/server-action-error-return.model";
import { toast } from "sonner";

export class Toast {
    static async fromAction<A, B>(action: () => Promise<ServerActionResult<A, B>>,
        defaultSuccessMessage = 'Operation successful',
        defaultLoadingMessage = 'loading...') {

        return new Promise<ServerActionResult<A, B>>(async (resolve, reject) => {
            toast.promise(async () => {
                const retVal = await action();
                if (!retVal || (retVal as ServerActionResult<A, B>).status !== 'success') {
                    throw new Error(retVal?.message ?? 'An unknown error occurred.');
                }
                return retVal;
            }, {
                loading: defaultLoadingMessage,
                success: (result: ServerActionResult<A, B>) => {
                    resolve(result);
                    return result.message ?? defaultSuccessMessage;
                },
                error: (error) => {
                    reject(error);
                    if (error.message) {
                        return 'Error: ' + error.message;
                    }
                    return 'An unknown error occurred';
                }
            });
        });
    }
}