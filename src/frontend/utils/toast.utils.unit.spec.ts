import { Toast } from '@/frontend/utils/toast.utils';
import { toast } from 'sonner';
import { ServerActionResult } from "@/shared/model/server-action-error-return.model";

jest.mock('sonner', () => ({
    toast: {
        promise: jest.fn()
    }
}));

describe('Toast', () => {
    describe('fromAction', () => {
        it('should resolve with success message when action is successful', async () => {
            const action = jest.fn().mockResolvedValue({ status: 'success', message: 'Success' } as ServerActionResult<any, any>);
            const defaultSuccessMessage = 'Operation successful';

            (toast.promise as jest.Mock).mockImplementation(async (actionFn, { success }) => {
                const result = await actionFn();
                return success(result);
            });

            const result = await Toast.fromAction(action, defaultSuccessMessage);

            expect(result).toEqual({ status: 'success', message: 'Success' });
            expect(toast.promise).toHaveBeenCalled();
        });

        it('should reject with error message when action fails', async () => {
            const action = jest.fn().mockResolvedValue({ status: 'error', message: 'Failure' } as ServerActionResult<any, any>);

            (toast.promise as jest.Mock).mockImplementation(async (actionFn, { error }) => {
                try {
                    await actionFn();
                } catch (err) {
                    return error(err);
                }
            });

            await expect(Toast.fromAction(action)).rejects.toThrow('Failure');
            expect(toast.promise).toHaveBeenCalled();
        });

        it('should reject with unknown error message when action throws an error', async () => {
            const action = jest.fn().mockRejectedValue(new Error('Some error'));

            (toast.promise as jest.Mock).mockImplementation(async (actionFn, { error }) => {
                try {
                    await actionFn();
                } catch (err) {
                    return error(err);
                }
            });

            await expect(Toast.fromAction(action)).rejects.toThrow('Some error');
            expect(toast.promise).toHaveBeenCalled();
        });

        it('should use default success message when action is successful and no message is provided', async () => {
            const action = jest.fn().mockResolvedValue({ status: 'success' } as ServerActionResult<any, any>);
            const defaultSuccessMessage = 'Operation successful';

            (toast.promise as jest.Mock).mockImplementation(async (actionFn, { success }) => {
                const result = await actionFn();
                return success(result);
            });

            const result = await Toast.fromAction(action, defaultSuccessMessage);

            expect(result).toEqual({ status: 'success' });
            expect(toast.promise).toHaveBeenCalled();
        });
    });
});