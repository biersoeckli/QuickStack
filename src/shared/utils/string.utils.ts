export class StringUtils {
    static convertBytesToReadableSize(bytes: number) {
        if (isNaN(bytes) || bytes === 0) {
            return '0 B';
        }

        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1000));

        return parseFloat((bytes / Math.pow(1000, i)).toFixed(2)) + ' ' + sizes[i];
    }
}