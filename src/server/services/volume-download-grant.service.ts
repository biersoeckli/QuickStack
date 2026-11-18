import { ServiceException } from "@/shared/model/service.exception.model";

const DOWNLOAD_GRANT_TTL_MS = 60 * 60 * 1000;

interface DownloadGrant {
    userId: string;
    expiresAt: number;
}

/**
 * Tracks which user is allowed to download a prepared file from the shared
 * volume download directory. Files in that directory are named after the
 * underlying resource id, so the download route cannot tell on its own whether
 * the caller is allowed to read the resource. A grant is recorded by the
 * authorized server action that prepares the file and is checked by the
 * download route before the file is streamed.
 */
class VolumeDownloadGrantService {
    private readonly grantsByFileName = new Map<string, DownloadGrant[]>();

    private purgeExpired(now: number) {
        for (const [fileName, grants] of this.grantsByFileName) {
            const activeGrants = grants.filter((grant) => grant.expiresAt > now);
            if (activeGrants.length === 0) {
                this.grantsByFileName.delete(fileName);
            } else if (activeGrants.length !== grants.length) {
                this.grantsByFileName.set(fileName, activeGrants);
            }
        }
    }

    grant(fileName: string, userId: string) {
        if (!fileName || !userId) {
            throw new ServiceException("Cannot grant download access without a file name and user.");
        }
        const now = Date.now();
        this.purgeExpired(now);
        const grants = (this.grantsByFileName.get(fileName) ?? []).filter((grant) => grant.userId !== userId);
        grants.push({ userId, expiresAt: now + DOWNLOAD_GRANT_TTL_MS });
        this.grantsByFileName.set(fileName, grants);
    }

    assertAllowed(fileName: string, userId: string) {
        const now = Date.now();
        this.purgeExpired(now);
        const grants = this.grantsByFileName.get(fileName) ?? [];
        const isAllowed = grants.some((grant) => grant.userId === userId && grant.expiresAt > now);
        if (!isAllowed) {
            throw new ServiceException("User is not authorized for this action.");
        }
    }
}

const volumeDownloadGrantService = new VolumeDownloadGrantService();
export default volumeDownloadGrantService;
