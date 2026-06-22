import stream from "stream";
import dataAccess from "../../adapter/db.client";
import standalonePodService from "./standalone-pod.service";
import k3s from "../../adapter/kubernetes-api.adapter";
import { FsUtils } from "../../utils/fs.utils";
import { PathUtils } from "../../utils/path.utils";
import fsPromises from "fs/promises";
import { App } from "@prisma/client";
import path from "path";
import { create } from 'tar'
import scheduleService from "./schedule.service";
import { DownloadableAppLogsModel } from "../../../shared/model/downloadable-app-logs.model";
import { AppLogEntryModel } from "@/shared/model/app-tail-log-entry";

class AppLogsService {

    configureCronJobs() {
        scheduleService.scheduleJob('daily-logs-to-file', '10 0 * * *', async () => {
            await this.backupLogsForAllRunningAppsForYesterday();
            await this.deleteOldAppLogs();
        });
    }

    async getAvailableLogsForApp(appId: string): Promise<DownloadableAppLogsModel[]> {
        const appLogsFolder = PathUtils.appLogsFolder(appId);
        await FsUtils.createDirIfNotExistsAsync(appLogsFolder, true);

        const fileNames = await FsUtils.listFilesInDirAsync(appLogsFolder);
        const logFiles = fileNames.map((fileName) => {
            const date = this.dateFromAppLogsFileName(fileName);
            if (!date) {
                return undefined;
            }
            return {
                appId,
                date
            };
        }).filter((logFile) => logFile !== undefined);

        // sort logs by date descending
        logFiles.sort((a, b) => {
            return b.date.getTime() - a.date.getTime();
        });

        return logFiles;
    }

    async getCurrentLogs(appId: string, lines = 200): Promise<AppLogEntryModel[]> {
        const app = await dataAccess.client.app.findFirstOrThrow({
            where: {
                id: appId
            }
        });

        const podInfos = await standalonePodService.getPodsForApp(app.projectId, app.id);
        if (podInfos.length === 0) {
            return [];
        }

        return Promise.all(
            podInfos.map(async (pod) => ({
                podName: pod.podName,
                containerName: pod.containerName,
                logs: await standalonePodService.getCurrentLogsForPod(app.projectId, pod.podName, pod.containerName, lines),
            })),
        );
    }

    private dateFromAppLogsFileName(fileName: string) {
        try {
            const dateStr = fileName.replace('.tar.gz', '').split("_")[1];
            return new Date(dateStr);
        } catch (error) {
            console.error("Error parsing date from file name", fileName);
            return undefined;
        }
    }

    async deleteOldAppLogs() {
        const logDaysThreshold = 20;

        const itemsInFolder = await FsUtils.listFilesInDirAsync(PathUtils.persistedLogsPath);
        const logFolders = await Promise.all(itemsInFolder.map(async (item) => {
            const stat = await fsPromises.stat(PathUtils.appLogsFolder(item));
            if (stat.isDirectory()) {
                return item;
            }
            await FsUtils.deleteFileIfExists(PathUtils.appLogsFolder(item));
        }));

        for (const logFolder of logFolders.filter((folder) => !!folder) as string[]) {
            const logsInFolder = await FsUtils.listFilesInDirAsync(PathUtils.appLogsFolder(logFolder));
            for (const logFile of logsInFolder) {
                const fullLogFilePath = path.join(PathUtils.appLogsFolder(logFolder), logFile);
                const stat = await fsPromises.stat(fullLogFilePath);

                if (stat.mtimeMs < new Date().getTime() - logDaysThreshold * 24 * 60 * 60 * 1000) {
                    if (stat.isDirectory()) {
                        await FsUtils.deleteDirIfExistsAsync(fullLogFilePath);
                    } else {
                        await FsUtils.deleteFileIfExists(fullLogFilePath);
                    }
                }
            }
        }
    }

