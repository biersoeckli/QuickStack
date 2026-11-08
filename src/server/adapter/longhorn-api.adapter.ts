class LonghornApiAdapter {

    get longhornBaseUrl() {
        return process.env.NODE_ENV === 'production' ? 'http://longhorn-frontend.longhorn-system.svc.cluster.local' : 'http://localhost:8000';
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

        const usedStorageBytes = data.controllers?.[0]?.actualSize;

        return usedStorageBytes;
    }

    async getAllLonghornVolumes(): Promise<{
        actualSizeBytes: number;
        sizeBytes: number;
        name: string;
    }[]> {
        const response = await fetch(`${this.longhornBaseUrl}/v1/volumes`, {
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
            data: {
                id: string;
                controllers: {
                    actualSize: string;
                    name: string;
                    size: string;
                }[]
            }[]
        };

        return data.data.map(volume => {
            const firstController = volume.controllers.find(x => !!x);
            if (!firstController || !firstController.actualSize || !firstController.size || !firstController.name) {
                return undefined;
            }
            return {
                actualSizeBytes: parseInt(firstController.actualSize),
                sizeBytes: parseInt(firstController.size),
                name: volume.id
            };
        }).filter(x => !!x);
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
