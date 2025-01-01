import { KubernetesSizeConverter } from "@/server/utils/kubernetes-size-converter.utils";

describe(KubernetesSizeConverter.name, () => {
    describe('formatSize', () => {
        it('should format size in Gi when megabytes is a multiple of 1024', () => {
            expect(KubernetesSizeConverter.formatSize(2048)).toBe('2Gi');
            expect(KubernetesSizeConverter.formatSize(1024)).toBe('1Gi');
        });

        it('should format size in Mi when megabytes is not a multiple of 1024', () => {
            expect(KubernetesSizeConverter.formatSize(1500)).toBe('1500Mi');
            expect(KubernetesSizeConverter.formatSize(512)).toBe('512Mi');
        });

        it('should handle edge cases', () => {
            expect(KubernetesSizeConverter.formatSize(0)).toBe('0Gi');
            expect(KubernetesSizeConverter.formatSize(1)).toBe('1Mi');
        });
    });

    describe('fromNanoCpu', () => {
        it('should convert nano CPUs to full CPUs correctly', () => {
            expect(KubernetesSizeConverter.fromNanoCpu(2000000000)).toBe(2);
        });
    });

    describe('toNanoCpu', () => {
        it('should convert milli CPUs to nano CPUs', () => {
            expect(KubernetesSizeConverter.toNanoCpu('500m')).toBe(500 * 1_000_000);
        });

        it('should convert CPUs to nano CPUs', () => {
            expect(KubernetesSizeConverter.toNanoCpu('2')).toBe(2 * 1_000_000_000);
        });

        it('should convert nano CPUs to nano CPUs', () => {
            expect(KubernetesSizeConverter.toNanoCpu('2n')).toBe(2);
        });

        it('should throw an error for invalid format', () => {
            expect(() => KubernetesSizeConverter.toNanoCpu('2x')).toThrow('Invalid Kubernetes CPU format: "2x"');
        });
    });

    describe('toBytes', () => {
        it('should convert Ki to bytes correctly', () => {
            expect(KubernetesSizeConverter.toBytes('1Ki')).toBe(1024);
            expect(KubernetesSizeConverter.toBytes('1.5Ki')).toBe(1536);
        });

        it('should convert Mi to bytes correctly', () => {
            expect(KubernetesSizeConverter.toBytes('1Mi')).toBe(1024 ** 2);
            expect(KubernetesSizeConverter.toBytes('1.5Mi')).toBe(1.5 * 1024 ** 2);
        });

        it('should convert Gi to bytes correctly', () => {
            expect(KubernetesSizeConverter.toBytes('1Gi')).toBe(1024 ** 3);
            expect(KubernetesSizeConverter.toBytes('1.5Gi')).toBe(1.5 * 1024 ** 3);
        });

        it('should convert Ti to bytes correctly', () => {
            expect(KubernetesSizeConverter.toBytes('1Ti')).toBe(1024 ** 4);
            expect(KubernetesSizeConverter.toBytes('1.5Ti')).toBe(1.5 * 1024 ** 4);
        });

        it('should convert Pi to bytes correctly', () => {
            expect(KubernetesSizeConverter.toBytes('1Pi')).toBe(1024 ** 5);
            expect(KubernetesSizeConverter.toBytes('1.5Pi')).toBe(1.5 * 1024 ** 5);
        });

        it('should convert Ei to bytes correctly', () => {
            expect(KubernetesSizeConverter.toBytes('1Ei')).toBe(1024 ** 6);
            expect(KubernetesSizeConverter.toBytes('1.5Ei')).toBe(1.5 * 1024 ** 6);
        });

        it('should throw an error for invalid format', () => {
            expect(() => KubernetesSizeConverter.toBytes('123')).toThrow('Invalid Kubernetes size format: "123"');
            expect(() => KubernetesSizeConverter.toBytes('123.45')).toThrow('Invalid Kubernetes size format: "123.45"');
            expect(() => KubernetesSizeConverter.toBytes('Mi')).toThrow('Invalid Kubernetes size format: "Mi"');
        });

        it('should throw an error for unsupported unit', () => {
            expect(() => KubernetesSizeConverter.toBytes('123Zi')).toThrow('Unsupported unit: "Zi"');
            expect(() => KubernetesSizeConverter.toBytes('123Yi')).toThrow('Unsupported unit: "Yi"');
        });
    });
});