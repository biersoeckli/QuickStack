class LonghornApiAdapter {

    get longhornBaseUrl() {
        return process.env.NODE_ENV === 'production' ? 'http://longhorn-frontend.longhorn-system.svc.cluster.local' : 'http://localhost:4000';
    }

    async getLonghornVolume(pvcName: String) {
        const response = await fetch(`${this.longhornBaseUrl}/v1/volumes/${pvcName}`, {
            cache: 'no-cache',
            method: 'GET',
            headers: {

                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP-Error: ${response.status}`);
        }

        const data = await response.json();

        const usedStorage = data.controllers?.[0]?.actualSize;

        return (usedStorage / (1024 * 1024));
    }


    async getNodeStorageInfo(nodeName: String) {
        const response = await fetch(`${this.longhornBaseUrl}/v1/nodes/${nodeName}`, {
            cache: 'no-cache',
            method: 'GET',
            headers: {

                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP-Error: ${response.status}`);
        }

        const data = await response.json() as {
            disks: {
                [key: string]: {
                    storageMaximum: number,
                    storageAvailable: number,
                    storageReserved: number,
                    storageScheduled: number
                }
            }
        };

        if (!data.disks || typeof data.disks !== "object") {
            throw new Error("Invalid node data: 'disks' property is missing or not an object.");
        }

        let totalStorageMaximum = 0;
        let totalStorageAvailable = 0;
        let totalStorageReserved = 0;
        let totalStorageScheduled = 0;
        Object.values(data.disks).forEach(disk => {
            totalStorageMaximum += disk.storageMaximum;
            totalStorageAvailable += disk.storageAvailable;
            totalStorageReserved += disk.storageReserved;
            totalStorageScheduled += disk.storageScheduled;
        });

        // The available Storage is the total storage minus the reserved storage (which is not available for scheduling --> 30% of disk space)
        const totalSchedulableStorage = totalStorageAvailable - totalStorageReserved;

        return {
            totalStorageMaximum,
            totalStorageAvailable,
            totalSchedulableStorage,
            totalStorageReserved
        };

    }


    async backupPvc(pvcName: string) {
        const snapshot = await this.createSnapshot(pvcName);
        await this.createBackup(pvcName, snapshot.id);
    }

    private async createBackup(pvcName: string, snapshotId: string) {
        const response = await fetch(`${this.longhornBaseUrl}/v1/volumes/${pvcName}?action=snapshotBackup`, {
            cache: 'no-cache',
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                "name": snapshotId
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP-Error: ${response.status}`);
        }

        return await response.json();
    }

    private async createSnapshot(pvcName: string) {
        const response = await fetch(`${this.longhornBaseUrl}/v1/volumes/${pvcName}?action=snapshotCreate`, {
            cache: 'no-cache',
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP-Error: ${response.status}`);
        }

        /*
        Response:
        {
            "actions": {},
            "checksum": "",
            "children": {
                "volume-head": true
            },
            "created": "2024-12-30T14:20:34Z",
            "id": "79973f60-02d5-4100-acd4-9306112d5c91",
            "labels": {},
            "links": {
                "self": "http://10.42.0.100:9500/v1/snapshots/79973f60-02d5-4100-acd4-9306112d5c91"
            },
            "name": "79973f60-02d5-4100-acd4-9306112d5c91",
            "parent": "4beb4c48-53cf-4eaa-98dc-cc3a91f71e44",
            "removed": false,
            "size": "0",
            "type": "snapshot",
            "usercreated": true
        }
        */

        return await response.json();
    }

}
const longhornApiAdapter = new LonghornApiAdapter();
export default longhornApiAdapter;