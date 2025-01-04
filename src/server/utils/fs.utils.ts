import fs from "fs"

export class FsUtils {

    static async fileExists(pathName: string) {
        try {
            await fs.promises.access(pathName, fs.constants.F_OK);
            return true;
        } catch (ex) {
            return false;
        }
    }

    static async deleteFileIfExists(pathName: string) {
        try {
            await fs.promises.unlink(pathName);
        } catch (ex) {

        }
    }

    static directoryExists(pathName: string) {
        try {
            return fs.existsSync(pathName);
        } catch (ex) {
            return false;
        }
    }

    static async isFolderEmpty(pathName: string) {
        try {
            const files = await fs.promises.readdir(pathName);
            return files.length === 0;
        } catch (ex) {
            return true;
        }
    }

    static createDirIfNotExists(pathName: string, recursive = false) {
        if (!this.directoryExists(pathName)) {
            fs.mkdirSync(pathName, {
                recursive
            });
        }
    }

    static async createDirIfNotExistsAsync(pathName: string, recursive = false) {
        let exists = false;
        try {
            exists = fs.existsSync(pathName);
        } catch (ex) {

        }
        if (!exists) {
            await fs.promises.mkdir(pathName, {
                recursive
            });
        }
    }
    static async deleteDirIfExistsAsync(pathName: string, recursive = false) {
        let exists = false;
        try {
            exists = fs.existsSync(pathName);
        } catch (ex) {

        }
        if (!exists) {
            return;
        }
        await fs.promises.rm(pathName, {
            recursive
        });
    }
}
