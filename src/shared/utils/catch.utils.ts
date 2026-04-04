export class CatchUtils {
    static async resultOrUndefined<T>(promiseFunc: () => Promise<T>, context?: string): Promise<T | undefined> {
        const promiseName = promiseFunc.name || 'anonymous-promise';
        const contextInfo = context ? ` [${context}]` : '';
        try {
            return await promiseFunc();
        } catch (error) {
            const errorInfo = error instanceof Error
                ? `${error.name}: ${error.message}`
                : String(error);
            console.error(`Error in resultOrUndefined${contextInfo} (${promiseName}): ${errorInfo}`, error);
            return undefined;
        }
    }
}