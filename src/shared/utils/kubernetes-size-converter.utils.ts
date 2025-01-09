export class KubeSizeConverter {

    private static readonly unitMultipliers: Record<string, number> = {
        Ki: 1024, // Kibibytes
        Mi: 1024 ** 2, // Mebibytes
        Gi: 1024 ** 3, // Gibibytes
        Ti: 1024 ** 4, // Tebibytes
        Pi: 1024 ** 5, // Pebibytes
        Ei: 1024 ** 6, // Exbibytes
    };

    /**
     * Converts a size in bytes to a human-readable format.
     * eg. 1024 -> 1 KB, 1024 * 1024 -> 1 MB, etc.
     */
    static convertBytesToReadableSize(bytes: number, fractionDigits = 2, hideSize = false): string {
        if (isNaN(bytes) || bytes === 0) {
            return '0 B';
        }

        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));

        return parseFloat((bytes / Math.pow(1024, i)).toFixed(fractionDigits)) + (hideSize ? '' : (' ' + sizes[i]));
    }

    /**
     * Converts a Kubernetes size input (e.g., "76587.1Mi") to bytes.
     * @param kubernetesSizeFormat - The Kubernetes size string to convert.
     * @returns The size in bytes as a number.
     * @throws Error if the input format is invalid or the unit is unsupported.
     */
    static fromKubeSizeToBytes(kubernetesSizeFormat: string): number {
        // Regular expression to match the numeric part and the unit
        const sizeRegex = /^([0-9]*\.?[0-9]+)([a-zA-Z]+)$/;
        const match = kubernetesSizeFormat.match(sizeRegex);

        if (!match) {
            throw new Error(`Invalid Kubernetes size format: "${kubernetesSizeFormat}"`);
        }

        const value = parseFloat(match[1]); // Numeric part
        const unit = match[2]; // Unit part

        // Lookup the multiplier for the given unit
        const multiplier = this.unitMultipliers[unit];

        if (!multiplier) {
            throw new Error(`Unsupported unit: "${unit}"`);
        }

        // Convert to bytes
        return value * multiplier;
    }

    /**
   * Converts a Kubernetes CPU metric (e.g., "500m", "2") to nano CPUs.
   * @param kubernetesCpuMetric - The Kubernetes CPU metric string to convert.
   * @returns The CPU in nano CPUs as a number.
   * @throws Error if the input format is invalid.
   */
    static fromKubeSizeToNanoCpu(kubernetesCpuMetric: string): number {
        // Regular expression to match the numeric part and optional "m" or "n" unit
        const cpuRegex = /^([0-9]*\.?[0-9]+)(m|n?)?$/;
        const match = kubernetesCpuMetric.match(cpuRegex);

        if (!match) {
            throw new Error(`Invalid Kubernetes CPU format: "${kubernetesCpuMetric}"`);
        }

        const value = parseFloat(match[1]); // Numeric part
        const unit = match[2]; // Unit part

        // Convert to nano CPUs
        if (unit === "m") {
            return value * 1_000_000;
        } else if (unit === "n") {
            return value;
        } else {
            return value * 1_000_000_000;
        }
    }

    /**
    * Converts nano CPUs to full CPUs.
    * @param nanoCpu - The number of nano CPUs to convert.
    * @returns The number of full CPUs.
    */
    static fromNanoToFullCpu(nanoCpu: number): number {
        return nanoCpu / 1_000_000_000;
    }

    /**
    * Formats the given size in megabytes to a Kubernetes readable format.
    */
    static megabytesToKubeFormat(megabytes: number): string {
        if (megabytes % 1024 === 0) {
            return `${Math.round(megabytes / 1024)}Gi`;
        } else {
            return `${Math.round(megabytes)}Mi`;
        }
    }

    static fromBytesToMegabytes(bytes: number): number {
        return bytes / 1024 / 1024;
    }

    static fromMegabytesToBytes(megabytes: number): number {
        return megabytes * 1024 * 1024;
    }
}