    async backupLogsForAllRunningAppsForYesterday() {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        await this.writeLogsToDiskForAllRunningApps(yesterday);
    }

    async writeLogsToDiskForAllRunningApps(date?: Date) {
        const apps = await dataAccess.client.app.findMany();
        for (const app of apps) {
            try {
                await this.writeAppLogsToDiskForApp(app.id, date);
            } catch (error) {
                console.error(`Error writing logs to disk for app ${app.id}`, error);
            }
        }
    }

    async writeAppLogsToDiskForApp(appId: string, date?: Date) {

        const startOfDay = date ?? new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const secondsSinceMidnight = (new Date().getTime() - startOfDay.getTime()) / 1000;

        const app = await dataAccess.client.app.findFirstOrThrow({
            where: {
                id: appId
            }
        });

        const podInfos = await standalonePodService.getPodsForApp(app.projectId, app.id);
        if (podInfos.length === 0) {
            return;
        }

        await FsUtils.createDirIfNotExistsAsync(PathUtils.appLogsFolder(app.id), true);

        let logPathsWritten = [];
        for (const pod of podInfos) {
            const logPath = await this.writeLogsToFileForPod(pod, app, startOfDay, secondsSinceMidnight);
            if (await FsUtils.fileExists(logPath)) {
                logPathsWritten.push(logPath);
            } else {
                console.error(`Error writing logs to file for pod ${pod.podName} in app ${app.id}. There was no file written!`);
            }
        }

        // create tar.gz file from all log files
        const logFilePath = PathUtils.appLogsFile(app.id, startOfDay);
        await FsUtils.deleteFileIfExists(logFilePath); // delete existing log file --> new one will be created

        if (logPathsWritten.length === 0) {
            return;
        }

        await create({
            gzip: true,
            file: logFilePath,
            cwd: PathUtils.appLogsFolder(app.id)
        }, logPathsWritten);

        if (!FsUtils.fileExists(logFilePath)) {
            throw new Error(`Error creating tar file for logs of app ${app.id} on path ${logFilePath}`);
        }

        for (const logPath of logPathsWritten) {
            await FsUtils.deleteFileIfExists(logPath);
        }

        return {
            appId: app.id,
            date: startOfDay
        };
    }



    private async writeLogsToFileForPod(pod: { podName: string; containerName: string; uid?: string; status?: string; },
        app: App, startOfDay: Date, secondsSinceMidnight: number) {

        console.log(`Fetching logs for pod ${pod.podName} in container ${pod.containerName}`);
        const textLogFilePath = path.join(PathUtils.appLogsFolder(app.id),
            `${startOfDay.toISOString().split('T')[0]}_${pod.podName}.log`);
        await FsUtils.deleteFileIfExists(textLogFilePath); // delete existing log file --> new one will be created

        await new Promise<void>(async (resolve, reject) => {
            try {

                let logStream = new stream.PassThrough();

                const requestWebSocket = await k3s.log.log(app.projectId, pod.podName, pod.containerName, logStream, {
                    follow: false,
                    sinceSeconds: Math.round(secondsSinceMidnight),
                    timestamps: true,
                    pretty: false,
                    previous: false
                });

                logStream.on('data', async (chunk) => {
                    await fsPromises.appendFile(textLogFilePath, chunk.toString(), {
                        encoding: 'utf-8'
                    });
                });

                logStream.on('error', (error) => {
                    console.error(`Error fetching logs for pod ${pod.podName} in container ${pod.containerName}`, error);
                    reject(error);
                });

                logStream.on('end', () => {
                    console.log(`[END] Log stream ended for ${pod.podName}`);
                    resolve();
                    requestWebSocket?.abort();
                });
            } catch (error) {
                console.error(`Error fetching logs for pod ${pod.podName} in container ${pod.containerName}`, error);
                reject(error);
            }
        });

        return textLogFilePath;
    }
}

const appLogsService = new AppLogsService();
export default appLogsService;
