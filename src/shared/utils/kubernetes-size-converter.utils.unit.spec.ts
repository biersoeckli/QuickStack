import { KubeSizeConverter } from "@/shared/utils/kubernetes-size-converter.utils";

describe(KubeSizeConverter.name, () => {

    describe('convertBytesToReadableSize', () => {
        it('should convert bytes to human-readable format', () => {
            expect(KubeSizeConverter.convertBytesToReadableSize(1024)).toBe('1 KB');
            expect(KubeSizeConverter.convertBytesToReadableSize(1024 * 1024)).toBe('1 MB');
            expect(KubeSizeConverter.convertBytesToReadableSize(1024 * 1024 * 1024)).toBe('1 GB');
            expect(KubeSizeConverter.convertBytesToReadableSize(1500)).toBe('1.46 KB');
        });

        it('should handle zero bytes', () => {
            expect(KubeSizeConverter.convertBytesToReadableSize(0)).toBe('0 B');
        });

        it('should handle NaN input', () => {
            expect(KubeSizeConverter.convertBytesToReadableSize(NaN)).toBe('0 B');
        });

        it('should hide size unit if hideSize is true', () => {
            expect(KubeSizeConverter.convertBytesToReadableSize(1024, 0, true)).toBe('1');
        });
    });

    describe('formatSize', () => {
        it('should format size in Gi when megabytes is a multiple of 1024', () => {
            expect(KubeSizeConverter.megabytesToKubeFormat(2048)).toBe('2Gi');
            expect(KubeSizeConverter.megabytesToKubeFormat(1024)).toBe('1Gi');
        });

        it('should format size in Mi when megabytes is not a multiple of 1024', () => {
            expect(KubeSizeConverter.megabytesToKubeFormat(1500)).toBe('1500Mi');
            expect(KubeSizeConverter.megabytesToKubeFormat(512)).toBe('512Mi');
        });

        it('should handle edge cases', () => {
            expect(KubeSizeConverter.megabytesToKubeFormat(0)).toBe('0Gi');
            expect(KubeSizeConverter.megabytesToKubeFormat(1)).toBe('1Mi');
        });
    });

    describe('fromKubeSizeToNanoCpu', () => {
        it('should convert Kubernetes CPU metric to nano CPUs', () => {
            expect(KubeSizeConverter.fromKubeSizeToNanoCpu('500m')).toBe(500_000_000);
            expect(KubeSizeConverter.fromKubeSizeToNanoCpu('2')).toBe(2_000_000_000);
            expect(KubeSizeConverter.fromKubeSizeToNanoCpu('1000000000n')).toBe(1000000000);
        });

        it('should throw error for invalid format', () => {
            expect(() => KubeSizeConverter.fromKubeSizeToNanoCpu('invalid')).toThrowError('Invalid Kubernetes CPU format: "invalid"');
        });
    });

    describe('fromNanoToFullCpu', () => {
        it('should convert nano CPUs to full CPUs', () => {
            expect(KubeSizeConverter.fromNanoToFullCpu(1_000_000_000)).toBe(1);
            expect(KubeSizeConverter.fromNanoToFullCpu(500_000_000)).toBe(0.5);
        });
    });

    describe('toBytes', () => {
        it('should convert Ki to bytes correctly', () => {
            expect(KubeSizeConverter.fromKubeSizeToBytes('1Ki')).toBe(1024);
            expect(KubeSizeConverter.fromKubeSizeToBytes('1.5Ki')).toBe(1536);
        });

        it('should convert Mi to bytes correctly', () => {
            expect(KubeSizeConverter.fromKubeSizeToBytes('1Mi')).toBe(1024 ** 2);
            expect(KubeSizeConverter.fromKubeSizeToBytes('1.5Mi')).toBe(1.5 * 1024 ** 2);
        });

        it('should convert Gi to bytes correctly', () => {
            expect(KubeSizeConverter.fromKubeSizeToBytes('1Gi')).toBe(1024 ** 3);
            expect(KubeSizeConverter.fromKubeSizeToBytes('1.5Gi')).toBe(1.5 * 1024 ** 3);
        });

        it('should convert Ti to bytes correctly', () => {
            expect(KubeSizeConverter.fromKubeSizeToBytes('1Ti')).toBe(1024 ** 4);
            expect(KubeSizeConverter.fromKubeSizeToBytes('1.5Ti')).toBe(1.5 * 1024 ** 4);
        });

        it('should convert Pi to bytes correctly', () => {
            expect(KubeSizeConverter.fromKubeSizeToBytes('1Pi')).toBe(1024 ** 5);
            expect(KubeSizeConverter.fromKubeSizeToBytes('1.5Pi')).toBe(1.5 * 1024 ** 5);
        });

        it('should convert Ei to bytes correctly', () => {
            expect(KubeSizeConverter.fromKubeSizeToBytes('1Ei')).toBe(1024 ** 6);
            expect(KubeSizeConverter.fromKubeSizeToBytes('1.5Ei')).toBe(1.5 * 1024 ** 6);
        });

        it('should throw an error for invalid format', () => {
            expect(() => KubeSizeConverter.fromKubeSizeToBytes('123')).toThrow('Invalid Kubernetes size format: "123"');
            expect(() => KubeSizeConverter.fromKubeSizeToBytes('123.45')).toThrow('Invalid Kubernetes size format: "123.45"');
            expect(() => KubeSizeConverter.fromKubeSizeToBytes('Mi')).toThrow('Invalid Kubernetes size format: "Mi"');
        });

        it('should throw an error for unsupported unit', () => {
            expect(() => KubeSizeConverter.fromKubeSizeToBytes('123Zi')).toThrow('Unsupported unit: "Zi"');
            expect(() => KubeSizeConverter.fromKubeSizeToBytes('123Yi')).toThrow('Unsupported unit: "Yi"');
        });
    });

    describe('fromBytesToMegabytes', () => {
        it('should convert bytes to megabytes', () => {
            expect(KubeSizeConverter.fromBytesToMegabytes(1024 * 1024)).toBe(1);
        });
    });

    describe('fromMegabytesToBytes', () => {
        it('should convert megabytes to bytes', () => {
            expect(KubeSizeConverter.fromMegabytesToBytes(1)).toBe(1024 * 1024);
        });
    });
});