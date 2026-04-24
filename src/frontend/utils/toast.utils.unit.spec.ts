import { Toast } from '@/frontend/utils/toast.utils';
import { toast } from 'sonner';
import { ServerActionResult } from "@/shared/model/server-action-error-return.model";

vi.mock('sonner', () => ({
    toast: {
        promise: vi.fn()
    }
}));

describe('Toast', () => {
    describe('fromAction', () => {
        it('should resolve with success message when action is successful', async () => {
            const action = vi.fn().mockResolvedValue({ status: 'success', message: 'Success' } as ServerActionResult<any, any>);
            const defaultSuccessMessage = 'Operation successful';

            vi.mocked(toast.promise).mockImplementation(async (actionFn, { success }: any) => {
                const result = await (actionFn as () => Promise<unknown>)();
                return success(result);
            });

            const result = await Toast.fromAction(action, defaultSuccessMessage);

            expect(result).toEqual({ status: 'success', message: 'Success' });
            expect(toast.promise).toHaveBeenCalled();
        });

        it('should reject with error message when action fails', async () => {
            const action = vi.fn().mockResolvedValue({ status: 'error', message: 'Failure' } as ServerActionResult<any, any>);

            vi.mocked(toast.promise).mockImplementation(async (actionFn, { error }: any) => {
                try {
                    await (actionFn as () => Promise<unknown>)();
                } catch (err) {
                    return error(err);
                }
            });

            await expect(Toast.fromAction(action)).rejects.toThrow('Failure');
            expect(toast.promise).toHaveBeenCalled();
        });

        it('should reject with unknown error message when action throws an error', async () => {
            const action = vi.fn().mockRejectedValue(new Error('Some error'));

            vi.mocked(toast.promise).mockImplementation(async (actionFn, { error }: any) => {
                try {
                    await (actionFn as () => Promise<unknown>)();
                } catch (err) {
                    return error(err);
                }
            });

            await expect(Toast.fromAction(action)).rejects.toThrow('Some error');
            expect(toast.promise).toHaveBeenCalled();
        });

        it('should use default success message when action is successful and no message is provided', async () => {
            const action = vi.fn().mockResolvedValue({ status: 'success' } as ServerActionResult<any, any>);
            const defaultSuccessMessage = 'Operation successful';

            vi.mocked(toast.promise).mockImplementation(async (actionFn, { success }: any) => {
                const result = await (actionFn as () => Promise<unknown>)();
                return success(result);
            });

            const result = await Toast.fromAction(action, defaultSuccessMessage);

            expect(result).toEqual({ status: 'success' });
            expect(toast.promise).toHaveBeenCalled();
        });
    });
});