export class KubernetesSizeConverter {

    private static readonly unitMultipliers: Record<string, number> = {
        Ki: 1024, // Kibibytes
        Mi: 1024 ** 2, // Mebibytes
        Gi: 1024 ** 3, // Gibibytes
        Ti: 1024 ** 4, // Tebibytes
        Pi: 1024 ** 5, // Pebibytes
        Ei: 1024 ** 6, // Exbibytes
    };

    /**
     * Converts a Kubernetes size input (e.g., "76587.1Mi") to bytes.
     * @param size - The Kubernetes size string to convert.
     * @returns The size in bytes as a number.
     * @throws Error if the input format is invalid or the unit is unsupported.
     */
    public static toBytes(size: string): number {
        // Regular expression to match the numeric part and the unit
        const sizeRegex = /^([0-9]*\.?[0-9]+)([a-zA-Z]+)$/;
        const match = size.match(sizeRegex);

        if (!match) {
            throw new Error(`Invalid Kubernetes size format: "${size}"`);
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
   * @param cpu - The Kubernetes CPU metric string to convert.
   * @returns The CPU in nano CPUs as a number.
   * @throws Error if the input format is invalid.
   */
    public static toNanoCpu(cpu: string): number {
        // Regular expression to match the numeric part and optional "m" or "n" unit
        const cpuRegex = /^([0-9]*\.?[0-9]+)(m|n?)?$/;
        const match = cpu.match(cpuRegex);

        if (!match) {
            throw new Error(`Invalid Kubernetes CPU format: "${cpu}"`);
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
    public static fromNanoCpu(nanoCpu: number): number {
        return nanoCpu / 1_000_000_000;
    }

    /**
    * Formats the given size in megabytes to a Kubernetes readable format.
    */
    static formatSize(megabytes: number): string {
        if (megabytes % 1024 === 0) {
            return `${Math.round(megabytes / 1024)}Gi`;
        } else {
            return `${Math.round(megabytes)}Mi`;
        }
    }
}