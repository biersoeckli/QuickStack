/**
 * Utility class for parsing and manipulating K3s version strings
 */
export class K3sVersionUtils {
    /**
     * Extracts the major.minor version from a full K3s version string
     * @param fullVersion Full K3s version string (e.g., "v1.31.3+k3s1")
     * @returns Minor version string (e.g., "v1.31")
     * @throws Error if the version format is invalid
     *
     * @example
     * K3sVersionUtils.getMinorVersion("v1.31.3+k3s1") // Returns "v1.31"
     * K3sVersionUtils.getMinorVersion("v1.30.5+k3s2") // Returns "v1.30"
     */
    static getMinorVersion(fullVersion: string): string {
        if (!fullVersion) {
            throw new Error('Version string is required');
        }

        // Remove leading 'v' if present for processing
        const versionWithoutV = fullVersion.startsWith('v')
            ? fullVersion.substring(1)
            : fullVersion;

        // Split by '+' to remove K3s suffix (e.g., "+k3s1")
        const versionWithoutSuffix = versionWithoutV.split('+')[0];

        // Split by '.' to get version parts
        const parts = versionWithoutSuffix.split('.');

        if (parts.length < 2) {
            throw new Error(`Invalid version format: ${fullVersion}`);
        }

        // Validate that major and minor are numbers
        const major = parseInt(parts[0], 10);
        const minor = parseInt(parts[1], 10);

        if (isNaN(major) || isNaN(minor)) {
            throw new Error(`Invalid version format: ${fullVersion}`);
        }

        // Return major.minor with 'v' prefix
        return `v${major}.${minor}`;
    }
}
